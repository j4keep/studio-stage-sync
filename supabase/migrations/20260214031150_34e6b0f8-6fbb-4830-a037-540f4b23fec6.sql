
-- Add radio publishing columns to songs table
ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS on_radio BOOLEAN DEFAULT false;
ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS genre TEXT;
