create or replace function private.check_business_transaction_balance()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare target_id bigint; line_count integer; debit_total numeric(14,2); credit_total numeric(14,2); posted boolean;
begin
  target_id := case when tg_op = 'DELETE' then old.transaction_id else new.transaction_id end;
  select status = 'posted' into posted from public.business_transactions where id = target_id;
  if posted is not true then return null; end if;
  select count(*), coalesce(sum(debit),0), coalesce(sum(credit),0)
    into line_count, debit_total, credit_total
    from public.business_transaction_lines where transaction_id = target_id;
  if line_count < 2 or debit_total <> credit_total or debit_total <= 0 then
    raise exception 'Posted business transactions require at least two balanced lines';
  end if;
  return null;
end $$;
revoke execute on function private.check_business_transaction_balance() from public, anon;
grant execute on function private.check_business_transaction_balance() to authenticated;

create constraint trigger business_transaction_lines_balance
after insert or update or delete on public.business_transaction_lines
deferrable initially deferred for each row
execute function private.check_business_transaction_balance();
