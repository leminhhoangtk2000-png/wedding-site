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
  const arrivalTime = (body.arrival_time || body.attendance_time || '').trim().slice(0, 50);
  const specialRequests = (body.special_requests || body.dietary_notes || '').trim().slice(0, 500);
  const message = (body.message || body.wishes || '').trim().slice(0, 1000);

  if (!guestName || guestName.length < 2) {
    errors.push('Please enter your full name (at least 2 characters).');
  }

  if (attendance !== ATTENDANCE_VALUES.ATTENDING && attendance !== ATTENDANCE_VALUES.DECLINED) {
    errors.push('Please select whether you will attend or send regrets.');
  }

  if (attendance === ATTENDANCE_VALUES.ATTENDING) {
    if (isNaN(attendeeCount) || attendeeCount < 1) {
      errors.push('Guest count must be at least 1.');
    } else if (attendeeCount > 10) {
      errors.push('Maximum 10 guests allowed per party.');
    }
    if (!arrivalTime) {
      errors.push('Please select your expected arrival time.');
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
      arrival_time: attendance === ATTENDANCE_VALUES.ATTENDING && arrivalTime ? arrivalTime : null,
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
          error: `The RSVP deadline (${WEDDING_EVENT.cutoffDisplay}) has passed. Please contact the bride & groom directly for any adjustments.`,
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

    if (validation.data.arrival_time) {
      insertPayload.arrival_time = validation.data.arrival_time;
    }

    // Attempt insert into rsvps table (insert without select to avoid RLS SELECT violations)
    let { error } = await supabaseServer
      .from('rsvps')
      .insert(insertPayload);

    // Fallback: If arrival_time column does not exist yet on Supabase
    if (
      error &&
      (error.code === '42703' ||
        error.code === 'PGRST204' ||
        error.message?.includes('arrival_time') ||
        error.details?.includes('arrival_time'))
    ) {
      delete insertPayload.arrival_time;
      if (validation.data.arrival_time) {
        insertPayload.special_requests = `[Có mặt: ${validation.data.arrival_time}] ${validation.data.special_requests || ''}`.trim();
      }
      const retry = await supabaseServer.from('rsvps').insert(insertPayload);
      error = retry.error;
    }

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
            error: 'The RSVP database table has not been initialized yet in Supabase.',
          },
          { status: 503 }
        );
      }
      return NextResponse.json(
        { success: false, error: error.message || 'An error occurred while recording your RSVP.' },
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
      arrival_time: validation.data.arrival_time,
      special_requests: validation.data.special_requests,
      dietary_notes: validation.data.special_requests,
      message: validation.data.message,
      created_at: nowIso,
      updated_at: nowIso,
    };

    return NextResponse.json(
      {
        success: true,
        message: 'RSVP submitted successfully!',
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
      { success: false, error: 'A server error occurred. Please try again later.' },
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
        { success: false, error: 'Missing edit verification token.' },
        { status: 400 }
      );
    }

    const tokenHash = hashToken(token);

    // Query by token hash
    let { data, error } = await supabaseServer
      .from('rsvps')
      .select('*')
      .eq('edit_token_hash', tokenHash)
      .maybeSingle();

    // Fallback query by raw token in case existing schema used edit_token
    if (!data && !error) {
      const fallbackQuery = await supabaseServer
        .from('rsvps')
        .select('*')
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
            error: 'The RSVP database table has not been initialized yet in Supabase.',
          },
          { status: 503 }
        );
      }
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json(
        { success: false, error: 'No RSVP response found matching this edit token.' },
        { status: 404 }
      );
    }

    let parsedArrivalTime = data.arrival_time || null;
    let cleanSpecialRequests = data.special_requests;
    if (!parsedArrivalTime && cleanSpecialRequests && cleanSpecialRequests.startsWith('[Có mặt: ')) {
      const match = cleanSpecialRequests.match(/^\[Có mặt: ([^\]]+)\]\s*/);
      if (match) {
        parsedArrivalTime = match[1];
        cleanSpecialRequests = cleanSpecialRequests.replace(/^\[Có mặt: [^\]]+\]\s*/, '') || null;
      }
    }

    const canEdit = checkServerCanEdit();
    const normalizedData = {
      id: data.id,
      guest_name: data.guest_name,
      full_name: data.guest_name,
      attendance: data.attendance,
      attendee_count: data.attendee_count,
      arrival_time: parsedArrivalTime,
      special_requests: cleanSpecialRequests,
      dietary_notes: cleanSpecialRequests,
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
      { success: false, error: 'An error occurred while retrieving your RSVP response.' },
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
        { success: false, error: 'Missing edit verification token.' },
        { status: 400 }
      );
    }

    if (isDeadlinePassed()) {
      return NextResponse.json(
        {
          success: false,
          error: `The deadline to modify your RSVP (${WEDDING_EVENT.cutoffDisplay}) has passed. Please contact the bride & groom directly for any adjustments.`,
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

    if (validation.data.arrival_time) {
      updatePayload.arrival_time = validation.data.arrival_time;
    }

    let { data, error } = await supabaseServer
      .from('rsvps')
      .update(updatePayload)
      .eq('edit_token_hash', tokenHash)
      .select('*')
      .maybeSingle();

    // Fallback: If arrival_time column does not exist yet on Supabase
    if (
      error &&
      (error.code === '42703' ||
        error.code === 'PGRST204' ||
        error.message?.includes('arrival_time') ||
        error.details?.includes('arrival_time'))
    ) {
      delete updatePayload.arrival_time;
      if (validation.data.arrival_time) {
        updatePayload.special_requests = `[Có mặt: ${validation.data.arrival_time}] ${validation.data.special_requests || ''}`.trim();
      }
      const retry = await supabaseServer
        .from('rsvps')
        .update(updatePayload)
        .eq('edit_token_hash', tokenHash)
        .select('*')
        .maybeSingle();
      data = retry.data;
      error = retry.error;
    }

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message || 'Unable to update RSVP details.' },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { success: false, error: 'No RSVP response found matching this verification token.' },
        { status: 404 }
      );
    }

    let parsedArrivalTime = data.arrival_time || null;
    let cleanSpecialRequests = data.special_requests;
    if (!parsedArrivalTime && cleanSpecialRequests && cleanSpecialRequests.startsWith('[Có mặt: ')) {
      const match = cleanSpecialRequests.match(/^\[Có mặt: ([^\]]+)\]\s*/);
      if (match) {
        parsedArrivalTime = match[1];
        cleanSpecialRequests = cleanSpecialRequests.replace(/^\[Có mặt: [^\]]+\]\s*/, '') || null;
      }
    }

    const canEdit = checkServerCanEdit();
    const normalizedData = {
      id: data.id,
      guest_name: data.guest_name,
      full_name: data.guest_name,
      attendance: data.attendance,
      attendee_count: data.attendee_count,
      arrival_time: parsedArrivalTime,
      special_requests: cleanSpecialRequests,
      dietary_notes: cleanSpecialRequests,
      message: data.message,
      created_at: data.created_at,
      updated_at: data.updated_at,
    };

    return NextResponse.json({
      success: true,
      message: 'RSVP updated successfully!',
      data: normalizedData,
      rsvp: normalizedData,
      can_edit: canEdit,
      edit_cutoff_at: WEDDING_EVENT.cutoffIso,
    });
  } catch (err) {
    console.error('RSVP PUT handler error:', err);
    return NextResponse.json(
      { success: false, error: 'An error occurred while updating your RSVP response.' },
      { status: 500 }
    );
  }
}
