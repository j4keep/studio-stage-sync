
ALTER TABLE public.battles ADD COLUMN IF NOT EXISTS expires_at timestamp with time zone;

-- Set default: 24 hours from creation
UPDATE public.battles SET expires_at = created_at + interval '24 hours' WHERE expires_at IS NULL;

-- Create a validation trigger for future rows
CREATE OR REPLACE FUNCTION public.set_battle_expiry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.expires_at IS NULL THEN
    NEW.expires_at := NEW.created_at + interval '24 hours';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_battle_expiry_trigger
  BEFORE INSERT ON public.battles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_battle_expiry();
