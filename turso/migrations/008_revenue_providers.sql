alter table listings add column revenue_provider text not null default 'stripe'
  check (revenue_provider in ('stripe', 'polar', 'lemon_squeezy', 'paddle', 'dodo_payments', 'easytools'));

alter table pending_submissions add column revenue_provider text not null default 'stripe'
  check (revenue_provider in ('stripe', 'polar', 'lemon_squeezy', 'paddle', 'dodo_payments', 'easytools'));
