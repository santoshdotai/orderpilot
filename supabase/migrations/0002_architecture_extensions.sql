-- Extend the Step 2.2 bootstrap schema to match the architecture tables in best_solution.md 4.2.

create table if not exists users (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text unique,
  role text not null default 'sales' check (role in ('admin', 'sales', 'finance')),
  created_at timestamptz default now()
);

alter table customers
  add column if not exists segment text default 'unclassified';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'quotations_approved_by_fkey'
  ) then
    alter table quotations
      add constraint quotations_approved_by_fkey
      foreign key (approved_by) references users(id);
  end if;
end
$$;

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid references quotations(id) on delete set null,
  customer_id uuid references customers(id),
  status text not null default 'confirmed' check (status in ('confirmed', 'processing', 'fulfilled', 'cancelled')),
  notes text,
  created_at timestamptz default now()
);

create table if not exists invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text unique not null,
  quotation_id uuid unique references quotations(id) on delete set null,
  order_id uuid references orders(id) on delete set null,
  customer_id uuid references customers(id),
  subtotal numeric(12,2) default 0,
  tax_total numeric(12,2) default 0,
  total numeric(12,2) default 0,
  status text not null default 'draft' check (status in ('draft', 'sent', 'paid', 'overdue')),
  due_date date,
  pdf_url text,
  sent_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid references invoices(id) on delete cascade,
  product_id uuid references products(id),
  description text,
  qty int not null default 1,
  unit_price numeric(12,2) not null default 0,
  tax numeric(12,2) not null default 0,
  line_total numeric(12,2) not null default 0
);

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid references invoices(id) on delete cascade,
  amount numeric(12,2) not null,
  method text,
  reference text,
  paid_at timestamptz default now(),
  created_at timestamptz default now()
);

create table if not exists sheet_sync_log (
  id uuid primary key default gen_random_uuid(),
  entity_name text not null,
  entity_id uuid,
  sheet_name text not null,
  sheet_row_id text,
  row_hash text,
  direction text not null default 'push' check (direction in ('push', 'pull')),
  synced_at timestamptz default now(),
  last_error text
);

create table if not exists audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  payload jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create index if not exists idx_messages_customer_id on messages(customer_id);
create index if not exists idx_messages_created_at on messages(created_at desc);
create index if not exists idx_transcriptions_message_id on transcriptions(message_id);
create index if not exists idx_ai_extractions_message_id on ai_extractions(message_id);
create index if not exists idx_quotation_items_quotation_id on quotation_items(quotation_id);
create index if not exists idx_follow_ups_done_remind_at on follow_ups(done, remind_at);
create index if not exists idx_orders_customer_id on orders(customer_id);
create index if not exists idx_invoices_customer_id on invoices(customer_id);
create index if not exists idx_invoice_items_invoice_id on invoice_items(invoice_id);
create index if not exists idx_payments_invoice_id on payments(invoice_id);
create index if not exists idx_sheet_sync_log_entity on sheet_sync_log(entity_name, entity_id);
create index if not exists idx_audit_log_entity on audit_log(entity_type, entity_id);

insert into storage.buckets (id, name, public)
values ('invoices', 'invoices', true)
on conflict (id) do nothing;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email),
    new.email
  )
  on conflict (id) do update
  set
    full_name = excluded.full_name,
    email = excluded.email;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
