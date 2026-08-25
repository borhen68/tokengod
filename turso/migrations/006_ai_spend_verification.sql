alter table listings add column ai_spend_verification text not null default 'api'
  check (ai_spend_verification in ('api', 'self_reported'));

alter table pending_submissions add column ai_spend_verification text not null default 'api'
  check (ai_spend_verification in ('api', 'self_reported'));
