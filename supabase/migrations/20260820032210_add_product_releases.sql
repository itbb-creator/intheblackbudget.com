-- Versioned workbook releases and customer update delivery.
-- This table is private: only server-side service-role code may read or write it.
create table public.product_releases (
  id            uuid primary key default gen_random_uuid(),
  product       text not null check (product in ('essentials', 'complete', 'premium')),
  version       text not null check (version ~ '^[0-9]+\.[0-9]+\.[0-9]+$'),
  title         text not null,
  summary       text,
  added         text[] not null default '{}',
  changed       text[] not null default '{}',
  fixed         text[] not null default '{}',
  master_path   text not null,
  is_current    boolean not null default false,
  published_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (product, version)
);

create unique index product_releases_one_current_per_product_idx
  on public.product_releases (product)
  where is_current;

create index product_releases_published_idx
  on public.product_releases (published_at desc)
  where published_at is not null;

alter table public.product_releases enable row level security;
revoke all on table public.product_releases from anon, authenticated;
grant all on table public.product_releases to service_role;

create trigger product_releases_touch_updated_at
  before update on public.product_releases
  for each row execute function public.touch_updated_at();

alter table public.licenses
  add column issued_release_id uuid references public.product_releases(id),
  add column issued_version text;

create index licenses_issued_release_idx on public.licenses (issued_release_id);

comment on table public.product_releases is
  'Private release changelog and versioned master-workbook registry.';
comment on column public.product_releases.master_path is
  'Object path in the private workbook-masters bucket, e.g. premium/1.1.0/premium.xlsx.';
