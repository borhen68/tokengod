alter table listings add column product_logo_url text
  check (product_logo_url is null or product_logo_url like 'http://%' or product_logo_url like 'https://%');

alter table pending_submissions add column product_logo_url text
  check (product_logo_url is null or product_logo_url like 'http://%' or product_logo_url like 'https://%');
