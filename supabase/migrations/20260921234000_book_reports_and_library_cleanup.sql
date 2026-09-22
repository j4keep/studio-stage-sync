-- Complete Books management integration with Trust & Safety reporting.

-- Reports can now target creator Books and YAJ.TV uploads.
alter table public.content_reports
  drop constraint if exists content_reports_target_type_check;

alter table public.content_reports
  add constraint content_reports_target_type_check
  check (target_type in ('battle','post','book','tv','other'));

-- Remove stale personal-library references when a creator or admin removes a creator book.
create or replace function public.cleanup_deleted_creator_book_library()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.book_library where book_id = old.id::text;
  return old;
end;
$$;

drop trigger if exists cleanup_creator_book_library on public.creator_books;
create trigger cleanup_creator_book_library
after delete on public.creator_books
for each row execute function public.cleanup_deleted_creator_book_library();

notify pgrst, 'reload schema';
