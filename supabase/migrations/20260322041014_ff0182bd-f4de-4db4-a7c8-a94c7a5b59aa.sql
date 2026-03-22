
ALTER TABLE public.likes DROP CONSTRAINT likes_content_type_check;
ALTER TABLE public.likes ADD CONSTRAINT likes_content_type_check CHECK (content_type = ANY (ARRAY['song'::text, 'video'::text, 'podcast'::text, 'post'::text]));
