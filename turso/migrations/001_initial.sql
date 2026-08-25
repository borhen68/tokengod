pragma foreign_keys = on;

create table if not exists users (
  id text primary key,
  x_handle text not null,
  x_user_id text not null unique,
  display_name text not null,
  avatar_url text,
  created_at integer not null,
  updated_at integer not null,
  check (length(x_handle) between 1 and 50),
  check (length(display_name) between 1 and 100)
);

create table if not exists listings (
  id text primary key,
  owner_user_id text not null references users(id) on delete cascade,
  product_name text not null,
  product_url text not null,
  product_description text not null,
  tokens_spent_usd real not null,
  revenue_usd real not null,
  efficiency_score real not null,
  model_provider text not null check (model_provider in ('anthropic', 'openai', 'other')),
  verification_period_start integer not null,
  verification_period_end integer not null,
  verified_at integer not null,
  created_at integer not null,
  updated_at integer not null,
  check (length(product_name) between 2 and 80),
  check (length(product_description) between 12 and 320),
  check (product_url like 'http://%' or product_url like 'https://%'),
  check (tokens_spent_usd > 0),
  check (revenue_usd >= 0),
  check (verification_period_end > verification_period_start)
);

create table if not exists reactions (
  id text primary key,
  listing_id text not null references listings(id) on delete cascade,
  user_id text not null references users(id) on delete cascade,
  type text not null check (type in ('love', 'laugh')),
  created_at integer not null,
  unique (listing_id, user_id, type)
);

create table if not exists reaction_rate_events (
  id integer primary key autoincrement,
  user_id text not null references users(id) on delete cascade,
  created_at integer not null
);

create table if not exists verification_claims (
  nonce text primary key,
  user_id text not null references users(id) on delete cascade,
  kind text not null check (kind in ('tokens', 'revenue')),
  used_at integer not null
);

create index if not exists listings_created_idx on listings(created_at desc);
create index if not exists reactions_listing_type_idx on reactions(listing_id, type);
create index if not exists reactions_user_idx on reactions(user_id);
create index if not exists reaction_rate_events_user_created_idx on reaction_rate_events(user_id, created_at desc);
