
CREATE TABLE public.sound_library (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL,
  genre text DEFAULT '',
  pack text DEFAULT 'My Library',
  bpm integer DEFAULT 120,
  musical_key text DEFAULT '',
  tags text[] DEFAULT '{}'::text[],
  r2_key text NOT NULL,
  duration_sec numeric DEFAULT 0,
  color text DEFAULT '#06b6d4',
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sound_library TO authenticated;
GRANT ALL ON public.sound_library TO service_role;

ALTER TABLE public.sound_library ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Signed-in users can view active sounds"
  ON public.sound_library FOR SELECT
  TO authenticated
  USING (is_active = true OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert sounds"
  ON public.sound_library FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update sounds"
  ON public.sound_library FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete sounds"
  ON public.sound_library FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_sound_library_updated_at
  BEFORE UPDATE ON public.sound_library
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_sound_library_category ON public.sound_library(category) WHERE is_active = true;
CREATE INDEX idx_sound_library_pack ON public.sound_library(pack) WHERE is_active = true;
