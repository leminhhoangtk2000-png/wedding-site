-- Migration: Add arrival_time column to rsvps table
-- Date: 2026-09-23
-- Description: Stores the estimated attendance/arrival time selected by wedding guests

ALTER TABLE public.rsvps 
ADD COLUMN IF NOT EXISTS arrival_time VARCHAR(50);

COMMENT ON COLUMN public.rsvps.arrival_time IS 'Estimated arrival/attendance time of guest (e.g. 16:00, 17:00 - 17:30, 18:00 - 18:30)';
