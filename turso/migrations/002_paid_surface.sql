alter table listings add column bid_cents integer not null default 300 check (bid_cents >= 300);
alter table listings add column stripe_checkout_session_id text;

create unique index if not exists listings_checkout_session_idx
  on listings(stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;

create index if not exists listings_surface_rank_idx
  on listings(bid_cents desc, created_at asc);

create table if not exists pending_submissions (
  id text primary key,
  x_handle text not null,
  product_name text not null,
  product_url text not null,
  product_description text not null,
  tokens_spent_usd real not null,
  revenue_usd real not null,
  efficiency_score real not null,
  model_provider text not null check (model_provider in ('anthropic', 'openai')),
  verification_period_start integer not null,
  verification_period_end integer not null,
  token_nonce text not null unique,
  revenue_nonce text not null unique,
  bid_cents integer not null check (bid_cents >= 300),
  stripe_checkout_session_id text not null unique,
  status text not null default 'pending' check (status in ('pending', 'completed')),
  listing_id text,
  created_at integer not null,
  expires_at integer not null
);

create table if not exists processed_boosts (
  stripe_checkout_session_id text primary key,
  listing_id text not null references listings(id) on delete cascade,
  amount_cents integer not null check (amount_cents >= 100),
  completed_at integer not null
);

create index if not exists pending_submissions_status_idx
  on pending_submissions(status, expires_at);
