create table if not exists wall_products (
  id text primary key,
  product_name text not null,
  product_url text not null unique,
  product_description text not null default '',
  product_logo_url text,
  builder_label text not null default 'independent builder',
  visit_count integer not null default 0,
  created_at integer not null,
  updated_at integer not null,
  check (length(product_name) between 2 and 80),
  check (length(product_description) <= 320),
  check (product_url like 'http://%' or product_url like 'https://%')
);

create index if not exists wall_products_created_idx on wall_products(created_at desc);
