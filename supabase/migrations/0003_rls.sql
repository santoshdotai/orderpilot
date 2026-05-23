alter table customers enable row level security;
alter table messages enable row level security;
alter table transcriptions enable row level security;
alter table ai_extractions enable row level security;
alter table products enable row level security;
alter table quotations enable row level security;
alter table quotation_items enable row level security;
alter table follow_ups enable row level security;
alter table users enable row level security;
alter table orders enable row level security;
alter table invoices enable row level security;
alter table invoice_items enable row level security;
alter table payments enable row level security;
alter table sheet_sync_log enable row level security;
alter table audit_log enable row level security;

drop policy if exists "authenticated customers select" on customers;
create policy "authenticated customers select"
on customers
for select
to authenticated
using (true);

drop policy if exists "authenticated customers write" on customers;
create policy "authenticated customers write"
on customers
for all
to authenticated
using (true)
with check (true);

drop policy if exists "authenticated messages select" on messages;
create policy "authenticated messages select"
on messages
for select
to authenticated
using (true);

drop policy if exists "authenticated messages write" on messages;
create policy "authenticated messages write"
on messages
for all
to authenticated
using (true)
with check (true);

drop policy if exists "authenticated transcriptions select" on transcriptions;
create policy "authenticated transcriptions select"
on transcriptions
for select
to authenticated
using (true);

drop policy if exists "authenticated transcriptions write" on transcriptions;
create policy "authenticated transcriptions write"
on transcriptions
for all
to authenticated
using (true)
with check (true);

drop policy if exists "authenticated ai_extractions select" on ai_extractions;
create policy "authenticated ai_extractions select"
on ai_extractions
for select
to authenticated
using (true);

drop policy if exists "authenticated ai_extractions write" on ai_extractions;
create policy "authenticated ai_extractions write"
on ai_extractions
for all
to authenticated
using (true)
with check (true);

drop policy if exists "authenticated products select" on products;
create policy "authenticated products select"
on products
for select
to authenticated
using (true);

drop policy if exists "authenticated products write" on products;
create policy "authenticated products write"
on products
for all
to authenticated
using (true)
with check (true);

drop policy if exists "authenticated quotations select" on quotations;
create policy "authenticated quotations select"
on quotations
for select
to authenticated
using (true);

drop policy if exists "authenticated quotations write" on quotations;
create policy "authenticated quotations write"
on quotations
for all
to authenticated
using (true)
with check (true);

drop policy if exists "authenticated quotation_items select" on quotation_items;
create policy "authenticated quotation_items select"
on quotation_items
for select
to authenticated
using (true);

drop policy if exists "authenticated quotation_items write" on quotation_items;
create policy "authenticated quotation_items write"
on quotation_items
for all
to authenticated
using (true)
with check (true);

drop policy if exists "authenticated follow_ups select" on follow_ups;
create policy "authenticated follow_ups select"
on follow_ups
for select
to authenticated
using (true);

drop policy if exists "authenticated follow_ups write" on follow_ups;
create policy "authenticated follow_ups write"
on follow_ups
for all
to authenticated
using (true)
with check (true);

drop policy if exists "users can read own profile" on users;
create policy "users can read own profile"
on users
for select
to authenticated
using (id = auth.uid());

drop policy if exists "users can update own profile" on users;
create policy "users can update own profile"
on users
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "authenticated orders select" on orders;
create policy "authenticated orders select"
on orders
for select
to authenticated
using (true);

drop policy if exists "authenticated orders write" on orders;
create policy "authenticated orders write"
on orders
for all
to authenticated
using (true)
with check (true);

drop policy if exists "authenticated invoices select" on invoices;
create policy "authenticated invoices select"
on invoices
for select
to authenticated
using (true);

drop policy if exists "authenticated invoices write" on invoices;
create policy "authenticated invoices write"
on invoices
for all
to authenticated
using (true)
with check (true);

drop policy if exists "authenticated invoice_items select" on invoice_items;
create policy "authenticated invoice_items select"
on invoice_items
for select
to authenticated
using (true);

drop policy if exists "authenticated invoice_items write" on invoice_items;
create policy "authenticated invoice_items write"
on invoice_items
for all
to authenticated
using (true)
with check (true);

drop policy if exists "authenticated payments select" on payments;
create policy "authenticated payments select"
on payments
for select
to authenticated
using (true);

drop policy if exists "authenticated payments write" on payments;
create policy "authenticated payments write"
on payments
for all
to authenticated
using (true)
with check (true);

drop policy if exists "authenticated sheet_sync_log select" on sheet_sync_log;
create policy "authenticated sheet_sync_log select"
on sheet_sync_log
for select
to authenticated
using (true);

drop policy if exists "authenticated sheet_sync_log write" on sheet_sync_log;
create policy "authenticated sheet_sync_log write"
on sheet_sync_log
for all
to authenticated
using (true)
with check (true);

drop policy if exists "authenticated audit_log select" on audit_log;
create policy "authenticated audit_log select"
on audit_log
for select
to authenticated
using (true);

drop policy if exists "authenticated audit_log insert" on audit_log;
create policy "authenticated audit_log insert"
on audit_log
for insert
to authenticated
with check (actor_user_id = auth.uid() or actor_user_id is null);

drop policy if exists "authenticated invoice bucket access" on storage.objects;
create policy "authenticated invoice bucket access"
on storage.objects
for all
to authenticated
using (bucket_id = 'invoices')
with check (bucket_id = 'invoices');
