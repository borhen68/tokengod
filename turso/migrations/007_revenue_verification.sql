alter table listings add column revenue_verification text not null default 'stripe'
  check (revenue_verification in ('stripe', 'self_reported'));
