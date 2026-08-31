-- user_settings is updated only after the rest of a customer's plan saves.
-- Realtime clients use that completed write as the signal to reload the plan.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'user_settings'
  ) then
    alter publication supabase_realtime add table public.user_settings;
  end if;
end
$$;
