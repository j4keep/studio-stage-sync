REVOKE EXECUTE ON FUNCTION public.lookup_live_session_by_code(text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.my_profile_email() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_live_session_member(uuid, uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_live_session_by_code(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_profile_email() TO authenticated;