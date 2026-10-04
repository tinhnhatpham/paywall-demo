# Paywall demo: test results

Run on 2026-10-04 in Stripe test mode (sandbox) against the real Supabase database, both locally
and on the live deployment (Netlify + Render).

## End-to-end (real test-mode payments)

| Step | Result |
|---|---|
| Sign up with email + password | ✅ Logged in immediately |
| Members area before paying | ✅ Locked ("Members only") |
| Subscribe → Stripe Checkout ($9/month) | ✅ Redirects to Stripe's hosted checkout |
| Pay with test card 4242 | ✅ Back on the site, "Welcome! Your membership is active" |
| Membership activated by Stripe's webhook (no manual step) | ✅ Live: all webhooks delivered, 0 pending |
| Members content | ✅ 4 classes shown |
| Account page | ✅ "Active, renews November 4, 2026" |
| Cancel in the Stripe Billing Portal | ✅ Account page: "Active until November 4, 2026 (cancelled)"; access kept until then |

## Security and abuse

| Test | Result |
|---|---|
| Read premium content with the public key, logged out | ✅ Returns nothing |
| Read premium content logged in, **without** paying (bypassing the website) | ✅ Returns nothing (RLS) |
| Insert my own "active" membership row from the browser | ✅ Refused (403, RLS) |
| Update my own membership row to "active" | ✅ 0 rows changed |
| Fake webhook with a bad signature / wrong secret | ✅ 400, database untouched |
| Start checkout without logging in | ✅ 401 |
| Start a second checkout while already a member | ✅ 409 "already have an active membership" |
| Event for an old, cancelled subscription arriving late | ✅ Doesn't overwrite the newer active one |
| Webhook for a user who was deleted | ✅ Ignored (no error loop with Stripe retries) |
| Backend started with a live Stripe key | ✅ Refuses to start |
| Another website calling the API (CORS) | ✅ Blocked; only the demo site is allowed |

## Bugs these tests found (fixed)

- **Cancellations didn't show.** Newer Stripe API versions schedule a Billing Portal cancellation
  with `cancel_at` instead of `cancel_at_period_end`, so the account page kept saying "renews".
  Found with a real test-mode subscription; most tutorials only check the old flag.
- **Stripe objects aren't dictionaries** in stripe-python 16 (`.get()` fails). Converted with
  `to_dict()` before reading fields.
- **"Opening checkout…" could spin forever** while the free server woke up. Added a 90-second
  timeout and a "server is waking up" message.
- **Deleting a test user caused a webhook error loop.** Events for deleted users are now ignored.
