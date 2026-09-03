-- New accounts receive the full Plus experience for seven days. Purchased
-- entitlements continue to replace the trial through the Stripe webhook.
alter table public.app_entitlements
  drop constraint if exists app_entitlements_status_check;

alter table public.app_entitlements
  alter column plan_id set default 'plus',
  alter column status set default 'trialing',
  add column if not exists trial_started_at timestamptz,
  add column if not exists trial_ends_at timestamptz,
  add constraint app_entitlements_status_check
    check (status in ('trialing', 'active', 'expired', 'refunded', 'revoked'));

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

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
    new.id, 'plus', 'trialing', 'pravely', now(), now() + interval '7 days'
  ) on conflict (user_id) do nothing;
  return new;
end;
$$;

revoke all on function private.start_app_trial() from public, anon, authenticated;

drop trigger if exists start_pravely_app_trial on auth.users;
create trigger start_pravely_app_trial
after insert on auth.users
for each row execute function private.start_app_trial();

-- Resolved feedback may be permanently removed by an administrator. Customer
-- ownership alone never authorizes deletion.
grant delete on table public.app_feedback to authenticated;
drop policy if exists "Admins delete resolved feedback" on public.app_feedback;
create policy "Admins delete resolved feedback"
on public.app_feedback for delete to authenticated
using (
  ((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin'
  and status = 'resolved'
);
