-- Privacy-limited operational telemetry. This table must never contain
-- budgets, balances, categories, notes, goals, or other financial content.
create table public.operational_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null check (event_type in ('usage', 'error')),
  event_name text not null check (length(event_name) between 1 and 100),
  route text check (route is null or length(route) <= 80),
  details jsonb not null default '{}'::jsonb check (
    jsonb_typeof(details) = 'object' and octet_length(details::text) <= 8192
  ),
  created_at timestamptz not null default now()
);

create index operational_events_created_at_idx on public.operational_events(created_at desc);
create index operational_events_user_id_idx on public.operational_events(user_id);
create index operational_events_type_created_idx on public.operational_events(event_type, created_at desc);

alter table public.operational_events enable row level security;
revoke all on table public.operational_events from anon, authenticated;
grant insert, select on table public.operational_events to authenticated;
grant usage, select on sequence public.operational_events_id_seq to authenticated;

create policy "Customers submit own operational events"
on public.operational_events for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "Admins read operational events"
on public.operational_events for select to authenticated
using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

alter table public.app_feedback
  add column if not exists priority text not null default 'normal'
    check (priority in ('low', 'normal', 'high')),
  add column if not exists admin_notes text
    check (admin_notes is null or length(admin_notes) <= 5000),
  add column if not exists updated_at timestamptz not null default now();

grant select on table public.app_feedback to authenticated;
grant update(status, priority, admin_notes, updated_at) on table public.app_feedback to authenticated;

create policy "Customers read own feedback"
on public.app_feedback for select to authenticated
using ((select auth.uid()) = user_id);

create policy "Admins read all feedback"
on public.app_feedback for select to authenticated
using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "Admins update feedback workflow"
on public.app_feedback for update to authenticated
using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
with check ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
