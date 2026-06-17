# Transfer Atchup → Circle tab

Goal: pressing the **Circle** tab opens the live Atchup app exactly as it exists in `atchup-daily-rise`, with its own pages, components, navigation, fundraisers, donations, verified+, support, etc. — using **this project's** unified auth and Supabase backend.

## 1. Files to copy as-is

From `atchup-daily-rise` → this project:

- **Pages** (`src/pages/m/*`) → `src/pages/atchup/m/*`
  SavingsCirclesHome, CreateCircle, JoinCircle, CircleDetail, Fundraisers, CreateFundraiser, FundraiserDetail, Profile, EditProfile, UserProfile, Messages, RateMember, VerifiedPlusUpgrade, Onboarding, SupportAdmin, TermsConditions, PrivacyPolicy
- **Pages** (root): `Help.tsx`, `PromoDownloads.tsx`, `IdVerification.tsx` → `src/pages/atchup/`
- **Components** (non-ui, 22 files) → `src/components/atchup/`
- **Hooks**: `useCircleLimits`, `useFollow`, `useMessageSound` → `src/hooks/`
- **Lib**: `dateHelpers.ts`, `verifiedPlus.ts` → `src/lib/`
- **Assets**: all `src/assets/atchup-*`, `ask-chup-*`, `hero-backdrop`, `welcome-bg`

Skipped (we already have unified auth): `Landing`, `Welcome`, `Verify`, `AccountSettings`.

## 2. Routing

Mount Atchup at its original paths so its internal `navigate('/m/...')` calls all just work, plus a redirect from `/circle`:

```
/circle                        → redirect to /m/savings-circles
/m/savings-circles             SavingsCirclesHome
/m/savings-circles/create      CreateCircle
/m/savings-circles/join        JoinCircle
/m/savings-circles/:id         CircleDetail
/m/fundraisers                 Fundraisers
/m/fundraiser/create           CreateFundraiser
/m/fundraiser/:id              FundraiserDetail
/m/messages                    Messages
/m/profile                     Profile  (Atchup's profile, not ours)
/m/edit-profile, /m/rate-member, /m/user/:userId
/m/verified-plus-upgrade, /m/support-admin
/m/terms-conditions, /m/privacy-policy
/help, /promo, /id-verification
```

Bottom-nav **Circle** tab: path `/m/savings-circles`, `matchPrefix: "/m"`.

## 3. Supabase client / auth

- All Atchup files import `@/integrations/supabase/client` — that path resolves to **our** client, so they automatically use our backend & unified session. No code change needed inside the copied files.
- Drop Atchup's `Landing/Welcome/Verify/AccountSettings` (replaced by our existing auth).
- Keep Atchup's `ForceUpgradeGate` and `Gated` wrapper so age/verified+ flow works inside Circle.

## 4. Database migrations

72 Atchup migrations include tables that overlap with ours (`profiles`, `notifications`, `messages`, `conversations`, `support_tickets`, `ticket_replies`). I will **not** blindly replay all 72. Instead one consolidated migration that:

- Creates **only Atchup-specific tables** that don't exist here: `savings_circles`, `circle_members`, `circle_contributions`, `circle_invites`, `fundraisers`, `fundraiser_donations`, `verified_plus_subscriptions`, `payment_methods`, `member_ratings`, `follows_atchup` (if conflicts), `id_verifications`, `circle_messages`, plus any enums/triggers/functions referenced.
- Adds missing columns to existing tables only where the Atchup code reads them (e.g. `profiles.verified_plus`, `profiles.reputation_score`).
- Includes GRANTs + RLS for every new table.

Exact list compiled by reading every Atchup migration first; surfaced for your approval before running.

## 5. Edge functions

Copy these to `supabase/functions/` (they already use stripe `@2024-11-20.acacia`):

- `check-payment-method`, `check-verified-plus`, `create-donation-checkout`, `create-fundraiser-donation`, `create-notification`, `create-verified-plus-checkout`, `customer-portal`, `help-chat`, `send-payment-reminders`, `support-ticket-notification`

Stripe secret already configured in Atchup → I'll add the same secret (`STRIPE_SECRET_KEY`) here via the secret tool.

## 6. Dependencies to add

`@emoji-mart/data`, `@emoji-mart/react`, `emoji-mart`, `qrcode.react`, `leaflet`, `react-leaflet`, `@types/leaflet`, `react-helmet-async`, `react-markdown`, `uuid`, `@huggingface/transformers`.

## 7. Cleanup

Delete the stub `src/pages/CircleHomePage.tsx` (replaced by Atchup's real `SavingsCirclesHome`).

## Risks

- **Schema collisions** on shared tables — handled by only adding Atchup-specific tables/columns in step 4.
- **Stripe** — Atchup's existing Stripe account key needs to be added as a secret.
- Some Atchup pages reference our existing tables (e.g. `notifications`) — schema differences may need small code patches; addressed file-by-file as they surface.

## Order of execution

1. Copy all assets, components, pages, hooks, lib (parallel).
2. Add npm deps.
3. Wire routes + bottom nav.
4. Copy edge functions.
5. Add Stripe secret.
6. Run consolidated migration (you approve).
7. Smoke-test Circle tab end-to-end.
