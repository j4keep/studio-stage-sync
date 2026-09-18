-- Make Circle discovery independent from private-content access.
-- Private Circles remain visible/searchable, but their content stays gated until approved.

create or replace function public.yaj_circle_directory()
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', c.id,
        'name', c.name,
        'cover_url', c.cover_url,
        'city', c.city,
        'member_count', c.member_count,
        'is_private', c.is_private,
        'is_discoverable', c.is_discoverable,
        'is_personal', c.is_personal,
        'type', c.type,
        'owner_id', c.owner_id,
        'description', c.description,
        'category', c.category,
        'owner_name', p.display_name,
        'updated_at', c.updated_at
      )
      order by c.updated_at desc
    ),
    '[]'::jsonb
  )
  from public.circles c
  left join public.profiles p on p.user_id = c.owner_id
  where c.is_personal = true
     or c.is_discoverable = true;
$$;

grant execute on function public.yaj_circle_directory() to authenticated;

create or replace function public.yaj_circle_shell(p_circle_id uuid)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select jsonb_build_object(
    'id', c.id,
    'owner_id', c.owner_id,
    'type', c.type,
    'name', c.name,
    'avatar_url', c.avatar_url,
    'cover_url', c.cover_url,
    'description', c.description,
    'category', c.category,
    'city', c.city,
    'is_private', c.is_private,
    'is_discoverable', c.is_discoverable,
    'requires_approval', c.requires_approval,
    'is_paid', c.is_paid,
    'price_cents', c.price_cents,
    'welcome_message', c.welcome_message,
    'default_post_visibility', c.default_post_visibility,
    'member_posting_allowed', c.member_posting_allowed,
    'member_comments_allowed', c.member_comments_allowed,
    'member_invites_allowed', c.member_invites_allowed,
    'member_count', c.member_count,
    'is_personal', c.is_personal,
    'exclusive_access', c.exclusive_access,
    'notify_new_requests', c.notify_new_requests,
    'notify_new_members', c.notify_new_members,
    'created_at', c.created_at,
    'updated_at', c.updated_at
  )
  from public.circles c
  where c.id = p_circle_id
    and (
      c.is_personal = true
      or c.is_discoverable = true
      or c.owner_id = auth.uid()
      or exists (
        select 1
        from public.circle_members cm
        where cm.circle_id = c.id
          and cm.user_id = auth.uid()
      )
    )
  limit 1;
$$;

grant execute on function public.yaj_circle_shell(uuid) to authenticated;

-- Regular Home-tab Circle content. This intentionally excludes Exclusive content.
-- Open Circles can be viewed by anyone; private Circles require owner/approved membership.
create or replace function public.yaj_circle_home_contents(p_circle_id uuid)
returns setof public.circle_contents
language sql
security definer
set search_path = public
stable
as $$
  select cc.*
  from public.circle_contents cc
  join public.circles c on c.id = cc.circle_id
  where cc.circle_id = p_circle_id
    and cc.activity_type <> 'exclusive'
    and (
      c.owner_id = auth.uid()
      or c.is_private = false
      or exists (
        select 1
        from public.circle_members cm
        where cm.circle_id = c.id
          and cm.user_id = auth.uid()
          and cm.status = 'approved'
      )
    )
    and (
      cc.visibility <> 'only_me'
      or cc.author_id = auth.uid()
    )
    and (
      cc.visibility <> 'paid_members'
      or c.owner_id = auth.uid()
      or exists (
        select 1
        from public.circle_members cm
        where cm.circle_id = c.id
          and cm.user_id = auth.uid()
          and cm.status = 'approved'
          and cm.role in ('paid_member', 'admin', 'owner')
      )
    )
  order by cc.is_pinned desc, cc.created_at desc;
$$;

grant execute on function public.yaj_circle_home_contents(uuid) to authenticated;

-- My Circle > Home: only posts created inside Circles the viewer owns or has joined.
-- Main Feed posts are intentionally excluded.
create or replace function public.yaj_my_circle_home_contents()
returns setof public.circle_contents
language sql
security definer
set search_path = public
stable
as $$
  select cc.*
  from public.circle_contents cc
  join public.circles c on c.id = cc.circle_id
  where cc.activity_type <> 'exclusive'
    and (
      c.owner_id = auth.uid()
      or exists (
        select 1
        from public.circle_members cm
        where cm.circle_id = c.id
          and cm.user_id = auth.uid()
          and cm.status = 'approved'
      )
    )
    and (
      cc.visibility <> 'only_me'
      or cc.author_id = auth.uid()
    )
    and (
      cc.visibility <> 'paid_members'
      or c.owner_id = auth.uid()
      or exists (
        select 1
        from public.circle_members cm
        where cm.circle_id = c.id
          and cm.user_id = auth.uid()
          and cm.status = 'approved'
          and cm.role in ('paid_member', 'admin', 'owner')
      )
    )
  order by cc.created_at desc
  limit 150;
$$;

grant execute on function public.yaj_my_circle_home_contents() to authenticated;
