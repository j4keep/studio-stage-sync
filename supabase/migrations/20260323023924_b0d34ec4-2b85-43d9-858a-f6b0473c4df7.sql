
DROP FUNCTION IF EXISTS public.increment_post_views(uuid);
DROP FUNCTION IF EXISTS public.increment_battle_views(uuid);
DROP FUNCTION IF EXISTS public.increment_song_plays(uuid);
DROP FUNCTION IF EXISTS public.increment_video_views(uuid);
DROP FUNCTION IF EXISTS public.increment_podcast_plays(uuid);

CREATE FUNCTION public.increment_post_views(post_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  INSERT INTO content_views (user_id, content_id, content_type)
  VALUES (auth.uid(), post_id, 'post')
  ON CONFLICT (user_id, content_id, content_type) DO NOTHING;
  UPDATE posts SET views = (SELECT count(*) FROM content_views WHERE content_id = post_id AND content_type = 'post') WHERE id = post_id;
END;
$$;

CREATE FUNCTION public.increment_battle_views(battle_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  INSERT INTO content_views (user_id, content_id, content_type)
  VALUES (auth.uid(), battle_id, 'battle')
  ON CONFLICT (user_id, content_id, content_type) DO NOTHING;
  UPDATE battles SET views = (SELECT count(*) FROM content_views WHERE content_id = battle_id AND content_type = 'battle') WHERE id = battle_id;
END;
$$;

CREATE FUNCTION public.increment_song_plays(song_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  INSERT INTO content_views (user_id, content_id, content_type)
  VALUES (auth.uid(), song_id, 'song')
  ON CONFLICT (user_id, content_id, content_type) DO NOTHING;
  UPDATE songs SET plays = (SELECT count(*) FROM content_views WHERE content_id = song_id AND content_type = 'song')::text WHERE id = song_id;
END;
$$;

CREATE FUNCTION public.increment_video_views(video_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  INSERT INTO content_views (user_id, content_id, content_type)
  VALUES (auth.uid(), video_id, 'video')
  ON CONFLICT (user_id, content_id, content_type) DO NOTHING;
  UPDATE videos SET views = (SELECT count(*) FROM content_views WHERE content_id = video_id AND content_type = 'video')::text WHERE id = video_id;
END;
$$;

CREATE FUNCTION public.increment_podcast_plays(podcast_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  INSERT INTO content_views (user_id, content_id, content_type)
  VALUES (auth.uid(), podcast_id, 'podcast')
  ON CONFLICT (user_id, content_id, content_type) DO NOTHING;
  UPDATE podcasts SET plays = (SELECT count(*) FROM content_views WHERE content_id = podcast_id AND content_type = 'podcast')::text WHERE id = podcast_id;
END;
$$;
