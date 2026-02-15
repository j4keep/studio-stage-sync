
-- Add theme customization columns to profiles
ALTER TABLE public.profiles
ADD COLUMN theme_preset TEXT DEFAULT 'default',
ADD COLUMN custom_accent_color TEXT,
ADD COLUMN background_image_url TEXT;
