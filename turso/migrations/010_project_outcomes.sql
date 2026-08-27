alter table listings add column project_outcome text not null default 'revenue'
  check (project_outcome in ('revenue', 'pre_revenue', 'shut_down'));

alter table listings add column founder_lesson text not null default ''
  check (length(founder_lesson) <= 180);

alter table pending_submissions add column project_outcome text not null default 'revenue'
  check (project_outcome in ('revenue', 'pre_revenue', 'shut_down'));

alter table pending_submissions add column founder_lesson text not null default ''
  check (length(founder_lesson) <= 180);

update listings
set project_outcome = 'pre_revenue'
where revenue_usd = 0;

update pending_submissions
set project_outcome = 'pre_revenue'
where revenue_usd = 0;
