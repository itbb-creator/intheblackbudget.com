-- Give every budget entry an explicit month so devices edit the same period
-- instead of treating all rows as one timeless budget.
alter table public.budget_entries
  add column if not exists budget_month date;

update public.budget_entries
set budget_month = date_trunc('month', coalesce(created_at, now()))::date
where budget_month is null;

alter table public.budget_entries
  alter column budget_month set default date_trunc('month', now())::date,
  alter column budget_month set not null,
  add constraint budget_entries_month_start_check
    check (budget_month = date_trunc('month', budget_month)::date);

create index if not exists budget_entries_user_month_idx
  on public.budget_entries (user_id, budget_month, sort_order);
