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
supabase functions deploy interakt-webhook --no-verify-jwt
supabase functions deploy send-whatsapp
supabase functions deploy invoice-engine
# Optional: deploy the manual quotation helper too
# supabase functions deploy create-quotation

# 4. Run the dashboard
cd apps/web
npm install
npm run dev

# 5. Run n8n locally
docker run -p 5678:5678 n8nio/n8n
```

If you use local n8n instead of n8n Cloud, make it publicly reachable with a tunnel
before testing webhook callbacks from Supabase or Interakt. Otherwise, use n8n Cloud
for the end-to-end flow.

## Interakt Intake URL

Set Interakt inbound webhook URL to:

```text
https://<your-project>.functions.supabase.co/interakt-webhook
```

## n8n Import Order

Import the workflows in this order:

1. `n8n/workflows/01-order-intake.json`
1. `n8n/workflows/02-quotation-approval-send.json`
1. `n8n/workflows/03-follow-up-cron.json`
1. `n8n/workflows/04-google-sheets-sync.json`

Then set these n8n values in instance env / workflow variables:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`
- `GEMINI_API_KEY`
- `N8N_WEBHOOK_URL`
- `N8N_SHEETS_SYNC_WEBHOOK_URL`
- `GOOGLE_SHEETS_DOCUMENT_ID`
- `INTERAKT_ORDER_RECEIVED_TEMPLATE_NAME`
- `INTERAKT_INVOICE_READY_TEMPLATE_NAME`
- `INTERAKT_FOLLOWUP_TEMPLATE_NAME`

Also create one n8n credential:

- `Google Sheets OAuth2 API`

`INTERAKT_API_KEY` is used by the Supabase `send-whatsapp` function, not by n8n.

## What To Run

1. Deploy or start Supabase, then push schema and seed data.
2. Deploy the Supabase edge functions.
3. Start the dashboard.
4. Start n8n or open your n8n Cloud instance.
5. Import the four workflow JSON files in order.
6. Add the Google Sheets credential and set the env/variables above.
7. Activate the workflows.

## How To Check Everything

1. Open the dashboard and confirm it loads without auth or network errors.
2. Send a WhatsApp text message through Interakt and confirm:
   - a row appears in `messages`
   - `ai_extractions` is created
   - a draft `quotations` row is created
   - `follow_ups` gets a row
3. Send a WhatsApp voice note and confirm:
   - `interakt-webhook` creates a transcription row
   - the transcript text appears in the inbound message flow
4. Open `/quotations` in the dashboard and click `Approve & Send`.
5. Confirm the approval flow:
   - generates an invoice PDF
   - sends the invoice template through Interakt
   - writes an invoice row into Google Sheets
   - writes a record into `sheet_sync_log`
6. Open the Google Sheet and confirm the invoice tab has these columns:
   - `id`
   - `invoice_number`
   - `customer_id`
   - `total`
   - `tax`
   - `status`
   - `due_date`
   - `pdf_url`

## Approval Workflow Hook

Set `VITE_N8N_APPROVAL_WEBHOOK_URL` to the imported Phase `5.3` n8n workflow webhook path.

The expected production webhook paths are:

- Intake: `/webhook/orderpilot-intake`
- Approval: `/webhook/orderpilot-approval-send`
- Sheets sync: `/webhook/orderpilot-sheets-sync`

## Smoke Test

1. Send a WhatsApp order or voice note to the Interakt sender.
2. Confirm the webhook stores a row in `messages` and, for voice notes, a transcript in `transcriptions`.
3. Confirm `ai_extractions` and a draft `quotations` row are created.
4. Open `/quotations` in the dashboard and click `Approve & Send`.
5. Confirm the approval workflow sends the quotation, generates an invoice PDF, and mirrors the record into Google Sheets.
