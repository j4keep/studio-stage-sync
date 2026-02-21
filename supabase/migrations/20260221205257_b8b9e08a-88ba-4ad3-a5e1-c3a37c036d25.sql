
-- Create news_articles table
CREATE TABLE public.news_articles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  author_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'Featured',
  cover_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  is_free BOOLEAN NOT NULL DEFAULT true,
  published_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.news_articles ENABLE ROW LEVEL SECURITY;

-- Everyone can read published articles
CREATE POLICY "Published articles are viewable by everyone"
ON public.news_articles FOR SELECT
USING (status = 'published');

-- Authors can see their own articles (any status)
CREATE POLICY "Authors can view own articles"
ON public.news_articles FOR SELECT
USING (auth.uid() = author_id);

-- Authenticated users can insert articles
CREATE POLICY "Authenticated users can create articles"
ON public.news_articles FOR INSERT
WITH CHECK (auth.uid() = author_id);

-- Authors can update their own articles
CREATE POLICY "Authors can update own articles"
ON public.news_articles FOR UPDATE
USING (auth.uid() = author_id);

-- Authors can delete their own articles
CREATE POLICY "Authors can delete own articles"
ON public.news_articles FOR DELETE
USING (auth.uid() = author_id);

-- Trigger for updated_at
CREATE TRIGGER update_news_articles_updated_at
BEFORE UPDATE ON public.news_articles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.news_articles;
