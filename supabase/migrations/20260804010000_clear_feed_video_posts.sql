-- One-shot cleanup: remove all video posts from the homepage Posts / Reels rails.
-- Image reels and battle cards are left alone. post_comments cascade via FK.

DELETE FROM public.likes
WHERE content_type = 'post'
  AND content_id IN (
    SELECT id FROM public.posts WHERE media_type = 'video'
  );

DELETE FROM public.posts
WHERE media_type = 'video';
