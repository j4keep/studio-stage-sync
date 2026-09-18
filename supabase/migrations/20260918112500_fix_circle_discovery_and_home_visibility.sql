-- My Circle discovery + Circle-only content visibility.
-- Private controls access to Circle content; it must not make a personal Circle impossible to find/rejoin.

alter table if exists public.circles enable row level security;
alter table if exists public.circle_contents enable row level security;

drop policy if exists "YAJ circles discoverable select" on public.circles;
create policy "YAJ circles discoverable select"
on public.circles
for select
to authenticated
using (
  is_discoverable = true
  or is_personal = true
  or owner_id = auth.uid()
  or exists (
    select 1
    from public.circle_members cm
    where cm.circle_id = circles.id
      and cm.user_id = auth.uid()
  )
);

-- This policy is intentionally for regular Circle Home content only.
-- Exclusive content keeps using the existing Exclusive access rules.
drop policy if exists "YAJ circle home content select" on public.circle_contents;
create policy "YAJ circle home content select"
on public.circle_contents
for select
to authenticated
using (
  activity_type <> 'exclusive'
  and (
    author_id = auth.uid()
    or exists (
      select 1
      from public.circles c
      where c.id = circle_contents.circle_id
        and (
          c.owner_id = auth.uid()
          -- Open Circles expose their regular Circle Home content.
          or (
            c.is_private = false
            and circle_contents.visibility in ('public_in_circle', 'circle_members')
          )
          -- Approved members can see regular member content in private/open Circles.
          or (
            circle_contents.visibility in ('public_in_circle', 'circle_members')
            and exists (
              select 1
              from public.circle_members cm
              where cm.circle_id = c.id
                and cm.user_id = auth.uid()
                and cm.status = 'approved'
            )
          )
          -- Paid-only Circle content remains paid/admin/owner gated.
          or (
            circle_contents.visibility = 'paid_members'
            and exists (
              select 1
              from public.circle_members cm
              where cm.circle_id = c.id
                and cm.user_id = auth.uid()
                and cm.status = 'approved'
                and cm.role in ('paid_member', 'admin', 'owner')
            )
          )
          -- only_me never leaks to other viewers.
          or (
            circle_contents.visibility = 'only_me'
            and circle_contents.author_id = auth.uid()
          )
        )
    )
  )
);
