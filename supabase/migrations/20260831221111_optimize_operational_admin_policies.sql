drop policy "Admins read operational events" on public.operational_events;
create policy "Admins read operational events"
on public.operational_events for select to authenticated
using (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');

drop policy "Customers read own feedback" on public.app_feedback;
drop policy "Admins read all feedback" on public.app_feedback;
create policy "Customers or admins read feedback"
on public.app_feedback for select to authenticated
using (
  (select auth.uid()) = user_id
  or ((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin'
);

drop policy "Admins update feedback workflow" on public.app_feedback;
create policy "Admins update feedback workflow"
on public.app_feedback for update to authenticated
using (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin')
with check (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');
