-- Stable app-side keys let existing browser records migrate without exposing
-- database identity values or risking collisions between customers.

alter table public.budget_entries drop constraint budget_entries_goal_owner_fk;
alter table public.budget_entries drop constraint budget_entries_goal_type_check;
alter table public.budget_entries drop column goal_id;

alter table public.goals add column client_key text not null;
alter table public.budget_entries add column client_key text not null;
alter table public.budget_entries add column goal_client_key text;
alter table public.debts add column client_key text not null;
alter table public.net_worth_items add column client_key text not null;

alter table public.goals add constraint goals_user_client_key_unique unique (user_id, client_key);
alter table public.budget_entries add constraint budget_entries_user_client_key_unique unique (user_id, client_key);
alter table public.debts add constraint debts_user_client_key_unique unique (user_id, client_key);
alter table public.net_worth_items add constraint net_worth_items_user_client_key_unique unique (user_id, client_key);

alter table public.budget_entries add constraint budget_entries_goal_client_owner_fk
  foreign key (user_id, goal_client_key)
  references public.goals(user_id, client_key)
  on update cascade
  on delete cascade;

alter table public.budget_entries add constraint budget_entries_goal_client_type_check check (
  (entry_type = 'Goal' and goal_client_key is not null) or
  (entry_type <> 'Goal' and goal_client_key is null)
);
