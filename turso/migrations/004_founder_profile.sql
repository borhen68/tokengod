alter table pending_submissions add column founder_name text;

alter table pending_submissions add column founder_avatar_url text
  check (founder_avatar_url is null or founder_avatar_url like 'https://pbs.twimg.com/%');
