import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabaseServer } from '@/lib/supabaseServer';
import { isDeadlinePassed, ATTENDANCE_VALUES, WEDDING_EVENT } from '@/lib/rsvpConstants';

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function checkServerCanEdit() {
  try {
    const now = new Date().getTime();
    const cutoff = new Date(WEDDING_EVENT.cutoffIso).getTime();
    return now < cutoff;
  } catch {
    return false;
  }
}

function validatePayload(body) {
  const errors = [];
  const guestName = (body.guest_name || body.full_name || '').trim();
  const attendance = (body.attendance || '').trim();
  let attendeeCount = parseInt(body.attendee_count ?? body.guest_count, 10);
  const specialRequests = (body.special_requests || body.dietary_notes || '').trim().slice(0, 500);
  const message = (body.message || body.wishes || '').trim().slice(0, 1000);

  if (!guestName || guestName.length < 2) {
    errors.push('Vui lòng nhập họ và tên (ít nhất 2 ký tự).');
  }

  if (attendance !== ATTENDANCE_VALUES.ATTENDING && attendance !== ATTENDANCE_VALUES.DECLINED) {
    errors.push('Vui lòng chọn xác nhận tham dự hoặc gửi lời chúc mừng.');
  }

  if (attendance === ATTENDANCE_VALUES.ATTENDING) {
    if (isNaN(attendeeCount) || attendeeCount < 1) {
      errors.push('Số lượng khách tham dự phải từ 1 người trở lên.');
    } else if (attendeeCount > 10) {
      errors.push('Số lượng khách tối đa là 10 người mỗi nhóm.');
    }
  } else {
    attendeeCount = 0;
  }

  return {
    isValid: errors.length === 0,
    errors,
    data: {
      guest_name: guestName,
      attendance,
      attendee_count: attendeeCount,
      special_requests: specialRequests || null,
      message: message || null,
    },
  };
}

