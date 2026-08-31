create table public.business_accounts (
  id bigint generated always as identity primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  code text not null check (length(code) between 1 and 20),
  name text not null check (length(trim(name)) between 1 and 160),
  account_type text not null check (account_type in ('asset','liability','equity','income','expense')),
  subtype text,
  active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(owner_id, code), unique(owner_id, id)
);

create table public.business_contacts (
  id bigint generated always as identity primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  contact_type text not null check (contact_type in ('customer','vendor','both')),
  name text not null check (length(trim(name)) between 1 and 160),
  email text, phone text, address text, tax_id_last4 text check (tax_id_last4 is null or tax_id_last4 ~ '^[0-9]{4}$'),
  notes text check (notes is null or length(notes) <= 2000),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(owner_id, id)
);

create table public.business_reconciliations (
  id bigint generated always as identity primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  account_id bigint not null,
  statement_end_date date not null,
  statement_balance numeric(14,2) not null,
  status text not null default 'open' check (status in ('open','completed')),
  completed_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  foreign key(owner_id, account_id) references public.business_accounts(owner_id, id) on delete restrict,
  unique(owner_id, id)
);

create table public.business_transactions (
  id bigint generated always as identity primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  transaction_date date not null,
  description text not null check (length(trim(description)) between 1 and 240),
  contact_id bigint,
  reference text,
  memo text check (memo is null or length(memo) <= 2000),
  receipt_path text,
  reconciliation_id bigint,
  status text not null default 'posted' check (status in ('draft','posted','void')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  foreign key(owner_id, contact_id) references public.business_contacts(owner_id, id) on delete set null,
  foreign key(owner_id, reconciliation_id) references public.business_reconciliations(owner_id, id) on delete set null,
  unique(owner_id, id)
);

create table public.business_transaction_lines (
  id bigint generated always as identity primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  transaction_id bigint not null,
  account_id bigint not null,
  description text,
  debit numeric(14,2) not null default 0 check (debit >= 0),
  credit numeric(14,2) not null default 0 check (credit >= 0),
  created_at timestamptz not null default now(),
  check ((debit > 0 and credit = 0) or (credit > 0 and debit = 0)),
  foreign key(owner_id, transaction_id) references public.business_transactions(owner_id, id) on delete cascade,
  foreign key(owner_id, account_id) references public.business_accounts(owner_id, id) on delete restrict
);

create table public.business_invoices (
  id bigint generated always as identity primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  invoice_number text not null check (length(invoice_number) between 1 and 40),
  customer_id bigint not null,
  issue_date date not null, due_date date not null,
  status text not null default 'draft' check (status in ('draft','sent','partial','paid','void','overdue')),
  notes text, tax_amount numeric(14,2) not null default 0 check (tax_amount >= 0),
  amount_paid numeric(14,2) not null default 0 check (amount_paid >= 0),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  foreign key(owner_id, customer_id) references public.business_contacts(owner_id, id) on delete restrict,
  unique(owner_id, invoice_number), unique(owner_id, id)
);

create table public.business_invoice_items (
  id bigint generated always as identity primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  invoice_id bigint not null,
  description text not null check (length(trim(description)) between 1 and 240),
  quantity numeric(12,3) not null default 1 check (quantity > 0),
  unit_price numeric(14,2) not null check (unit_price >= 0),
  created_at timestamptz not null default now(),
  foreign key(owner_id, invoice_id) references public.business_invoices(owner_id, id) on delete cascade
);

create table public.business_recurring_expenses (
  id bigint generated always as identity primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  vendor_id bigint,
  name text not null check (length(trim(name)) between 1 and 160),
  amount numeric(14,2) not null check (amount >= 0),
  expense_account_id bigint not null, payment_account_id bigint not null,
  frequency text not null check (frequency in ('monthly','quarterly','annual')),
  next_due_date date, active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  foreign key(owner_id, vendor_id) references public.business_contacts(owner_id, id) on delete set null,
  foreign key(owner_id, expense_account_id) references public.business_accounts(owner_id, id) on delete restrict,
  foreign key(owner_id, payment_account_id) references public.business_accounts(owner_id, id) on delete restrict
);

create table public.business_audit_log (
  id bigint generated always as identity primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  table_name text not null, record_id text not null, action text not null check (action in ('INSERT','UPDATE','DELETE')),
  changed_at timestamptz not null default now(), snapshot jsonb not null
);

create index business_transactions_owner_date_idx on public.business_transactions(owner_id, transaction_date desc);
create index business_lines_transaction_idx on public.business_transaction_lines(transaction_id);
create index business_lines_account_idx on public.business_transaction_lines(account_id);
create index business_invoices_owner_status_idx on public.business_invoices(owner_id, status);
create index business_audit_owner_changed_idx on public.business_audit_log(owner_id, changed_at desc);

do $$ declare t text; begin
  foreach t in array array['business_accounts','business_contacts','business_reconciliations','business_transactions','business_transaction_lines','business_invoices','business_invoice_items','business_recurring_expenses','business_audit_log'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from anon, authenticated', t);
    if t = 'business_audit_log' then
      execute format('grant select on table public.%I to authenticated', t);
      execute format('create policy "Admin reads own %1$s" on public.%1$I for select to authenticated using (((select auth.jwt())->''app_metadata''->>''role'') = ''admin'' and (select auth.uid()) = owner_id)', t);
    else
      execute format('grant select, insert, update, delete on table public.%I to authenticated', t);
      execute format('create policy "Admin reads own %1$s" on public.%1$I for select to authenticated using (((select auth.jwt())->''app_metadata''->>''role'') = ''admin'' and (select auth.uid()) = owner_id)', t);
      execute format('create policy "Admin creates own %1$s" on public.%1$I for insert to authenticated with check (((select auth.jwt())->''app_metadata''->>''role'') = ''admin'' and (select auth.uid()) = owner_id)', t);
      execute format('create policy "Admin updates own %1$s" on public.%1$I for update to authenticated using (((select auth.jwt())->''app_metadata''->>''role'') = ''admin'' and (select auth.uid()) = owner_id) with check (((select auth.jwt())->''app_metadata''->>''role'') = ''admin'' and (select auth.uid()) = owner_id)', t);
      execute format('create policy "Admin deletes own %1$s" on public.%1$I for delete to authenticated using (((select auth.jwt())->''app_metadata''->>''role'') = ''admin'' and (select auth.uid()) = owner_id)', t);
    end if;
  end loop;
end $$;

grant usage, select on all sequences in schema public to authenticated;

create schema if not exists private;
create or replace function private.audit_business_change() returns trigger language plpgsql security definer set search_path = '' as $$
declare row_data jsonb; row_owner uuid; row_id text;
begin
  row_data := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  row_owner := (row_data->>'owner_id')::uuid;
  row_id := row_data->>'id';
  if (select auth.uid()) is null or (select auth.uid()) <> row_owner or ((select auth.jwt())->'app_metadata'->>'role') <> 'admin' then raise exception 'Accounting audit authorization failed'; end if;
  insert into public.business_audit_log(owner_id, table_name, record_id, action, snapshot) values(row_owner, tg_table_name, row_id, tg_op, row_data);
  return case when tg_op = 'DELETE' then old else new end;
end $$;
revoke execute on function private.audit_business_change() from public, anon, authenticated;

do $$ declare t text; begin
  foreach t in array array['business_accounts','business_contacts','business_reconciliations','business_transactions','business_transaction_lines','business_invoices','business_invoice_items','business_recurring_expenses'] loop
    execute format('create trigger audit_%1$s after insert or update or delete on public.%1$I for each row execute function private.audit_business_change()', t);
  end loop;
end $$;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values('business-receipts','business-receipts',false,10485760,array['application/pdf','image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false, file_size_limit=excluded.file_size_limit, allowed_mime_types=excluded.allowed_mime_types;

create policy "Admin reads own business receipts" on storage.objects for select to authenticated using(bucket_id='business-receipts' and ((select auth.jwt())->'app_metadata'->>'role')='admin' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy "Admin uploads own business receipts" on storage.objects for insert to authenticated with check(bucket_id='business-receipts' and ((select auth.jwt())->'app_metadata'->>'role')='admin' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy "Admin updates own business receipts" on storage.objects for update to authenticated using(bucket_id='business-receipts' and ((select auth.jwt())->'app_metadata'->>'role')='admin' and (storage.foldername(name))[1]=(select auth.uid())::text) with check(bucket_id='business-receipts' and ((select auth.jwt())->'app_metadata'->>'role')='admin' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy "Admin deletes own business receipts" on storage.objects for delete to authenticated using(bucket_id='business-receipts' and ((select auth.jwt())->'app_metadata'->>'role')='admin' and (storage.foldername(name))[1]=(select auth.uid())::text);
