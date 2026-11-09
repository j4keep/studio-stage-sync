# YAJ notification launch QA matrix (2026-11-08)

## Definitions
**In-app** means a row in `public.notifications` appears when YAJ is open.
**Badge** means unread counts update in the bell/header. **Push** means an OS
notification appears while the site/app is backgrounded or closed; these are
different capabilities and must be tested separately.

## Audited implementation
- `NotificationBell`: reads last 50 notifications, realtime subscription,
  15s fallback polling, refresh on focus; opens related routes, marks read.
- `use-section-notifications`: badges for gigs, bookings, ratings/local help,
  purchases and support; realtime listener.
- `use-unread-message-count`: notification rows or unread message fallback,
  with polling and realtime listener.
- My Circle join request and approval: validated security-definer SQL RPCs in
  `20260823235500_circle_notifications.sql`, subject to live deployment and
  client invocation.
- Job application status changes: SQL trigger in
  `20260724154500_job_application_status_notifications.sql`.
- Job applicant/employer functions: `notify-job-applicant` and
  `notify-job-employer`; require deployed functions and call sites.
- Deals notification preferences UI exists; don't mistake preferences for
  proof that all corresponding reminder/scheduling jobs are deployed.
- No native Capacitor push-notification plugin, APNs/FCM device-token
  registration, or service-worker web push pipeline confirmed in repo.
  Thus off-app mobile delivery remains **not implemented/verified**.

## Desired notification triggers and tests
| Event | Expectation | Verification |
| --- | --- | --- |
| New follower | recipient gets notification, click opens follower profile | Test both accounts |
| Like on post/video | creator gets alert, not for own like | Needs event producer verification |
| Comment or reply | creator / replied-to user gets alert; relevant post opens | Needs event producer verification |
| Direct message | recipient's unread count and bell update; opens correct conversation | Test two accounts |
| Circle join request | circle owner notified | Test pending request and RPC |
| Circle approval | approved member notified | Test moderation and RPC |
| Job application/status/interview | relevant applicant/employer notified | Test SQL trigger, functions, preferences |
| Gig application/acceptance | counterpart notified | Test |
| Marketplace offer/order/message | counterpart notified | Test |
| Bookings / payments | relevant user notified; route to /my-bookings | Test |
| Deal claim expiry / nearby / followed business | only when appropriate preference and schedule permit | Test |
| Live station starts | followers/subscribers notified if opted in | Not confirmed |
| Reports, account safety, parental time | affected user or linked parent notified | Not confirmed |
| Push while app closed | OS alert on iOS/Android with explicit permission | Not confirmed |

## Live verification (Lovable Cloud SQL editor, READ ONLY)
```sql
select type, reference_type, count(*) as total,
       count(*) filter (where not coalesce(is_read,false)) as unread,
       max(created_at) as most_recent
from public.notifications
group by type, reference_type
order by total desc;
```
No PII or tokens needed for this aggregate. Compare with two-account manual
tests: generate one event in account B, observe account A within 15s, tap to
verify destination, mark read, and confirm badge decreases. Repeat with the
app backgrounded to separately test push delivery (likely not supported yet).

## Release gates
1. GitHub release checks pass for changed commit.
2. In-app delivery, badge and route verified on two signed-in accounts.
3. Confirm RLS prevents reading/marking other users' notifications.
4. Verify job/Circle/deal function deployments, duplicate prevention and rate limits.
5. Decide and implement iOS APNs / Android FCM push and opt-in/quiet hours
   before claiming off-app notifications.
