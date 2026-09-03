-- The seven-day evaluation includes the entire product so customers can make
-- an informed purchase decision. Purchased plans remain unchanged.
create or replace function private.start_app_trial()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.app_entitlements (
    user_id, plan_id, status, provider, trial_started_at, trial_ends_at
  ) values (
    new.id, 'complete', 'trialing', 'pravely', now(), now() + interval '7 days'
  ) on conflict (user_id) do nothing;
  return new;
end;
$$;

revoke all on function private.start_app_trial() from public, anon, authenticated;

update public.app_entitlements
set plan_id = 'complete', updated_at = now()
where status = 'trialing' and trial_ends_at > now();
