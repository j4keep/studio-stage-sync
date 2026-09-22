-- Marketplace reporting and operator moderation.

alter table public.content_reports
  drop constraint if exists content_reports_target_type_check;

alter table public.content_reports
  add constraint content_reports_target_type_check
  check (target_type in ('battle','post','book','tv','job','marketplace','other'));

alter table public.admin_content_removals
  drop constraint if exists admin_content_removals_content_type_check;

alter table public.admin_content_removals
  add constraint admin_content_removals_content_type_check
  check (content_type in ('book','tv','job','marketplace'));

drop policy if exists "marketplace listings admin read" on public.marketplace_listings;
create policy "marketplace listings admin read"
on public.marketplace_listings for select to authenticated
using (public.has_role(auth.uid(), 'admin'));

drop policy if exists "marketplace listings admin update" on public.marketplace_listings;
create policy "marketplace listings admin update"
on public.marketplace_listings for update to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

notify pgrst, 'reload schema';
