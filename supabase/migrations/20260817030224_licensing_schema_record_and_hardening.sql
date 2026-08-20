alter function public.touch_updated_at() set search_path = '';

alter view public.license_audit set (security_invoker = true);

drop policy if exists "Licensed files: service role only" on storage.objects;
create policy "Licensed files: service role only"
  on storage.objects for all
  to service_role
  using (bucket_id in ('workbook-masters', 'licensed-workbooks'))
  with check (bucket_id in ('workbook-masters', 'licensed-workbooks'));

revoke all on table public.licenses, public.license_events, public.stripe_events from anon, authenticated;
grant all on table public.licenses, public.license_events, public.stripe_events to service_role;
grant usage, select on sequence public.license_events_id_seq to service_role;
revoke all on table public.license_audit from anon, authenticated;
grant select on table public.license_audit to service_role;;
