create extension if not exists "pgcrypto";

-- Customers
create table customers (
  id uuid primary key default gen_random_uuid(),
  whatsapp_phone text unique not null,
  name text,
  language text default 'en',
  created_at timestamptz default now()
);

-- Raw WhatsApp messages
create table messages (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers(id),
  direction text check (direction in ('in','out')),
  body text,
  media_url text,
  twilio_sid text,
  created_at timestamptz default now()
);

-- Voice-note transcripts
create table transcriptions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid references messages(id),
  text text,
  model text,
  created_at timestamptz default now()
);

-- AI extraction results
create table ai_extractions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid references messages(id),
  products jsonb,           -- [{sku, name, qty}]
  urgency text,
  delivery jsonb,           -- {address, date}
  raw_response jsonb,
  created_at timestamptz default now()
);

-- Product catalog
create table products (
  id uuid primary key default gen_random_uuid(),
  sku text unique,
  name text not null,
  price numeric(12,2),
  stock int default 0
);

-- Quotations
create table quotations (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers(id),
  status text default 'draft', -- draft | approved | sent | rejected
  total numeric(12,2),
  approved_by uuid,
  created_at timestamptz default now()
);

create table quotation_items (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid references quotations(id) on delete cascade,
  product_id uuid references products(id),
  qty int,
  unit_price numeric(12,2)
);

-- Follow-ups
create table follow_ups (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers(id),
  remind_at timestamptz,
  reason text,
  done boolean default false
);
