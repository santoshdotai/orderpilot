# Local Run

Follow the same build order from `step_wise_solution.md`.

## Phase 7 Commands

```bash
# 1. Link and push the Supabase schema
supabase link --project-ref <your-ref>
supabase db push

# 2. Seed the product catalog
supabase db seed

# 3. Deploy edge functions
supabase functions deploy twilio-webhook --no-verify-jwt
supabase functions deploy invoice-engine

# 4. Run the dashboard
cd apps/web
npm install
npm run dev

# 5. Run n8n locally
docker run -p 5678:5678 n8nio/n8n
```

## Twilio Intake URL

Set Twilio Sandbox "When a message comes in" to:

```text
https://<your-project>.functions.supabase.co/twilio-webhook
```

## Approval Workflow Hook

Set `VITE_N8N_APPROVAL_WEBHOOK_URL` to the imported Phase `5.3` n8n workflow webhook path.

## Smoke Test

1. Send a WhatsApp order or voice note to the Twilio sandbox number.
2. Confirm the webhook stores a row in `messages`.
3. Confirm `ai_extractions` and a draft `quotations` row are created.
4. Open `/quotations` in the dashboard and click `Approve & Send`.
5. Confirm the approval workflow sends the quotation, generates an invoice PDF, and mirrors the record into Google Sheets.
