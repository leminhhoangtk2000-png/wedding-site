import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';
import { ATTENDANCE_VALUES } from '@/lib/rsvpConstants';

function checkAdminAuth(request) {
  const headerPassword = request.headers.get('x-admin-password');
  const validPassword = process.env.ADMIN_PASSWORD || '696969';
  return Boolean(headerPassword && headerPassword === validPassword);
}

export async function GET(request) {
  try {
    if (!checkAdminAuth(request)) {
      return NextResponse.json(
        { success: false, error: 'Chưa được xác thực quyền quản trị viên.' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search')?.trim() || '';
    const attendanceFilter = searchParams.get('attendance') || 'all';
    const sort = searchParams.get('sort') || 'newest';

    // Fetch all records for metrics calculation
    const { data: allData, error: metricsError } = await supabaseServer
      .from('rsvps')
      .select('*')
      .order('created_at', { ascending: false });

    if (metricsError) {
      console.error('Admin RSVP fetch error:', metricsError);
      const isTableMissing =
        metricsError.code === '42P01' ||
        metricsError.code === 'PGRST205' ||
        metricsError.message?.includes('relation "rsvps" does not exist') ||
        metricsError.message?.includes("Could not find the table 'public.rsvps'");

      if (isTableMissing) {
        return NextResponse.json(
          {
            success: false,
            code: 'TABLE_NOT_FOUND',
            error: 'Bảng "rsvps" chưa được khởi tạo trên Supabase. Vui lòng mở SQL Editor và chạy file migration trong thư mục supabase/migrations/20260916_create_rsvps_table.sql.',
            metrics: {
              total_responses: 0,
              total_attending_parties: 0,
              total_expected_attendees: 0,
              total_declined_parties: 0,
              total_special_requests: 0,
            },
            rsvps: [],
          },
          { status: 503 }
        );
      }
      return NextResponse.json(
        { success: false, error: metricsError.message || 'Lỗi khi tải dữ liệu RSVP.' },
        { status: 500 }
      );
    }

    // Normalize raw list so guest_name and dietary_notes are consistent
    const rawList = (allData || []).map((item) => {
      const name = item.guest_name || item.full_name || '';
      const notes = item.special_requests || item.dietary_notes || '';
      const safeItem = {
        id: item.id,
        guest_name: name,
        full_name: name,
        attendance: item.attendance,
        attendee_count: Number(item.attendee_count) || 0,
        special_requests: notes || null,
        dietary_notes: notes || null,
        message: item.message || null,
        created_at: item.created_at,
        updated_at: item.updated_at,
      };
      return safeItem;
    });

    // Truthful metrics derived directly from persisted data
    const total_responses = rawList.length;
    let total_attending_parties = 0;
    let total_expected_attendees = 0;
    let total_declined_parties = 0;
    let total_special_requests = 0;

    for (const item of rawList) {
      if (item.attendance === ATTENDANCE_VALUES.ATTENDING) {
        total_attending_parties += 1;
        total_expected_attendees += Number(item.attendee_count || 1);
        if (item.dietary_notes && item.dietary_notes.trim().length > 0) {
          total_special_requests += 1;
        }
      } else if (item.attendance === ATTENDANCE_VALUES.DECLINED) {
        total_declined_parties += 1;
      }
    }

    // Apply client filters
    let filteredList = [...rawList];

    if (search) {
      const lower = search.toLowerCase();
      filteredList = filteredList.filter((item) => {
        const nameMatch = item.full_name?.toLowerCase().includes(lower);
        const notesMatch = item.dietary_notes?.toLowerCase().includes(lower);
        const messageMatch = item.message?.toLowerCase().includes(lower);
        return nameMatch || notesMatch || messageMatch;
      });
    }

    if (attendanceFilter && attendanceFilter !== 'all') {
      if (attendanceFilter === 'special_requests') {
        filteredList = filteredList.filter((item) => item.dietary_notes && item.dietary_notes.trim().length > 0);
      } else {
        filteredList = filteredList.filter((item) => item.attendance === attendanceFilter);
      }
    }

    // Sort list
    if (sort === 'oldest') {
      filteredList.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    } else if (sort === 'name_asc') {
      filteredList.sort((a, b) => (a.full_name || '').localeCompare(b.full_name || '', 'vi'));
    } else if (sort === 'attendees_desc') {
      filteredList.sort((a, b) => (b.attendee_count || 0) - (a.attendee_count || 0));
    } else {
      // Default 'newest'
      filteredList.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }

    return NextResponse.json({
      success: true,
      metrics: {
        total_responses,
        total_attending_parties,
        total_expected_attendees,
        total_declined_parties,
        total_special_requests,
      },
      rsvps: filteredList,
    });
  } catch (err) {
    console.error('Admin RSVP route error:', err);
    return NextResponse.json(
      { success: false, error: 'Đã xảy ra sự cố phía máy chủ.' },
      { status: 500 }
    );
  }
}

export async function PATCH(request) {
  try {
    if (!checkAdminAuth(request)) {
      return NextResponse.json(
        { success: false, error: 'Chưa được xác thực quyền quản trị viên.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { id, full_name, guest_name, attendance, attendee_count, dietary_notes, special_requests, message } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'Thiếu ID của phản hồi cần sửa.' }, { status: 400 });
    }

    const updates = {
      updated_at: new Date().toISOString(),
    };

    const rawName = guest_name || full_name;
    if (typeof rawName === 'string') {
      updates.guest_name = rawName.trim();
    }

    if (attendance) {
      updates.attendance = attendance;
      if (attendance === ATTENDANCE_VALUES.DECLINED) {
        updates.attendee_count = 0;
      }
    }

    if (typeof attendee_count !== 'undefined') {
      const parsed = parseInt(attendee_count, 10);
      updates.attendee_count = isNaN(parsed) ? 1 : Math.max(0, parsed);
    }

    const rawNotes = special_requests || dietary_notes;
    if (typeof rawNotes !== 'undefined') {
      updates.special_requests = rawNotes ? rawNotes.trim() : null;
    }

    if (typeof message !== 'undefined') {
      updates.message = message ? message.trim() : null;
    }

    const { data, error } = await supabaseServer
      .from('rsvps')
      .update(updates)
      .eq('id', id)
      .select('id, guest_name, attendance, attendee_count, special_requests, message, created_at, updated_at')
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const name = data.guest_name || '';
    const notes = data.special_requests || '';
    const normalizedData = {
      ...data,
      full_name: name,
      dietary_notes: notes,
    };

    return NextResponse.json({ success: true, data: normalizedData });
  } catch (err) {
    console.error('Admin RSVP PATCH error:', err);
    return NextResponse.json({ success: false, error: 'Lỗi khi cập nhật RSVP.' }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    if (!checkAdminAuth(request)) {
      return NextResponse.json(
        { success: false, error: 'Chưa được xác thực quyền quản trị viên.' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'Thiếu ID phản hồi cần xoá.' }, { status: 400 });
    }

    const { error } = await supabaseServer
      .from('rsvps')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Đã xoá phản hồi RSVP thành công.' });
  } catch (err) {
    console.error('Admin RSVP DELETE error:', err);
    return NextResponse.json({ success: false, error: 'Lỗi khi xoá RSVP.' }, { status: 500 });
  }
}
