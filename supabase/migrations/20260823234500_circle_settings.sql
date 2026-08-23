-- Circle settings: owner-level notification prefs, editable after the fact (the same
-- privacy/discovery/approval fields set at creation already exist as columns and just
-- needed a settings UI, not a migration).

ALTER TABLE public.circles ADD COLUMN IF NOT EXISTS notify_new_requests boolean NOT NULL DEFAULT true;
ALTER TABLE public.circles ADD COLUMN IF NOT EXISTS notify_new_members boolean NOT NULL DEFAULT true;
