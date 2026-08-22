
-- Cross-game character skin tone preference (applies to the illustrated avatar used by
-- Obby, Survival Island, Neighborhood Adventure, Treasure Rush, City Run, Tower Escape,
-- and Fleet Clash).
ALTER TABLE public.profiles
ADD COLUMN character_skin_tone TEXT;
