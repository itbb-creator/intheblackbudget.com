create table if not exists public.app_feedback (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  user_email text not null,
  category text not null check (char_length(category) between 1 and 80),
  rating smallint not null check (rating between 1 and 5),
  message text not null check (char_length(message) between 1 and 5000),
  status text not null default 'new' check (status in ('new', 'reviewing', 'resolved')),
  created_at timestamptz not null default now()
);

alter table public.app_feedback enable row level security;

revoke all on table public.app_feedback from anon, authenticated;
grant insert on table public.app_feedback to authenticated;
grant usage, select on sequence public.app_feedback_id_seq to authenticated;

create policy "Signed-in customers can submit feedback"
on public.app_feedback
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create index if not exists app_feedback_created_at_idx on public.app_feedback (created_at desc);
