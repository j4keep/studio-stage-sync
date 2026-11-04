-- Unique authenticated video viewers across Feed, Happening, profile and My Circle.
-- This migration must be applied to the connected Supabase project before the client will record views.
-- Historical unidentifiable 'views' counts cannot be retroactively deduplicated.

create table if not exists public.post_unique_video_views (
  post_id uuid not null references public.posts(id) on delete cascade,
  viewer_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, viewer_id)
);
create index if not exists post_unique_video_views_viewer_idx on public.post_unique_video_views(viewer_id);
alter table public.post_unique_video_views enable row level security;
-- No direct public inserts or updates: authenticated identity is enforced by an RPC.

create table if not exists public.circle_unique_video_views (
  content_id uuid not null references public.circle_contents(id) on delete cascade,
  viewer_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (content_id, viewer_id)
);
create index if not exists circle_unique_video_views_viewer_idx on public.circle_unique_video_views(viewer_id);
alter table public.circle_unique_video_views enable row level security;

create or replace function public.record_unique_post_video_view(p_post_id uuid)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare v_viewer uuid := auth.uid();
declare v_added integer;
begin
  if v_viewer is null then return false; end if;
  -- Refuse non-video posts, own posts and deleted posts.
  if not exists (
    select 1 from public.posts p
    where p.id = p_post_id and p.media_type = 'video' and p.user_id <> v_viewer
  ) then return false; end if;

  insert into public.post_unique_video_views(post_id, viewer_id)
  values (p_post_id, v_viewer)
  on conflict do nothing;
  get diagnostics v_added = row_count;
  if v_added > 0 then
    update public.posts set views = coalesce(views, 0) + 1 where id = p_post_id;
    return true;
  end if;
  return false;
end;
$$;

create or replace function public.record_unique_circle_video_view(p_content_id uuid)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare v_viewer uuid := auth.uid();
declare v_added integer;
begin
  if v_viewer is null then return false; end if;
  -- Enforce visibility and exclude self-views. Do not expose the member list.
  if not exists (
    select 1 from public.circle_contents c
    where c.id = p_content_id
      and c.media_type = 'video'
      and c.author_id <> v_viewer
      and (
        c.visibility = 'public_in_circle'
        or (c.visibility in ('circle_members','paid_members')
            and public.is_social_circle_member(c.circle_id, v_viewer))
      )
  ) then return false; end if;

  insert into public.circle_unique_video_views(content_id, viewer_id)
  values (p_content_id, v_viewer)
  on conflict do nothing;
  get diagnostics v_added = row_count;
  if v_added > 0 then
    update public.circle_contents set view_count = coalesce(view_count, 0) + 1
    where id = p_content_id;
    return true;
  end if;
  return false;
end;
$$;

revoke all on function public.record_unique_post_video_view(uuid) from public;
revoke all on function public.record_unique_circle_video_view(uuid) from public;
grant execute on function public.record_unique_post_video_view(uuid) to authenticated;
grant execute on function public.record_unique_circle_video_view(uuid) to authenticated;
