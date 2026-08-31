alter table public.business_transactions drop constraint business_transactions_owner_id_contact_id_fkey;
alter table public.business_transactions add constraint business_transactions_owner_contact_fk foreign key(owner_id, contact_id) references public.business_contacts(owner_id, id) on delete restrict;

alter table public.business_transactions drop constraint business_transactions_owner_id_reconciliation_id_fkey;
alter table public.business_transactions add constraint business_transactions_owner_reconciliation_fk foreign key(owner_id, reconciliation_id) references public.business_reconciliations(owner_id, id) on delete restrict;

alter table public.business_recurring_expenses drop constraint business_recurring_expenses_owner_id_vendor_id_fkey;
alter table public.business_recurring_expenses add constraint business_recurring_owner_vendor_fk foreign key(owner_id, vendor_id) references public.business_contacts(owner_id, id) on delete restrict;
