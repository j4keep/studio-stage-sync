-- Enforce Meet on YAJ 18+ birth year on profiles that are visible
-- (null / under-18 birth years cannot stay publicly listed)

UPDATE public.meet_profiles
SET is_visible = false
WHERE birth_year IS NULL
   OR birth_year > (EXTRACT(YEAR FROM CURRENT_DATE)::int - 18);

ALTER TABLE public.meet_profiles
  DROP CONSTRAINT IF EXISTS meet_profiles_adult_birth_year;

ALTER TABLE public.meet_profiles
  ADD CONSTRAINT meet_profiles_adult_birth_year
  CHECK (
    birth_year IS NULL
    OR (
      birth_year >= 1900
      AND birth_year <= (EXTRACT(YEAR FROM CURRENT_DATE)::int - 18)
    )
  );
