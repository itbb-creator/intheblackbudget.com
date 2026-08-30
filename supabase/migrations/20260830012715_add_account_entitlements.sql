-- Link licensed workbooks to verified Pravely accounts while preserving the
-- existing purchase-based delivery flow.

alter table public.licenses
  add column if not exists user_id uuid references auth.users(id) on delete set null,
  add column if not exists license_source text not null default 'purchase'
    check (license_source in ('purchase', 'account_free'));

create index if not exists licenses_user_idx on public.licenses (user_id, created_at desc);

create unique index if not exists licenses_free_user_product_idx
  on public.licenses (user_id, product)
  where license_source = 'account_free' and user_id is not null;

-- Customer identity and authorization stay behind authenticated Edge
-- Functions. Direct table access remains denied for anon/authenticated roles.
revoke all on table public.licenses from anon, authenticated;
grant all on table public.licenses to service_role;
