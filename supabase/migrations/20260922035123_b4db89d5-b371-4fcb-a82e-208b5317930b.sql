REVOKE ALL ON FUNCTION public.cleanup_deleted_creator_book_library() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_deleted_creator_book_library() TO service_role;