# OrderPilot - Step-by-Step Build Guide

> Companion to [BEST_SOLUTION.md](BEST_SOLUTION.md). Follow these phases in order. Every original Readme detail is preserved and mapped to an actionable step.

---

## Phase 0 - Prerequisites & Accounts

Before writing any code, create accounts and collect API keys for:

1. **GitHub** - source control for the repo.
2. **Supabase** - https://supabase.com (free tier is enough to start).
3. **Interakt** - https://interakt.shop - connect your approved WhatsApp Business sender and webhook.
4. **Google AI Studio** - https://aistudio.google.com - for Gemini API key.
5. **OpenAI** - https://platform.openai.com - for fallback + Whisper transcription.
6. **n8n** - either n8n Cloud (https://n8n.io) or self-host on Railway/Render.
7. **Lovable** - https://lovable.dev - for Phase 1 UI generation.
8. **Vercel** - https://vercel.com - for Phase 2 production deployment.

Install local tools:

```bash
# Node.js 20+
node -v

# pnpm (preferred) or npm
npm i -g pnpm

# Supabase CLI
npm i -g supabase

# Optional: Vercel CLI
npm i -g vercel
```

---

## Phase 1 - Project Setup

### Step 1.1 - Initialize the repo

```bash
cd c:/Users/IN0346/company_project/OrderPilot
git init
git branch -M main
```

### Step 1.2 - Create the folder layout

```
OrderPilot/
├── apps/
│   └── web/                  # React + Vite + Tailwind dashboard
├── supabase/
│   ├── migrations/           # SQL migrations
│   └── functions/            # Edge Functions (Interakt webhook, AI calls)
├── n8n/
│   └── workflows/            # Exported n8n JSON workflows
├── docs/
│   ├── BEST_SOLUTION.md
│   └── BUILD_GUIDE.md
├── .env.example
├── .gitignore
└── Readme.md
```

### Step 1.3 - Set up environment variables

Create `.env.example`:

```
# Supabase
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Interakt
INTERAKT_API_KEY=

# AI
GEMINI_API_KEY=
OPENAI_API_KEY=

# n8n
N8N_WEBHOOK_URL=
```

---

## Phase 2 - Supabase Backend

### Step 2.1 - Create the Supabase project

1. Go to https://supabase.com → New Project.
2. Save the URL, anon key, and service role key into your `.env`.

### Step 2.2 - Define the database schema

Create `supabase/migrations/0001_init.sql`:

```sql
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
```

Apply it:

```bash
supabase link --project-ref <your-ref>
supabase db push
```

### Step 2.3 - Enable Row Level Security

For every table:

```sql
alter table customers enable row level security;
-- Repeat for all tables, then add policies for your sales team role.
```

### Step 2.4 - Auth setup

In Supabase Dashboard → Authentication:
- Enable Email + Password (for sales team).
- Optionally enable Google OAuth.

---

## Phase 3 - Interakt WhatsApp Integration

### Step 3.1 - Activate the Interakt sender

1. Interakt Dashboard → connect your approved WhatsApp Business sender.
2. Verify the sender and webhook settings in Interakt.

### Step 3.2 - Create the webhook (Supabase Edge Function)

Create `supabase/functions/interakt-webhook/index.ts`:

```ts
import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

serve(async (req) => {
  const form = await req.formData();
  const from = form.get("From")?.toString() ?? "";
  const body = form.get("Body")?.toString() ?? "";
  const mediaUrl = form.get("MediaUrl0")?.toString() ?? null;

  // 1. Upsert customer
  const { data: customer } = await supabase
    .from("customers")
    .upsert({ whatsapp_phone: from })
    .select()
    .single();

  // 2. Store the message
  const { data: msg } = await supabase
    .from("messages")
    .insert({
      customer_id: customer!.id,
      direction: "in",
      body,
      media_url: mediaUrl,
    })
    .select()
    .single();

  // 3. Forward to n8n for AI + business logic
  await fetch(Deno.env.get("N8N_WEBHOOK_URL")!, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messageId: msg!.id, body, mediaUrl, from }),
  });

  return new Response("<Response></Response>", {
    headers: { "Content-Type": "application/xml" },
  });
});
```

Deploy:

```bash
supabase functions deploy interakt-webhook --no-verify-jwt
```

### Step 3.3 - Point Interakt at the function

In the Interakt webhook settings, set the incoming URL to:
`https://<your-project>.functions.supabase.co/interakt-webhook` (HTTP POST).

---

## Phase 4 - AI Layer

### Step 4.1 - Voice note transcription

If `mediaUrl` is present and content-type is audio, send it to **OpenAI Whisper**:

```ts
const audio = await fetch(mediaUrl).then(r => r.blob());
const fd = new FormData();
fd.append("file", audio, "voice.ogg");
fd.append("model", "whisper-1");

const transcript = await fetch("https://api.openai.com/v1/audio/transcriptions", {
  method: "POST",
  headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
  body: fd,
}).then(r => r.json());
```

Store the result in `transcriptions`.

### Step 4.2 - Extract products + intent with Gemini

Prompt template (kept in n8n or an edge function):

```
You are an order-extraction assistant for a B2B WhatsApp seller.
Return strict JSON with keys: products[{sku?, name, qty}], urgency (low|medium|high),
delivery({address?, date?}).

Customer message:
"""
<MESSAGE_OR_TRANSCRIPT>
"""
```

Call Gemini 1.5 Pro (or `gemini-2.0-flash`) and store the parsed JSON into `ai_extractions`.

### Step 4.3 - Fallback to OpenAI

If Gemini returns an error or low-confidence JSON, retry with GPT-4o using the same prompt.

---

## Phase 5 - n8n Automation Workflows

### Step 5.1 - Install n8n

Easiest: use **n8n Cloud**. For self-host:

```bash
docker run -it --rm -p 5678:5678 -v ~/.n8n:/home/node/.n8n n8nio/n8n
```

### Step 5.2 - Build the core workflow

Trigger: **Webhook node** (URL goes into `N8N_WEBHOOK_URL`).

Nodes in order:

1. **Webhook** - receives `{messageId, body, mediaUrl, from}` from Supabase.
2. **IF mediaUrl exists** - call Whisper HTTP node + write to `transcriptions`.
3. **HTTP Request** to Gemini API with the extraction prompt.
4. **Function node** - parse JSON, validate schema.
5. **Supabase node** - insert into `ai_extractions`.
6. **Function node** - match product names against `products` table (fuzzy + sku lookup).
7. **Supabase node** - create a `quotations` row with `status='draft'` + line items.
8. **Interakt send-whatsapp node** - send the `order_received` template to the customer.
9. **Schedule node** - if no human approves within 30 min, create a `follow_ups` row.

### Step 5.3 - Approval + send workflow

A second n8n workflow triggered when a sales rep clicks **Approve** in the dashboard:

1. **Webhook from dashboard** with `quotationId`.
2. **Supabase node** - fetch quotation + items + customer phone.
3. **Function node** - render WhatsApp message (or PDF link).
4. **Interakt send-whatsapp node** - send the `invoice_ready` template to the customer.
5. **Supabase node** - update `quotations.status = 'sent'`.

### Step 5.4 - Follow-up workflow

Cron node every 15 min:
- Query `follow_ups` where `remind_at <= now() and done=false`.
- Send a friendly WhatsApp nudge via Interakt.
- Mark `done=true`.

---

## Phase 6 - Frontend Dashboard

### Step 6.1 - Generate the UI with Lovable (Phase 1)

In Lovable, prompt:

> "Build a React + Tailwind dashboard for OrderPilot. Pages: Login, Inbox (live WhatsApp messages), Quotations (draft/approved/sent), Customers, Products, Follow-ups, Analytics. Use Supabase for auth should support search and filters."

Export the project as a GitHub repo into `apps/web/`.

### Step 6.2 - Wire Supabase client

`apps/web/src/lib/supabase.ts`:

```ts
import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);
```

### Step 6.3 - Build the key screens

| Screen | Data source | Key actions |
|---|---|---|
| **Inbox** | `messages` (Realtime subscription) | View text/voice, see transcript, see AI extraction |
| **Quotations** | `quotations` + `quotation_items` | Edit lines, **Approve & Send** (calls n8n webhook) |
| **Customers** | `customers` | View history, tag, segment |
| **Products** | `products` | CRUD catalog |
| **Follow-ups** | `follow_ups` | Snooze, mark done |
| **Analytics** | views over `quotations` + `orders` | KPIs: response time, conversion, revenue |

### Step 6.4 - Realtime updates

```ts
supabase
  .channel("messages")
  .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" },
    payload => addMessage(payload.new))
  .subscribe();
```

---

## Phase 7 - Local Development Run

```bash
# 1. Run Supabase locally (optional)
supabase start

# 2. Run the dashboard
cd apps/web
pnpm install
pnpm dev

# 3. Tunnel Interakt to your local edge function (only if testing locally)
ngrok http 54321
# Set the ngrok URL as the Interakt webhook temporarily.

# 4. n8n
docker run -p 5678:5678 n8nio/n8n
```

End-to-end smoke test:
1. Send a WhatsApp message through the Interakt sender.
2. Watch the message appear in Supabase `messages`.
3. Confirm `ai_extractions` row is created.
4. Confirm a draft quotation appears in the dashboard.
5. Approve it → confirm the customer receives the reply.

---

## Phase 8 - Deployment

### Phase 8a - Initial (Lovable Deployment)

Per the Readme: **deploy the prototype dashboard on Lovable** for first stakeholder demos. Supabase + Interakt + n8n already live in the cloud.

### Phase 8b - Production (Vercel / Netlify)

1. Push `apps/web` to GitHub.
2. `vercel link` → set env vars (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).
3. `vercel --prod`.
4. Promote n8n from Cloud trial to a paid plan, or self-host on Railway with a persistent volume.
5. Verify the approved **Interakt WhatsApp Business sender** for production use.
6. Add Sentry + Supabase logs for observability.

---

## Phase 9 - Hardening Checklist

- [ ] RLS policies on every table, tested with a non-admin user.
- [ ] Interakt webhook authenticity validation in the Edge Function.
- [ ] Secrets only in Supabase Edge Function env (never in the frontend).
- [ ] Rate limiting on AI calls (cost guardrail).
- [ ] Gemini + OpenAI failover tested.
- [ ] Backup strategy: Supabase daily PITR enabled.
- [ ] GDPR: customer data export + delete endpoint.
- [ ] Audit log on every quotation approval.

---

## Phase 10 - Mapping Back to the Original Readme

| Readme item | Where it lives in this build |
|---|---|
| Customer sends WhatsApp message or voice note | Phase 3 (Interakt sender + webhook) |
| Interakt WhatsApp Business API receives message | Phase 3.1 |
| Interakt webhook forwards to OrderPilot AI backend | Phase 3.2 (Supabase Edge Function) |
| Message stored in Supabase | Phase 2.2 + Phase 3.2 |
| Voice note → AI transcription | Phase 4.1 (Whisper) |
| Gemini / OpenAI processes message | Phase 4.2 + 4.3 |
| AI extracts products, qty, urgency, delivery | Phase 4.2 (`ai_extractions` table) |
| n8n automation executes business logic | Phase 5 |
| Quotation draft generated automatically | Phase 5.2 step 7 |
| Sales team reviews and approves | Phase 6 (Quotations screen) + Phase 5.3 |
| Dashboard updates analytics, leads, follow-ups | Phase 6.3 + Phase 5.4 |
| Frontend: Lovable + React + Tailwind | Phase 6.1 |
| Backend: Supabase + Postgres + Auth + RLS | Phase 2 |
| WhatsApp: Interakt | Phase 3 |
| AI: Gemini / OpenAI | Phase 4 |
| Automation: n8n | Phase 5 |
| Deployment: Lovable now, Vercel/Netlify later | Phase 8a + 8b |
| Final goal: AI Sales OS for WhatsApp business | Achieved end of Phase 8b |

---

## Phase 11 - Suggested Build Order (TL;DR)

1. **Day 1-2:** Phase 0 + 1 (accounts, repo, scaffolding).
2. **Day 3-4:** Phase 2 (Supabase schema + auth + RLS).
3. **Day 5:** Phase 3 (Interakt sender + webhook).
4. **Day 6-7:** Phase 4 (AI extraction + voice transcription).
5. **Day 8-10:** Phase 5 (n8n workflows).
6. **Day 11-14:** Phase 6 (Lovable dashboard + Realtime).
7. **Day 15:** Phase 7 (end-to-end smoke test).
8. **Day 16:** Phase 8a (Lovable demo deploy).
9. **Day 17-20:** Phase 8b + Phase 9 (Vercel prod + hardening).

You now have the **AI Sales Operating System for WhatsApp-based businesses** described in the original Readme.
