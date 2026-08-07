CREATE TABLE public.event_listings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  title text not null,
  description text,
  category text not null default 'other',
  media_url text,
  media_type text not null default 'image',
  address text,
  map_url text,
  price_cents integer,
  starts_at timestamptz,
  ends_at timestamptz,
  expires_at timestamptz,
  capacity integer,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_listings TO authenticated;
GRANT SELECT ON public.event_listings TO anon;
GRANT ALL ON public.event_listings TO service_role;
ALTER TABLE public.event_listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Events are publicly viewable" ON public.event_listings FOR SELECT USING (true);
CREATE POLICY "Users can create their own events" ON public.event_listings FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owners can update their events" ON public.event_listings FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Owners can delete their events" ON public.event_listings FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER trg_event_listings_updated BEFORE UPDATE ON public.event_listings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.event_rsvps (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.event_listings(id) on delete cascade,
  user_id uuid not null,
  status text not null default 'going',
  created_at timestamptz not null default now(),
  unique (event_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_rsvps TO authenticated;
GRANT ALL ON public.event_rsvps TO service_role;
ALTER TABLE public.event_rsvps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can see their own rsvp" ON public.event_rsvps FOR SELECT TO authenticated
USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.event_listings e WHERE e.id = event_id AND e.user_id = auth.uid()));
CREATE POLICY "Users can rsvp" ON public.event_rsvps FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can remove their rsvp" ON public.event_rsvps FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX idx_event_rsvps_event ON public.event_rsvps(event_id);
CREATE INDEX idx_event_listings_starts ON public.event_listings(starts_at);