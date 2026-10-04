-- Paywall demo database. Run once in Supabase: SQL Editor -> New query -> paste -> Run.
-- Users come from Supabase Auth (auth.users); we only store their subscription state.

-- One row per user. Written ONLY by the backend (from Stripe webhooks), never by the browser.
create table subscriptions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  stripe_customer_id text unique,
  stripe_subscription_id text,
  status text not null default 'none',          -- Stripe status: active, trialing, past_due, canceled, ...
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table subscriptions enable row level security;

-- A signed-in user may READ their own row (to show "Active until ..."). No insert/update/delete
-- policies: only the backend's secret key can change subscription state.
create policy "read own subscription" on subscriptions
  for select to authenticated
  using (user_id = auth.uid());

-- The members-only content.
create table premium_content (
  id bigint generated always as identity primary key,
  title text not null,
  body text not null,
  sort integer not null default 0,
  created_at timestamptz not null default now()
);

alter table premium_content enable row level security;

-- The paywall itself, enforced by the database: rows are only returned to signed-in users
-- whose subscription is active. Hiding content in React alone would not be secure.
create policy "active members read premium content" on premium_content
  for select to authenticated
  using (
    exists (
      select 1 from subscriptions s
      where s.user_id = auth.uid()
        and s.status in ('active', 'trialing')
    )
  );

-- Demo content (fictional yoga studio)
insert into premium_content (title, body, sort) values
  ('Week 1: Morning flow (20 min)',
   'Start in child''s pose for five slow breaths. Move through cat-cow (8 rounds), low lunge on each side, and finish with three sun salutation A rounds. Keep the pace slow and let the breath lead.', 1),
  ('Week 2: Hips and lower back',
   'Pigeon pose (2 minutes per side), supine twist, and bridge holds. If your knees complain in pigeon, switch to figure-four on your back. Finish with legs up the wall for five minutes.', 2),
  ('Week 3: Balance basics',
   'Tree pose near a wall, warrior III with hands on blocks, and half moon. Fix your gaze on one point. Wobbling is part of the practice, not a sign you are doing it wrong.', 3),
  ('Members-only: studio schedule',
   'Saturday community class at 9am is free for members. Bring a friend once a month at no cost. Mat rental is included with your membership.', 4);
