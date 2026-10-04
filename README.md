# Membership paywall demo (Stripe + Supabase)

Sign up, subscribe monthly with Stripe, and unlock members-only content. Cancel any time from a
Stripe-hosted billing page. Built for a fictional yoga studio.

**Live demo:** https://riverside-yoga-demo.netlify.app (Stripe **test mode**: pay with card
`4242 4242 4242 4242`, any future date, any CVC. No real charges.)

**Test results:** [TESTING.md](TESTING.md)

## How it works

```
React site (Netlify) ──login──> Supabase Auth
     │  "Subscribe"                         ▲ reads own membership + premium content
     ▼                                      │ (Row Level Security decides what comes back)
Flask API (Render) ──creates──> Stripe Checkout / Billing Portal
     ▲                                      │
     └────── signed webhooks ◄──────────────┘  Flask writes membership status to Supabase
```

- **The browser never decides who has paid.** Stripe tells the backend through signed webhooks;
  forged or unsigned requests are rejected. The backend re-fetches each subscription from Stripe
  rather than trusting the event body, so out-of-order events can't corrupt the state.
- **The paywall is enforced by the database**, not just hidden in React: a Row Level Security
  policy only returns premium rows to users whose subscription is active. Users can read their
  own membership row but can't write it.
- **Cancel at period end:** members keep access until the end of the month they paid for.
- Secret keys (Stripe, Supabase) live only on the server. The app refuses to start with a live
  Stripe key, so the demo can't take real money by accident.

## Stack

Python / Flask on Render · React 19 + Vite on Netlify · Supabase (Auth + Postgres) · Stripe
(Checkout, Billing Portal, webhooks)

## Project layout

| Path | What |
|---|---|
| `backend/app.py` | Checkout + portal sessions, webhook handler, membership sync |
| `supabase/schema.sql` | Tables, Row Level Security policies, demo content |
| `web/src/` | Pages: pricing, login/signup, members area, account |

## Run locally

Backend: copy `backend/.env.example` to `backend/.env` (Stripe **test** keys), then
`pip install -r requirements.txt` and `python app.py` (port 5001).
Web: copy `web/.env.example` to `web/.env`, then `npm install` and `npm run dev` (port 5173).

Built by Steven (LogicAgentry), an AI-assisted developer.
