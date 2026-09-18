
REVOKE EXECUTE ON FUNCTION public.yaj_follows_circle_owner(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.yaj_circle_is_public(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.yaj_circle_owner(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.yaj_can_view_circle_content(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.yaj_circle_home_contents(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.yaj_my_circle_home_contents() FROM anon;
REVOKE EXECUTE ON FUNCTION public.yaj_upsert_circle_content(jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.toggle_circle_content_like(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.increment_circle_content_views(uuid) FROM anon;
