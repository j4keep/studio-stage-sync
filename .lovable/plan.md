# YAJ Jobs — Phased Build Plan

This is a large module (Jobs board + Gigs + AI Resume + AI Gig Assistant + Employer/Applicant dashboards + Preferences + AI Matching). To ship it well without breaking what's working, I'll build in 4 phases. You approve, I ship Phase 1 immediately, then we iterate.

---

## Phase 1 — Foundation (ship first)

**Backend (Lovable Cloud)**
New tables with RLS + GRANTs:
- `job_listings` — title, description, category, employment_type, salary_min/max, location, remote_mode, skills[], experience_level, deadline, media[], employer_id, status, visibility, created_at
- `gig_listings` — title, description, category, location, budget_min/max, urgency, preferred_date, media[], poster_id, status, ai_estimate (jsonb)
- `job_applications` — job_id, applicant_id, resume_id, cover_letter, status (applied/reviewing/interview/offer/accepted/declined/closed), anonymous_mode
- `resumes` — user_id, source (upload/ai), file_url, structured_data (jsonb), visibility, is_default
- `job_preferences` — user_id, titles[], categories[], locations[], radius, employment_types[], salary_expect, availability, experience_level, alert_keywords[], notify_frequency
- `saved_jobs` — user_id, job_id
- `employer_profiles` — user_id, company_name, verified, logo_url, description, website

**Frontend**
Rebuild `src/pages/JobsPage.tsx` from static sample data → real listings, with:
- Working search (title/company/location/skills) with recent searches (localStorage)
- Category chips filter real data
- Find Work / Hire Someone quick actions route to real flows
- Real job/gig cards with tap-through to detail page

New pages:
- `JobDetailPage` — full listing view + Apply / Save buttons
- `GigDetailPage` — full gig view + Contact / Apply
- `PostJobSheet` — job posting form (all fields listed in spec)
- `PostGigSheet` — gig posting form
- `MyJobsPage` — tabs: Applied / Saved / Posted

**Nav:** Jobs tab already exists → wire to real data.

---

## Phase 2 — AI Assistants

- **YAJ AI Gig Assistant**: new edge function `analyze-gig-photos` — takes uploaded photos, calls `google/gemini-2.5-pro` (vision) via Lovable AI Gateway, returns title/description/difficulty/tools/materials + 3-tier price ranges (budget/average/premium). Wired into `PostGigSheet`.
- **AI Improve Description** button on job posting (Lovable AI text).
- **AI Resume Builder**: new `ResumeBuilderPage` — conversational chat (edge function `resume-builder`) that interviews the user and outputs structured resume JSON + PDF export (client-side via `jspdf`).
- **AI Cover Letters**: `generate-cover-letter` edge function.
- **Resume Center** in Profile: upload / preview / delete / regenerate / visibility toggle.

---

## Phase 3 — Preferences, Matching, Dashboards

- `JobPreferencesPage` with every preference from the spec
- `AI Matching`: edge function `match-jobs` — scores listings vs. user resume+preferences, returns ranked feed on Jobs home ("Recommended for you" section with explain-why chips)
- `EmployerDashboardPage`: manage listings, view applicants, shortlist, message, schedule, close/reopen/duplicate
- `ApplicantDashboardPage`: applications + status timeline
- Anonymous-until-accepted mode on applications (masks name/photo until both accept)

---

## Phase 4 — Polish & Future-Ready Hooks

- Business Profile toggle in Profile settings
- Notification preferences (instant/daily/weekly) wired to `notifications` table
- Analytics view for employers (views, applications, shortlist rate)
- Scaffolding stubs for future: video resumes, verified skills, AI interview practice, salary negotiation, background verification

---

## Technical notes

- Reuse `ProGateModal` for advanced AI features (AI Resume, AI Cover Letter, AI Gig Estimate) — free tier gets basic posting/search.
- All AI calls go through Supabase Edge Functions using `LOVABLE_API_KEY` — never expose to client.
- Media uploads: reuse existing R2 bucket for job/gig photos & videos, resume PDFs stay in Supabase storage (`media` bucket, private folder).
- Anonymous mode: applications join `profiles` only after `both_accepted = true`; before that, client shows "Verified YAJ Member" placeholder.
- All new tables get: `authenticated` GRANTs, RLS enabled, policies scoped to `auth.uid()` for owner-write, public-read on `status='open'` listings.

---

## What I'll do right now if you approve

Ship **Phase 1** end-to-end (migration + all Phase 1 pages/sheets + wire to real data). That alone is a meaningful, usable Jobs product. Then you tell me to go on Phase 2.

Reply **"go phase 1"** to start, or tell me to reorder / drop / add anything.
