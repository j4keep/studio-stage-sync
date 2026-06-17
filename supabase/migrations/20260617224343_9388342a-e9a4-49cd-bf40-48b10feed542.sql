
CREATE TABLE public.podcast_episodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Untitled Episode',
  description text,
  cover_url text,
  status text NOT NULL DEFAULT 'lobby', -- lobby | live | processing | ready | archived
  livekit_room text NOT NULL UNIQUE,
  scheduled_at timestamptz,
  started_at timestamptz,
  ended_at timestamptz,
  duration_seconds integer,
  is_streaming boolean NOT NULL DEFAULT false,
  visibility text NOT NULL DEFAULT 'private',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.podcast_episodes TO authenticated;
GRANT ALL ON public.podcast_episodes TO service_role;
ALTER TABLE public.podcast_episodes ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.podcast_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id uuid NOT NULL REFERENCES public.podcast_episodes(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  display_name text NOT NULL,
  role text NOT NULL DEFAULT 'guest', -- host | cohost | guest | producer
  invite_token text NOT NULL UNIQUE DEFAULT replace(gen_random_uuid()::text,'-',''),
  joined_at timestamptz,
  left_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX podcast_participants_episode_idx ON public.podcast_participants(episode_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.podcast_participants TO authenticated;
GRANT ALL ON public.podcast_participants TO service_role;
ALTER TABLE public.podcast_participants ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.podcast_recordings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id uuid NOT NULL REFERENCES public.podcast_episodes(id) ON DELETE CASCADE,
  participant_id uuid REFERENCES public.podcast_participants(id) ON DELETE SET NULL,
  uploader_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  track_kind text NOT NULL DEFAULT 'av', -- av | audio | video | screen
  mime_type text NOT NULL DEFAULT 'video/webm',
  duration_seconds numeric,
  byte_size bigint,
  chunk_count integer NOT NULL DEFAULT 0,
  r2_prefix text NOT NULL, -- podcast/{episodeId}/{participantId}/
  status text NOT NULL DEFAULT 'recording', -- recording | uploaded | finalized | failed
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX podcast_recordings_episode_idx ON public.podcast_recordings(episode_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.podcast_recordings TO authenticated;
GRANT ALL ON public.podcast_recordings TO service_role;
ALTER TABLE public.podcast_recordings ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.podcast_clips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id uuid NOT NULL REFERENCES public.podcast_episodes(id) ON DELETE CASCADE,
  title text,
  start_seconds numeric NOT NULL,
  end_seconds numeric NOT NULL,
  r2_key text,
  format text NOT NULL DEFAULT '16x9',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX podcast_clips_episode_idx ON public.podcast_clips(episode_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.podcast_clips TO authenticated;
GRANT ALL ON public.podcast_clips TO service_role;
ALTER TABLE public.podcast_clips ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.podcast_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id uuid NOT NULL REFERENCES public.podcast_episodes(id) ON DELETE CASCADE,
  sender_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  sender_name text NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX podcast_chat_episode_idx ON public.podcast_chat_messages(episode_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.podcast_chat_messages TO authenticated;
GRANT ALL ON public.podcast_chat_messages TO service_role;
ALTER TABLE public.podcast_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.podcast_stream_destinations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id uuid NOT NULL REFERENCES public.podcast_episodes(id) ON DELETE CASCADE,
  platform text NOT NULL, -- youtube | twitch | custom
  rtmp_url text NOT NULL,
  stream_key text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX podcast_dest_episode_idx ON public.podcast_stream_destinations(episode_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.podcast_stream_destinations TO authenticated;
GRANT ALL ON public.podcast_stream_destinations TO service_role;
ALTER TABLE public.podcast_stream_destinations ENABLE ROW LEVEL SECURITY;

-- updated_at trigger
CREATE TRIGGER trg_podcast_episodes_updated BEFORE UPDATE ON public.podcast_episodes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_podcast_recordings_updated BEFORE UPDATE ON public.podcast_recordings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Helper: check if user is participant of episode
CREATE OR REPLACE FUNCTION public.is_podcast_participant(_episode uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (SELECT 1 FROM public.podcast_participants WHERE episode_id=_episode AND user_id=_user)
$$;

-- Policies: episodes
CREATE POLICY "host manages episodes" ON public.podcast_episodes
  FOR ALL USING (auth.uid() = host_user_id) WITH CHECK (auth.uid() = host_user_id);
CREATE POLICY "participants view episodes" ON public.podcast_episodes
  FOR SELECT USING (public.is_podcast_participant(id, auth.uid()));

-- Policies: participants
CREATE POLICY "host manages participants" ON public.podcast_participants
  FOR ALL USING (EXISTS (SELECT 1 FROM public.podcast_episodes e WHERE e.id=episode_id AND e.host_user_id=auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.podcast_episodes e WHERE e.id=episode_id AND e.host_user_id=auth.uid()));
CREATE POLICY "participants view roster" ON public.podcast_participants
  FOR SELECT USING (public.is_podcast_participant(episode_id, auth.uid()));

-- Policies: recordings
CREATE POLICY "host views recordings" ON public.podcast_recordings
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.podcast_episodes e WHERE e.id=episode_id AND e.host_user_id=auth.uid()));
CREATE POLICY "uploader manages own recording" ON public.podcast_recordings
  FOR ALL USING (uploader_user_id = auth.uid()) WITH CHECK (uploader_user_id = auth.uid());

-- Policies: clips
CREATE POLICY "host manages clips" ON public.podcast_clips
  FOR ALL USING (EXISTS (SELECT 1 FROM public.podcast_episodes e WHERE e.id=episode_id AND e.host_user_id=auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.podcast_episodes e WHERE e.id=episode_id AND e.host_user_id=auth.uid()));

-- Policies: chat
CREATE POLICY "participants read chat" ON public.podcast_chat_messages
  FOR SELECT USING (public.is_podcast_participant(episode_id, auth.uid())
    OR EXISTS (SELECT 1 FROM public.podcast_episodes e WHERE e.id=episode_id AND e.host_user_id=auth.uid()));
CREATE POLICY "participants post chat" ON public.podcast_chat_messages
  FOR INSERT WITH CHECK (sender_user_id = auth.uid()
    AND (public.is_podcast_participant(episode_id, auth.uid())
      OR EXISTS (SELECT 1 FROM public.podcast_episodes e WHERE e.id=episode_id AND e.host_user_id=auth.uid())));

-- Policies: stream destinations
CREATE POLICY "host manages destinations" ON public.podcast_stream_destinations
  FOR ALL USING (EXISTS (SELECT 1 FROM public.podcast_episodes e WHERE e.id=episode_id AND e.host_user_id=auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.podcast_episodes e WHERE e.id=episode_id AND e.host_user_id=auth.uid()));
