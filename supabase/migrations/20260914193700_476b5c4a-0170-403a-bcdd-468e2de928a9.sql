-- 1) profiles.email must not be readable by anon/authenticated (owners use my_profile_email())
REVOKE SELECT ON public.profiles FROM anon;
REVOKE SELECT ON public.profiles FROM authenticated;
GRANT SELECT (id, user_id, display_name, avatar_url, banner_url, bio, created_at, updated_at, terms_accepted_at, theme_preset, custom_accent_color, background_image_url, daw_shortcuts, country_flag, hide_yaj_page_on_gigs, gig_experience_bio, moderation_status, moderation_until, moderation_reason, moderation_offense_count, moderation_public_note, character_skin_tone) ON public.profiles TO anon;
GRANT SELECT (id, user_id, display_name, avatar_url, banner_url, bio, created_at, updated_at, terms_accepted_at, theme_preset, custom_accent_color, background_image_url, daw_shortcuts, country_flag, hide_yaj_page_on_gigs, gig_experience_bio, moderation_status, moderation_until, moderation_reason, moderation_offense_count, moderation_public_note, character_skin_tone) ON public.profiles TO authenticated;

-- 2) deal_businesses: hide contact PII (phone, email, address) from anonymous visitors
REVOKE SELECT ON public.deal_businesses FROM anon;
GRANT SELECT (id, owner_id, name, slug, description, logo_url, cover_url, website, category, is_verified, verification_status, can_publish, city, state, postal_code, latitude, longitude, hours_json, avg_rating, review_count, created_at, updated_at) ON public.deal_businesses TO anon;

-- 3) employer_profiles: scope reads to authenticated users
DROP POLICY IF EXISTS "employer_profiles readable by all" ON public.employer_profiles;
CREATE POLICY "employer_profiles readable by authenticated"
ON public.employer_profiles FOR SELECT TO authenticated USING (true);

-- 4) job_applications: lock all access to authenticated, tighten update
DROP POLICY IF EXISTS "applications applicant read" ON public.job_applications;
DROP POLICY IF EXISTS "applications applicant insert" ON public.job_applications;
DROP POLICY IF EXISTS "applications applicant update" ON public.job_applications;
DROP POLICY IF EXISTS "applications applicant delete" ON public.job_applications;

CREATE POLICY "applications read by applicant or employer"
ON public.job_applications FOR SELECT TO authenticated
USING (
  auth.uid() = applicant_id
  OR auth.uid() IN (SELECT jl.employer_id FROM public.job_listings jl WHERE jl.id = job_applications.job_id)
);

CREATE POLICY "applications insert own"
ON public.job_applications FOR INSERT TO authenticated
WITH CHECK (auth.uid() = applicant_id);

CREATE POLICY "applications update by applicant or employer"
ON public.job_applications FOR UPDATE TO authenticated
USING (
  auth.uid() = applicant_id
  OR auth.uid() IN (SELECT jl.employer_id FROM public.job_listings jl WHERE jl.id = job_applications.job_id)
)
WITH CHECK (
  auth.uid() = applicant_id
  OR auth.uid() IN (SELECT jl.employer_id FROM public.job_listings jl WHERE jl.id = job_applications.job_id)
);

CREATE POLICY "applications delete own"
ON public.job_applications FOR DELETE TO authenticated
USING (auth.uid() = applicant_id);

-- 5) resumes: public resumes visible to signed-in users only (PII protection)
DROP POLICY IF EXISTS "resumes public if visible" ON public.resumes;
CREATE POLICY "resumes public to authenticated if visible"
ON public.resumes FOR SELECT TO authenticated USING (visibility = 'public');