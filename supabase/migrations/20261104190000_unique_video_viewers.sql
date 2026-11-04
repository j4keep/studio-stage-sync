-- YAJ: authenticated unique video viewers, shared by Feed, Happening, Profile,
-- standalone Videos and Circle. Apply to YAJ Supabase before shipping the UI.
-- Historic views cannot be deduplicated without old viewer identities.
--
-- The unique-view tables have RLS; users may only insert their own viewer ID
-- for videos they can read, never an arbitrary count. Security-invoker RPCs
-- cannot update someone else's video totals. Internal AFTER INSERT triggers
-- update the counters exactly once per new (content, viewer) pair.

create table if not exists public.post_unique_video_views (
  post_id uuid not null references public.posts(id) on delete cascade,
  viewer_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(post_id, viewer_id)
);
create table if not exists public.circle_unique_video_views (
  content_id uuid not null references public.circle_contents(id) on delete cascade,
  viewer_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(content_id, viewer_id)
);
create table if not exists public.standalone_unique_video_views (
  video_id uuid not null references public.videos(id) on delete cascade,
  viewer_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(video_id, viewer_id)
);
alter table public.post_unique_video_views enable row level security;
alter table public.circle_unique_video_views enable row level security;
alter table public.standalone_unique_video_views enable row level security;

create policy "View own unique post views" on public.post_unique_video_views
  for select to authenticated using (viewer_id = (select auth.uid()));
create policy "Create a unique view on an accessible post video"
  on public.post_unique_video_views for insert to authenticated
  with check (
    viewer_id = (select auth.uid())
    and exists (select 1 from public.posts p where p.id = post_id
                and p.user_id <> (select auth.uid()) and p.media_type = 'video')
  );

create policy "View own unique Circle views" on public.circle_unique_video_views
  for select to authenticated using (viewer_id = (select auth.uid()));
create policy "Create a unique view on an accessible Circle video"
  on public.circle_unique_video_views for insert to authenticated
  with check (
    viewer_id = (select auth.uid())
    and exists (select 1 from public.circle_contents c where c.id = content_id
                and c.author_id <> (select auth.uid()) and c.media_type = 'video'
                and (
                  c.visibility = 'public_in_circle'
                  or (c.visibility = 'circle_members' and
                      public.is_social_circle_member(c.circle_id, auth.uid()))
                  or (c.visibility = 'paid_members' and exists (
                    select 1 from public.circle_members m
                    where m.circle_id = c.circle_id
                      and m.user_id = auth.uid()
                      and m.status = 'approved'
                      and m.role in ('owner', 'admin', 'paid_member')
                  ))
                ))
  );

create policy "View own standalone video views" on public.standalone_unique_video_views
  for select to authenticated using (viewer_id = (select auth.uid()));
create policy "Create a unique view on an accessible standalone video"
  on public.standalone_unique_video_views for insert to authenticated
  with check (
    viewer_id = (select auth.uid())
    and exists (select 1 from public.videos v
                where v.id = video_id and v.user_id <> (select auth.uid()))
  );

grant select, insert on public.post_unique_video_views to authenticated;
grant select, insert on public.circle_unique_video_views to authenticated;
grant select, insert on public.standalone_unique_video_views to authenticated;

-- Trigger-only functions are not callable as direct RPCs.
create or replace function public.add_post_unique_video_view()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  update public.posts set views = coalesce(views, 0) + 1 where id = new.post_id;
  return new;
end;
$$;
create trigger add_post_unique_video_view_trigger
  after insert on public.post_unique_video_views
  for each row execute function public.add_post_unique_video_view();

create or replace function public.add_circle_unique_video_view()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  update public.circle_contents set view_count = coalesce(view_count, 0) + 1 where id = new.content_id;
  return new;
end;
$$;
create trigger add_circle_unique_video_view_trigger
  after insert on public.circle_unique_video_views
  for each row execute function public.add_circle_unique_video_view();

create or replace function public.add_standalone_unique_video_view()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  update public.videos set views = coalesce(views, 0) + 1 where id = new.video_id;
  return new;
end;
$$;
create trigger add_standalone_unique_video_view_trigger
  after insert on public.standalone_unique_video_views
  for each row execute function public.add_standalone_unique_video_view();

create or replace function public.record_unique_post_video_view(p_post_id uuid)
returns boolean language plpgsql security invoker set search_path = ''
as $$
declare v_inserted integer;
begin
  if (select auth.uid()) is null then return false; end if;
  insert into public.post_unique_video_views(post_id, viewer_id)
    values (p_post_id, (select auth.uid()))
    on conflict do nothing;
  get diagnostics v_inserted = row_count;
  return v_inserted = 1;
end;
$$;

create or replace function public.record_unique_circle_video_view(p_content_id uuid)
returns boolean language plpgsql security invoker set search_path = ''
as $$
declare v_inserted integer;
begin
  if (select auth.uid()) is null then return false; end if;
  insert into public.circle_unique_video_views(content_id, viewer_id)
    values (p_content_id, (select auth.uid()))
    on conflict do nothing;
  get diagnostics v_inserted = row_count;
  return v_inserted = 1;
end;
$$;

create or replace function public.record_unique_standalone_video_view(p_video_id uuid)
returns boolean language plpgsql security invoker set search_path = ''
as $$
declare v_inserted integer;
begin
  if (select auth.uid()) is null then return false; end if;
  insert into public.standalone_unique_video_views(video_id, viewer_id)
    values (p_video_id, (select auth.uid()))
    on conflict do nothing;
  get diagnostics v_inserted = row_count;
  return v_inserted = 1;
end;
$$;

revoke execute on function public.record_unique_post_video_view(uuid) from public, anon;
revoke execute on function public.record_unique_circle_video_view(uuid) from public, anon;
revoke execute on function public.record_unique_standalone_video_view(uuid) from public, anon;
grant execute on function public.record_unique_post_video_view(uuid) to authenticated;
grant execute on function public.record_unique_circle_video_view(uuid) to authenticated;
grant execute on function public.record_unique_standalone_video_view(uuid) to authenticated;
