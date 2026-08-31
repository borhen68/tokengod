alter table wall_products add column paid_cents integer not null default 100 check (paid_cents >= 100);
alter table wall_products add column stripe_checkout_session_id text;

create unique index if not exists wall_products_checkout_idx
  on wall_products(stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;

create index if not exists wall_products_paid_idx on wall_products(paid_cents desc, created_at asc);

create table if not exists pending_wall_products (
  id text primary key,
  product_name text not null,
  product_url text not null,
  product_description text not null default '',
  product_logo_url text,
  paid_cents integer not null check (paid_cents >= 100),
  stripe_checkout_session_id text not null unique,
  status text not null default 'pending' check (status in ('pending', 'completed')),
  wall_product_id text,
  created_at integer not null,
  expires_at integer not null
);

create index if not exists pending_wall_products_status_idx
  on pending_wall_products(status, expires_at);
