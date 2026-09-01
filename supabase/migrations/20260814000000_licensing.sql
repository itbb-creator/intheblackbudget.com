-- ============================================================================
-- Pravely — licensing schema
-- Run this in the Supabase SQL editor (or `supabase db push`).
--
-- Creates:
--   1. licenses        — one row per purchase; the customer record the future
--                        web/mobile app will read (status, file, license).
--   2. license_events  — the pipeline audit trail (every step, per license).
--   3. stripe_events   — raw Stripe webhook events (payment audit, idempotency).
--   4. Storage buckets — workbook-masters (your templates) and
--                        licensed-workbooks (customer files), both private.
--
-- Security model: all three tables + both buckets are service-role only.
-- The edge functions use the service-role key; nothing is exposed to
-- anonymous visitors. When you build the customer login later, layer a view
-- + RLS policy scoped to the authenticated user's email on top of licenses.
-- ============================================================================

create table if not exists public.licenses (
  id                    uuid primary key default gen_random_uuid(),
  license_id            text unique not null,          -- PRV-7K4X9P2M
  product               text not null,                 -- essentials | complete | premium
  status                text not null default 'pending'
                        check (status in ('pending', 'issued', 'failed')),
  stripe_session_id     text,
  stripe_customer_id    text,
  stripe_payment_intent text,
  customer_name         text,
  customer_email        text,
  file_path             text,                          -- object path in licensed-workbooks
  file_name             text,                          -- Pravely_Premium_Toolkit_PRV-7K4X9P2M.xlsx
  download_count        integer not null default 0,
  last_download_at      timestamptz,
  email_status          text not null default 'pending',   -- pending | queued | sent
  email_provider        text,                              -- log | resend | ...
  email_preview_html    text,                              -- rendered email until provider wired
  error_message         text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists licenses_stripe_session_idx  on public.licenses (stripe_session_id);
create index if not exists licenses_customer_email_idx on public.licenses (lower(customer_email));
create index if not exists licenses_created_idx         on public.licenses (created_at desc);

-- ----------------------------------------------------------------------------
-- Audit trail: every pipeline step for every license.
-- Query with:
--   select created_at, step, status, detail
--   from license_events where license_id = 'PRV-7K4X9P2M' order by created_at;
-- ----------------------------------------------------------------------------
create table if not exists public.license_events (
  id         bigint generated always as identity primary key,
  license_id text not null,
  step       text not null,          -- payment_received, license_generated,
                                     -- master_fetched, workbook_personalized,
                                     -- workbook_uploaded, signed_url_created,
                                     -- email_queued, email_sent, download_served,
                                     -- pipeline_failed
  status     text not null default 'info' check (status in ('info', 'ok', 'error')),
  detail     text,
  created_at timestamptz not null default now()
);

create index if not exists license_events_license_idx   on public.license_events (license_id, created_at desc);
create index if not exists license_events_step_time_idx on public.license_events (step, created_at);

-- ----------------------------------------------------------------------------
-- Raw Stripe events (idempotency + payment audit).
-- ----------------------------------------------------------------------------
create table if not exists public.stripe_events (
  id           text primary key,      -- Stripe event id (evt_...)
  type         text not null,
  payload      jsonb not null,
  processed    boolean not null default false,
  license_id   text,
  received_at  timestamptz not null default now(),
  processed_at timestamptz
);

create index if not exists stripe_events_processed_idx on public.stripe_events (processed, received_at);

-- ----------------------------------------------------------------------------
-- Private storage buckets. The pipeline reads masters from #1 and writes
-- customer files to #2. Neither is publicly readable; access goes through
-- signed URLs minted by get-download.
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('workbook-masters', 'workbook-masters', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('licensed-workbooks', 'licensed-workbooks', false)
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- Row-level security: enable on all three tables and publish NO policies.
-- With RLS on and zero policies, only the service role (which bypasses RLS)
-- can read/write. Anonymous visitors can't see a thing — this is the
-- "private storage + private records" requirement.
-- ----------------------------------------------------------------------------
alter table public.licenses       enable row level security;
alter table public.license_events enable row level security;
alter table public.stripe_events  enable row level security;

-- Storage: private buckets are already hidden from anon by bucket.public=false.
-- Belt-and-braces: deny-by-default policies on storage.objects so future
-- buckets don't accidentally leak licensed files.
drop policy if exists "Licensed files: service role only" on storage.objects;
create policy "Licensed files: service role only"
  on storage.objects for all
  to service_role
  using (bucket_id in ('workbook-masters', 'licensed-workbooks'))
  with check (bucket_id in ('workbook-masters', 'licensed-workbooks'));

-- ----------------------------------------------------------------------------
-- Keep updated_at fresh.
-- ----------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

alter function public.touch_updated_at() set search_path = '';

drop trigger if exists licenses_touch_updated_at on public.licenses;
create trigger licenses_touch_updated_at
  before update on public.licenses
  for each row execute function public.touch_updated_at();

-- ----------------------------------------------------------------------------
-- Convenience: full audit trail for a license in one query.
-- ----------------------------------------------------------------------------
create or replace view public.license_audit as
select
  l.license_id,
  l.product,
  l.status           as license_status,
  l.customer_name,
  l.customer_email,
  l.file_name,
  l.download_count,
  l.last_download_at,
  l.created_at       as license_created_at,
  e.created_at       as event_at,
  e.step,
  e.status           as event_status,
  e.detail
from public.licenses l
left join public.license_events e on e.license_id = l.license_id;

alter view public.license_audit set (security_invoker = true);

-- Explicit privileges keep the licensing data private even if project-level
-- defaults for objects in public change. RLS remains defense in depth.
revoke all on table public.licenses, public.license_events, public.stripe_events from anon, authenticated;
grant all on table public.licenses, public.license_events, public.stripe_events to service_role;
grant usage, select on sequence public.license_events_id_seq to service_role;
revoke all on table public.license_audit from anon, authenticated;
grant select on table public.license_audit to service_role;