export async function POST(request) {
  try {
    if (isDeadlinePassed()) {
      return NextResponse.json(
        {
          success: false,
          error: `Hạn chót xác nhận tham dự (${WEDDING_EVENT.cutoffDisplay}) đã qua. Xin vui lòng liên hệ trực tiếp cô dâu & chú rể nếu có thay đổi.`,
        },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validation = validatePayload(body);

    if (!validation.isValid) {
      return NextResponse.json(
        { success: false, error: validation.errors.join(' ') },
        { status: 400 }
      );
    }

    const recordId = crypto.randomUUID();
    const nowIso = new Date().toISOString();
    const editToken = crypto.randomUUID();
    const tokenHash = hashToken(editToken);

    // Prepare insert payload supporting both migration schema variants
    const insertPayload = {
      id: recordId,
      guest_name: validation.data.guest_name,
      attendance: validation.data.attendance,
      attendee_count: validation.data.attendee_count,
      special_requests: validation.data.special_requests,
      message: validation.data.message,
      edit_token_hash: tokenHash,
      created_at: nowIso,
      updated_at: nowIso,
    };

    // Attempt insert into rsvps table (insert without select to avoid RLS SELECT violations)
    const { error } = await supabaseServer
      .from('rsvps')
      .insert(insertPayload);

    if (error) {
      console.error('Supabase insert RSVP error:', error);
      const isTableMissing =
        error.code === '42P01' ||
        error.code === 'PGRST205' ||
        error.message?.includes('relation "rsvps" does not exist') ||
        error.message?.includes("Could not find the table 'public.rsvps'");

      if (isTableMissing) {
        return NextResponse.json(
          {
            success: false,
            code: 'TABLE_NOT_FOUND',
            error: 'Bảng dữ liệu RSVP chưa được tạo trong cơ sở dữ liệu Supabase. Vui lòng mở Supabase SQL Editor và chạy file migration trong thư mục supabase/migrations/20260916_create_rsvps_table.sql.',
          },
          { status: 503 }
        );
      }
      return NextResponse.json(
        { success: false, error: error.message || 'Lỗi khi ghi nhận thông tin RSVP.' },
        { status: 500 }
      );
    }

    const canEdit = checkServerCanEdit();
    const normalizedData = {
      id: recordId,
      guest_name: validation.data.guest_name,
      full_name: validation.data.guest_name,
      attendance: validation.data.attendance,
      attendee_count: validation.data.attendee_count,
      special_requests: validation.data.special_requests,
      dietary_notes: validation.data.special_requests,
      message: validation.data.message,
      created_at: nowIso,
      updated_at: nowIso,
    };

    return NextResponse.json(
      {
        success: true,
        message: 'Gửi phản hồi RSVP thành công!',
        data: normalizedData,
        rsvp: normalizedData,
        edit_token: editToken,
        can_edit: canEdit,
        edit_cutoff_at: WEDDING_EVENT.cutoffIso,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error('RSVP POST handler error:', err);
    return NextResponse.json(
      { success: false, error: 'Đã xảy ra lỗi máy chủ. Vui lòng thử lại sau.' },
      { status: 500 }
    );
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Thiếu mã xác thực chỉnh sửa (token).' },
        { status: 400 }
      );
    }

    const tokenHash = hashToken(token);

    // Query by token hash
    let { data, error } = await supabaseServer
      .from('rsvps')
      .select('id, guest_name, attendance, attendee_count, special_requests, message, created_at, updated_at')
      .eq('edit_token_hash', tokenHash)
      .maybeSingle();

    // Fallback query by raw token in case existing schema used edit_token
    if (!data && !error) {
      const fallbackQuery = await supabaseServer
        .from('rsvps')
        .select('id, guest_name, attendance, attendee_count, special_requests, message, created_at, updated_at')
        .eq('edit_token', token)
        .maybeSingle();
      if (fallbackQuery.data) {
        data = fallbackQuery.data;
      }
    }

    if (error) {
      const isTableMissing =
        error.code === '42P01' ||
        error.code === 'PGRST205' ||
        error.message?.includes('relation "rsvps" does not exist') ||
        error.message?.includes("Could not find the table 'public.rsvps'");

      if (isTableMissing) {
        return NextResponse.json(
          {
            success: false,
            code: 'TABLE_NOT_FOUND',
            error: 'Bảng dữ liệu RSVP chưa được tạo trong cơ sở dữ liệu Supabase.',
          },
          { status: 503 }
        );
      }
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json(
        { success: false, error: 'Không tìm thấy phản hồi RSVP tương ứng với mã chỉnh sửa này.' },
        { status: 404 }
      );
    }

    const canEdit = checkServerCanEdit();
    const normalizedData = {
      id: data.id,
      guest_name: data.guest_name,
      full_name: data.guest_name,
      attendance: data.attendance,
      attendee_count: data.attendee_count,
      special_requests: data.special_requests,
      dietary_notes: data.special_requests,
      message: data.message,
      created_at: data.created_at,
      updated_at: data.updated_at,
    };

    return NextResponse.json({
      success: true,
      data: normalizedData,
      rsvp: normalizedData,
      can_edit: canEdit,
      edit_cutoff_at: WEDDING_EVENT.cutoffIso,
    });
  } catch (err) {
    console.error('RSVP GET handler error:', err);
    return NextResponse.json(
      { success: false, error: 'Lỗi khi truy xuất dữ liệu phản hồi.' },
      { status: 500 }
    );
  }
}

export async function PUT(request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Thiếu mã xác thực chỉnh sửa (token).' },
        { status: 400 }
      );
    }

    if (isDeadlinePassed()) {
      return NextResponse.json(
        {
          success: false,
          error: `Hạn chót thay đổi thông tin (${WEDDING_EVENT.cutoffDisplay}) đã qua. Vui lòng liên hệ trực tiếp cô dâu & chú rể nếu có thay đổi khẩn cấp.`,
        },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validation = validatePayload(body);

    if (!validation.isValid) {
      return NextResponse.json(
        { success: false, error: validation.errors.join(' ') },
        { status: 400 }
      );
    }

    const tokenHash = hashToken(token);
    const updatePayload = {
      guest_name: validation.data.guest_name,
      attendance: validation.data.attendance,
      attendee_count: validation.data.attendee_count,
      special_requests: validation.data.special_requests,
      message: validation.data.message,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabaseServer
      .from('rsvps')
      .update(updatePayload)
      .eq('edit_token_hash', tokenHash)
      .select('id, guest_name, attendance, attendee_count, special_requests, message, created_at, updated_at')
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message || 'Không thể cập nhật thông tin RSVP.' },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { success: false, error: 'Không tìm thấy phản hồi phù hợp với mã xác thực này.' },
        { status: 404 }
      );
    }

    const canEdit = checkServerCanEdit();
    const normalizedData = {
      id: data.id,
      guest_name: data.guest_name,
      full_name: data.guest_name,
      attendance: data.attendance,
      attendee_count: data.attendee_count,
      special_requests: data.special_requests,
      dietary_notes: data.special_requests,
      message: data.message,
      created_at: data.created_at,
      updated_at: data.updated_at,
    };

    return NextResponse.json({
      success: true,
      message: 'Cập nhật phản hồi thành công!',
      data: normalizedData,
      rsvp: normalizedData,
      can_edit: canEdit,
      edit_cutoff_at: WEDDING_EVENT.cutoffIso,
    });
  } catch (err) {
    console.error('RSVP PUT handler error:', err);
    return NextResponse.json(
      { success: false, error: 'Lỗi khi cập nhật dữ liệu phản hồi.' },
      { status: 500 }
    );
  }
}
