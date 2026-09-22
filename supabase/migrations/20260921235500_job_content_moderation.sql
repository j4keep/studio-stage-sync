-- Opportunities moderation: report and operator-remove job listings.

alter table public.content_reports
  drop constraint if exists content_reports_target_type_check;

alter table public.content_reports
  add constraint content_reports_target_type_check
  check (target_type in ('battle','post','book','tv','job','other'));

alter table public.admin_content_removals
  drop constraint if exists admin_content_removals_content_type_check;

alter table public.admin_content_removals
  add constraint admin_content_removals_content_type_check
  check (content_type in ('book','tv','job'));

drop policy if exists "job listings admin read" on public.job_listings;
create policy "job listings admin read"
on public.job_listings for select to authenticated
using (public.has_role(auth.uid(), 'admin'));

drop policy if exists "job listings admin delete" on public.job_listings;
create policy "job listings admin delete"
on public.job_listings for delete to authenticated
using (public.has_role(auth.uid(), 'admin'));

notify pgrst, 'reload schema';
