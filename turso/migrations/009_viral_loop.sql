alter table listings add column funded_cents integer not null default 0
  check (funded_cents >= 0 and funded_cents % 100 = 0);

alter table listings add column entry_source text not null default 'paid'
  check (entry_source in ('paid', 'launch_free', 'seed'));

update listings
set funded_cents = case
  when stripe_checkout_session_id is not null then bid_cents
  else 0
end;

update listings
set entry_source = case
  when stripe_checkout_session_id is not null then 'paid'
  else 'seed'
end;

create index if not exists listings_funded_rank_idx
  on listings(funded_cents desc, created_at asc);

create table if not exists launch_free_slots (
  slot_number integer primary key check (slot_number between 1 and 5),
  submission_id text unique,
  listing_id text unique references listings(id) on delete set null,
  claimed_at integer
);

insert or ignore into launch_free_slots (slot_number) values (1), (2), (3), (4), (5);

-- The original real founder profile predates launch passes. Count it as the
-- first legitimate profile without counting the explicitly seeded demo.
update launch_free_slots
set submission_id = (
      select owner_user_id from listings
      where id = 'c11714b0-b302-4f6b-be60-7136b0648198'
    ),
    listing_id = 'c11714b0-b302-4f6b-be60-7136b0648198',
    claimed_at = (
      select created_at from listings
      where id = 'c11714b0-b302-4f6b-be60-7136b0648198'
    )
where slot_number = 1
  and submission_id is null
  and exists (
    select 1 from listings
    where id = 'c11714b0-b302-4f6b-be60-7136b0648198'
  );

update listings
set entry_source = 'launch_free'
where id = 'c11714b0-b302-4f6b-be60-7136b0648198';

create table if not exists product_visits (
  id integer primary key autoincrement,
  listing_id text not null references listings(id) on delete cascade,
  product_url text not null,
  visitor_id text not null,
  visit_day text not null,
  source text not null check (source in ('leaderboard', 'quick_view', 'listing', 'battle')),
  created_at integer not null,
  unique (listing_id, product_url, visitor_id, visit_day)
);

create index if not exists product_visits_listing_created_idx
  on product_visits(listing_id, created_at desc);

create table if not exists battle_votes (
  id text primary key,
  week_key text not null,
  viewer_id text not null references users(id) on delete cascade,
  listing_a_id text not null references listings(id) on delete cascade,
  listing_b_id text not null references listings(id) on delete cascade,
  chosen_listing_id text not null references listings(id) on delete cascade,
  created_at integer not null,
  updated_at integer not null,
  check (listing_a_id < listing_b_id),
  check (chosen_listing_id = listing_a_id or chosen_listing_id = listing_b_id),
  unique (week_key, viewer_id, listing_a_id, listing_b_id)
);

create index if not exists battle_votes_week_winner_idx
  on battle_votes(week_key, chosen_listing_id);
