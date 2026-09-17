-- Migration: Add SELECT, UPDATE, and DELETE policies for rsvps table
-- Run this in Supabase SQL Editor if you are not using SUPABASE_SERVICE_ROLE_KEY

CREATE POLICY "Allow public select on rsvps" ON public.rsvps
    FOR SELECT
    USING (true);

CREATE POLICY "Allow public update on rsvps" ON public.rsvps
    FOR UPDATE
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow public delete on rsvps" ON public.rsvps
    FOR DELETE
    USING (true);
