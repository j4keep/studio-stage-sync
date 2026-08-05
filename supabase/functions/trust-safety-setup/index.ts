import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import postgres from "https://deno.land/x/postgresjs@v3.4.5/mod.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Applies Trust & Safety schema (moderation columns/tables/RPCs).
 * Admin-only. Uses DATABASE_URL / SUPABASE_DB_URL when available on Lovable Cloud.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: userErr } = await supabaseUser.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: isAdmin } = await admin.rpc("has_role", {
      _user_id: userData.user.id,
      _role: "admin",
    });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const dbUrl =
      Deno.env.get("SUPABASE_DB_URL") ||
      Deno.env.get("DATABASE_URL") ||
      Deno.env.get("DB_URL");
    if (!dbUrl) {
      return new Response(
        JSON.stringify({
          error: "No database URL secret on this project",
          hint: "Run supabase/migrations/20260805200000_trust_safety_moderation.sql in the Lovable/Supabase SQL editor",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const sql = postgres(dbUrl, { max: 1, idle_timeout: 5 });
    try {
      await sql.unsafe(`
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS moderation_status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS moderation_until timestamptz,
  ADD COLUMN IF NOT EXISTS moderation_reason text,
  ADD COLUMN IF NOT EXISTS moderation_offense_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS moderation_public_note text;
`);

      await sql.unsafe(`
DO $$ BEGIN
  ALTER TABLE public.profiles
    DROP CONSTRAINT IF EXISTS profiles_moderation_status_check;
  ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_moderation_status_check
    CHECK (moderation_status IN ('active', 'warned', 'cooldown', 'timeout', 'suspended', 'banned'));
EXCEPTION WHEN others THEN NULL;
END $$;
`);

      await sql.unsafe(`
CREATE TABLE IF NOT EXISTS public.moderation_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action_type text NOT NULL,
  reason text NOT NULL,
  details text,
  duration_hours integer,
  ends_at timestamptz,
  offense_number integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.moderation_appeals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'open',
  message text NOT NULL,
  admin_response text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid
);
`);

      // Re-apply full migration body from file content (functions + RLS)
      // Keep this edge function lean: core columns/tables first; RPCs next.
      await sql.unsafe(`
CREATE OR REPLACE FUNCTION public.apply_moderation_action(
  p_target_user_id uuid,
  p_action_type text,
  p_reason text,
  p_details text DEFAULT NULL,
  p_duration_hours integer DEFAULT NULL
)
RETURNS public.moderation_actions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  uid uuid := auth.uid();
  offense integer;
  ends timestamptz;
  hours integer := p_duration_hours;
  new_status text;
  row public.moderation_actions;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF NOT (public.has_role(uid, 'admin') OR public.has_role(uid, 'moderator')) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
    RAISE EXCEPTION 'reason required';
  END IF;

  SELECT coalesce(moderation_offense_count, 0) INTO offense
  FROM public.profiles WHERE user_id = p_target_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'profile not found'; END IF;

  IF p_action_type = 'warning' THEN
    offense := offense + 1; new_status := 'warned'; ends := NULL; hours := NULL;
  ELSIF p_action_type = 'cooldown_24h' THEN
    offense := offense + 1; new_status := 'cooldown'; hours := coalesce(hours, 24);
    ends := now() + make_interval(hours => hours);
  ELSIF p_action_type = 'timeout_3d' THEN
    offense := offense + 1; new_status := 'timeout'; hours := coalesce(hours, 72);
    ends := now() + make_interval(hours => hours);
  ELSIF p_action_type = 'timeout_7d' THEN
    offense := offense + 1; new_status := 'timeout'; hours := coalesce(hours, 168);
    ends := now() + make_interval(hours => hours);
  ELSIF p_action_type = 'suspend' THEN
    offense := offense + 1; new_status := 'suspended'; ends := NULL; hours := NULL;
  ELSIF p_action_type = 'ban' THEN
    offense := offense + 1; new_status := 'banned'; ends := NULL; hours := NULL;
  ELSIF p_action_type = 'restore' THEN
    new_status := 'active'; ends := NULL; hours := NULL;
  ELSIF p_action_type = 'note' THEN
    INSERT INTO public.moderation_actions (
      target_user_id, actor_id, action_type, reason, details, offense_number
    ) VALUES (p_target_user_id, uid, 'note', trim(p_reason), p_details, offense)
    RETURNING * INTO row;
    RETURN row;
  ELSE
    RAISE EXCEPTION 'invalid action_type';
  END IF;

  UPDATE public.profiles SET
    moderation_status = new_status,
    moderation_until = ends,
    moderation_reason = CASE WHEN p_action_type = 'restore' THEN NULL ELSE trim(p_reason) END,
    moderation_offense_count = offense,
    moderation_public_note = CASE WHEN p_action_type = 'restore' THEN NULL ELSE coalesce(p_details, moderation_public_note) END,
    updated_at = now()
  WHERE user_id = p_target_user_id;

  INSERT INTO public.moderation_actions (
    target_user_id, actor_id, action_type, reason, details, duration_hours, ends_at, offense_number
  ) VALUES (
    p_target_user_id, uid, p_action_type, trim(p_reason), p_details, hours, ends, offense
  ) RETURNING * INTO row;
  RETURN row;
END;
$fn$;
`);

      await sql.unsafe(`
CREATE OR REPLACE FUNCTION public.refresh_moderation_status(p_user_id uuid DEFAULT auth.uid())
RETURNS TABLE (
  moderation_status text,
  moderation_until timestamptz,
  moderation_reason text,
  moderation_offense_count integer,
  moderation_public_note text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  uid uuid := coalesce(p_user_id, auth.uid());
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF uid IS DISTINCT FROM auth.uid()
     AND NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator')) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  WITH expired AS (
    UPDATE public.profiles p
    SET moderation_status = 'active',
        moderation_until = NULL,
        moderation_reason = NULL,
        moderation_public_note = NULL,
        updated_at = now()
    WHERE p.user_id = uid
      AND p.moderation_status IN ('cooldown', 'timeout')
      AND p.moderation_until IS NOT NULL
      AND p.moderation_until <= now()
    RETURNING p.user_id, p.moderation_offense_count
  )
  INSERT INTO public.moderation_actions (target_user_id, actor_id, action_type, reason, details, offense_number)
  SELECT e.user_id, NULL, 'restore', 'Automatic restore', 'Community Timeout expired — account restored', coalesce(e.moderation_offense_count, 0)
  FROM expired e;

  RETURN QUERY
  SELECT p.moderation_status, p.moderation_until, p.moderation_reason, p.moderation_offense_count, p.moderation_public_note
  FROM public.profiles p WHERE p.user_id = uid;
END;
$fn$;
`);

      await sql.unsafe(`
ALTER TABLE public.moderation_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moderation_appeals ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.moderation_actions TO authenticated;
GRANT ALL ON public.moderation_actions TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.moderation_appeals TO authenticated;
GRANT ALL ON public.moderation_appeals TO service_role;
GRANT EXECUTE ON FUNCTION public.apply_moderation_action(uuid, text, text, text, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.refresh_moderation_status(uuid) TO authenticated, service_role;
`);

      await sql.unsafe(`
DROP POLICY IF EXISTS "Users view own moderation history" ON public.moderation_actions;
CREATE POLICY "Users view own moderation history" ON public.moderation_actions FOR SELECT TO authenticated
  USING (auth.uid() = target_user_id OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));
DROP POLICY IF EXISTS "Admins insert moderation actions" ON public.moderation_actions;
CREATE POLICY "Admins insert moderation actions" ON public.moderation_actions FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));
DROP POLICY IF EXISTS "Users insert own appeals" ON public.moderation_appeals;
CREATE POLICY "Users insert own appeals" ON public.moderation_appeals FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users view own appeals" ON public.moderation_appeals;
CREATE POLICY "Users view own appeals" ON public.moderation_appeals FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));
DROP POLICY IF EXISTS "Admins update appeals" ON public.moderation_appeals;
CREATE POLICY "Admins update appeals" ON public.moderation_appeals FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));
`);
    } finally {
      await sql.end({ timeout: 5 });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
