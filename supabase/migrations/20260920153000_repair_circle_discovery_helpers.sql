-- Repair/guarantee Circle discovery helpers on databases that may have encountered
-- the malformed yaj_circle_shell delimiter in 20260918122500.
-- Safe to run repeatedly.

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

revoke all on function public.yaj_circle_directory() from public;
grant execute on function public.yaj_circle_directory() to authenticated;

create or replace function public.yaj_circle_shell(p_circle_id uuid)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select to_jsonb(c)
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

revoke all on function public.yaj_circle_shell(uuid) from public;
grant execute on function public.yaj_circle_shell(uuid) to authenticated;

notify pgrst, 'reload schema';
