# YAJ Find Local Help + Gig repair estimate QA

## What is implemented in repository
- Find Local Help > Ask YAJ: photo, camera and short video (<= 90s, <= 40 MB);
  video uses three sampled frames. AI generates provisional observed damage,
  suggested scope, materials, labor assumptions and measurements needed.
- Gig composer: existing photo analysis now shows the same breakdown and can
  analyze three still frames from a short video.
- Concrete repair worksheet: user-entered inches for length/width/depth,
  cubic-foot volume, waste allowance, whole-bag quantities, editable bag yield,
  supplier prices, labor hours/rate, supplies, disposal and tax.
- Reviewed range can be used as the gig's budget, after user acknowledgement.
- No measuring geometry from pixels. Do not make exact quote claims.
- Costs displayed as sample planning assumptions unless user enters current
  rates. No live Home Depot/Lowes/local labor-price feed is implemented.
- A plain photograph cannot determine slab strength, movement, thickness,
  reinforcement, contamination, permits or full job scope; site inspection
  may change the recommended repair and price.
- Video is sampled and not currently stored as an attachment on gig listings.
  Users must include photographs on the actual listing if they want providers
  to see evidence.

## Important deployment dependency
The modified `supabase/functions/yaj-jobs-ai/index.ts` must be deployed
to the LIVE Lovable Cloud backend separately if GitHub sync does not deploy
edge functions. The current AI gateway uses `LOVABLE_API_KEY`, so every AI
analysis invocation may consume Lovable AI credits. GitHub-only edits do not.
Do not claim actual AI results tested until this function is deployed.

## Manual QA (two phones and a professional estimate)
1. Local Help > Ask YAJ > capture concrete-spall photo, enter job notes and
   analyze. Confirm AI flags actual measurements, no invented exact price.
2. Attach a 15s repair video; verify three frames are processed and a result
   returned. Try HEVC/unsupported format: show clear error, no app crash.
3. Set a 24in x 12in x 2in repair, 0.6 cu ft/bag, 10% waste. Expect 0.333 cu ft
   base volume, 0.367 cu ft with waste, one 80lb bag by assumed yield.
4. Change dimensions/depth and local bag cost; recalc immediately; confirm
   whole-bag rounding and labor/material totals. Zero depth must reject input.
5. Use reviewed range as gig budget. Verify resulting gig budget is the
   user-confirmed range; no auto-approval or guaranteed price.
6. Confirm generic non-concrete jobs do NOT show fabricated quantities or
   exact localized supplier pricing from a photo.
7. Try structural/settlement spalling, electrical hazard and gas leak examples;
   AI must request professional inspection instead of confidently prescribing
   a cosmetic patch.
8. Verify Android, iOS Safari and native wrappers, microphone/camera/file
   permissions, storage and meaningful error messages.
9. Run GitHub release checks; check production Edge Function deployment and
   actual images/video frame calls before launch.
