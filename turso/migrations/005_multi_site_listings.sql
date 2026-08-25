alter table listings add column products_json text;

alter table pending_submissions add column products_json text;

alter table pending_submissions add column site_fee_cents integer not null default 0
  check (site_fee_cents >= 0 and site_fee_cents % 100 = 0);
