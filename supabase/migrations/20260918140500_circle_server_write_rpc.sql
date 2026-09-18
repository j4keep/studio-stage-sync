-- Reliable server writes for Circle Home posts.
-- This prevents Circle posts from remaining trapped in one browser's localStorage.

create or replace function public.yaj_upsert_circle_content(p_row jsonb)
returns public.circle_contents
language plpgsql
security definer
set search_path = public
as $$
declare
  v_circle_id uuid := (p_row->>'circle_id')::uuid;
  v_author_id uuid := (p_row->>'author_id')::uuid;
  v_id uuid := coalesce(nullif(p_row->>'id','')::uuid, gen_random_uuid());
  v_result public.circle_contents;
  v_can_post boolean := false;
begin
  if auth.uid() is null or v_author_id <> auth.uid() then
    raise exception 'Not allowed';
  end if;

  select (
    c.owner_id = auth.uid()
    or (
      c.member_posting_allowed = true
      and exists (
        select 1
        from public.circle_members cm
        where cm.circle_id = c.id
          and cm.user_id = auth.uid()
          and cm.status = 'approved'
      )
    )
  )
  into v_can_post
  from public.circles c
  where c.id = v_circle_id;

  if coalesce(v_can_post, false) = false then
    raise exception 'Not allowed to post to this Circle';
  end if;

  insert into public.circle_contents (
    id, circle_id, author_id, kind, activity_type, title, body,
    media_urls, media_type, visibility, donations_enabled,
    like_count, view_count, comment_count,
    event_at, event_end_at, event_location, event_online_url,
    event_capacity, event_ticket_cents, event_reminders,
    community_subtype, poll_options, tags, is_pinned,
    created_at, updated_at
  )
  values (
    v_id,
    v_circle_id,
    v_author_id,
    coalesce(p_row->>'kind','post'),
    coalesce(p_row->>'activity_type','photo'),
    nullif(p_row->>'title',''),
    nullif(p_row->>'body',''),
    coalesce(array(select jsonb_array_elements_text(coalesce(p_row->'media_urls','[]'::jsonb))), '{}'),
    coalesce(p_row->>'media_type','none'),
    coalesce(p_row->>'visibility','circle_members'),
    coalesce((p_row->>'donations_enabled')::boolean, true),
    coalesce((p_row->>'like_count')::integer, 0),
    coalesce((p_row->>'view_count')::integer, 0),
    coalesce((p_row->>'comment_count')::integer, 0),
    nullif(p_row->>'event_at','')::timestamptz,
    nullif(p_row->>'event_end_at','')::timestamptz,
    nullif(p_row->>'event_location',''),
    nullif(p_row->>'event_online_url',''),
    nullif(p_row->>'event_capacity','')::integer,
    nullif(p_row->>'event_ticket_cents','')::integer,
    coalesce((p_row->>'event_reminders')::boolean, false),
    nullif(p_row->>'community_subtype',''),
    coalesce(array(select jsonb_array_elements_text(coalesce(p_row->'poll_options','[]'::jsonb))), '{}'),
    coalesce(array(select jsonb_array_elements_text(coalesce(p_row->'tags','[]'::jsonb))), '{}'),
    coalesce((p_row->>'is_pinned')::boolean, false),
    coalesce(nullif(p_row->>'created_at','')::timestamptz, now()),
    coalesce(nullif(p_row->>'updated_at','')::timestamptz, now())
  )
  on conflict (id) do update set
    title = excluded.title,
    body = excluded.body,
    media_urls = excluded.media_urls,
    media_type = excluded.media_type,
    visibility = excluded.visibility,
    donations_enabled = excluded.donations_enabled,
    event_at = excluded.event_at,
    event_end_at = excluded.event_end_at,
    event_location = excluded.event_location,
    event_online_url = excluded.event_online_url,
    event_capacity = excluded.event_capacity,
    event_ticket_cents = excluded.event_ticket_cents,
    event_reminders = excluded.event_reminders,
    community_subtype = excluded.community_subtype,
    poll_options = excluded.poll_options,
    tags = excluded.tags,
    is_pinned = excluded.is_pinned,
    updated_at = now()
  returning * into v_result;

  return v_result;
end;
$$;

grant execute on function public.yaj_upsert_circle_content(jsonb) to authenticated;
