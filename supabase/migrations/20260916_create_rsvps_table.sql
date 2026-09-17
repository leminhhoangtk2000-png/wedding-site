-- Migration: Create rsvps table for wedding guest attendance tracking
-- Date: 2026-09-16
-- Description: Stores guest RSVP responses with edit tokens and constraints

CREATE TABLE IF NOT EXISTS public.rsvps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    guest_name VARCHAR(100) NOT NULL,
    attendance VARCHAR(20) NOT NULL CHECK (attendance IN ('attending', 'declined')),
    attendee_count INTEGER NOT NULL DEFAULT 1 CHECK (
        (attendance = 'attending' AND attendee_count >= 1) OR 
        (attendance = 'declined' AND attendee_count = 0)
    ),
    special_requests VARCHAR(500),
    message VARCHAR(1000),
    edit_token_hash VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Index for searching and filtering
CREATE INDEX IF NOT EXISTS idx_rsvps_attendance ON public.rsvps (attendance);
CREATE INDEX IF NOT EXISTS idx_rsvps_created_at ON public.rsvps (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rsvps_guest_name ON public.rsvps (guest_name);
CREATE INDEX IF NOT EXISTS idx_rsvps_token_hash ON public.rsvps (edit_token_hash);

-- Enable Row Level Security
ALTER TABLE public.rsvps ENABLE ROW LEVEL SECURITY;

-- Note on RLS: Public anonymous clients MUST NOT be able to select all RSVP records.
-- Reading must only happen through server API / RPC using the edit_token_hash, or by authenticated admin.
CREATE POLICY "Allow public insert via API" ON public.rsvps
    FOR INSERT 
    WITH CHECK (true);

-- Authenticated admins can view, update, and delete
CREATE POLICY "Allow authenticated admin full access" ON public.rsvps
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);
