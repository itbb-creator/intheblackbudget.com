alter table public.licenses
  add column if not exists product_update_consent boolean not null default false,
  add column if not exists marketing_consent boolean not null default false,
  add column if not exists consent_recorded_at timestamptz,
  add column if not exists consent_source text,
  add column if not exists unsubscribe_token uuid not null default gen_random_uuid(),
  add column if not exists unsubscribed_at timestamptz;

create unique index if not exists licenses_unsubscribe_token_idx
  on public.licenses (unsubscribe_token);

comment on column public.licenses.product_update_consent is
  'Optional consent for workbook release notices and founding-cohort check-ins.';
comment on column public.licenses.marketing_consent is
  'Optional consent for offers, tips, and other promotional email.';
comment on column public.licenses.consent_source is
  'Where consent was captured, such as website_checkout_2026_08.';
