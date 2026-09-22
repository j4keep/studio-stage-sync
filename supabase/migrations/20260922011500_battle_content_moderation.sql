-- Battle operator moderation.

alter table public.admin_content_removals
  drop constraint if exists admin_content_removals_content_type_check;

alter table public.admin_content_removals
  add constraint admin_content_removals_content_type_check
  check (content_type in ('book','tv','job','marketplace','battle'));

drop policy if exists "battles admin read" on public.battles;
create policy "battles admin read"
on public.battles for select to authenticated
using (public.has_role(auth.uid(), 'admin'));

drop policy if exists "battles admin delete" on public.battles;
create policy "battles admin delete"
on public.battles for delete to authenticated
using (public.has_role(auth.uid(), 'admin'));

notify pgrst, 'reload schema';
