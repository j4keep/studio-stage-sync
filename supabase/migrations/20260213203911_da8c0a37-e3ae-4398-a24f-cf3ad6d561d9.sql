
-- Songs table
CREATE TABLE public.songs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  duration TEXT,
  plays TEXT DEFAULT '0',
  cover_url TEXT,
  audio_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.songs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own songs" ON public.songs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own songs" ON public.songs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own songs" ON public.songs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own songs" ON public.songs FOR DELETE USING (auth.uid() = user_id);

-- Videos table
CREATE TABLE public.videos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  duration TEXT,
  views TEXT DEFAULT '0',
  cover_url TEXT,
  video_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own videos" ON public.videos FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own videos" ON public.videos FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own videos" ON public.videos FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own videos" ON public.videos FOR DELETE USING (auth.uid() = user_id);

-- Podcasts table
CREATE TABLE public.podcasts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  episode TEXT DEFAULT 'New Episode',
  duration TEXT,
  plays TEXT DEFAULT '0',
  cover_url TEXT,
  media_url TEXT,
  is_video BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.podcasts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own podcasts" ON public.podcasts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own podcasts" ON public.podcasts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own podcasts" ON public.podcasts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own podcasts" ON public.podcasts FOR DELETE USING (auth.uid() = user_id);

-- Projects table
CREATE TABLE public.projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  goal INTEGER DEFAULT 1000,
  raised INTEGER DEFAULT 0,
  backers INTEGER DEFAULT 0,
  deadline TEXT,
  cover_url TEXT,
  categories TEXT[] DEFAULT '{}',
  tiers TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own projects" ON public.projects FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own projects" ON public.projects FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own projects" ON public.projects FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own projects" ON public.projects FOR DELETE USING (auth.uid() = user_id);
