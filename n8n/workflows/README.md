# n8n Workflows

Import these workflow skeletons into n8n Cloud or self-hosted n8n and replace placeholder URLs, credentials, and environment references with your project-specific values.

The current runtime path is:

- `interakt-webhook` stores the inbound message in Supabase.
- Voice notes are normalized to text before they reach the intake workflow.
- n8n handles quotation creation, approval delivery, follow-up scheduling, and Sheets sync.

- `01-order-intake.json`
  - Phase `5.2`
  - Handles `Webhook -> Gemini/OpenAI extraction -> ai_extractions -> quotations -> Interakt order_received -> follow_up scheduling`
- `02-quotation-approval-send.json`
  - Phase `5.3`
  - Handles dashboard approval webhook, quotation delivery, invoice generation via the Supabase `invoice-engine` Edge Function, and post-send updates via Interakt
- `03-follow-up-cron.json`
  - Phase `5.4`
  - Runs every 15 minutes to send Interakt reminders and mark due follow-ups complete
- `04-google-sheets-sync.json`
  - Architecture companion to `best_solution.md` section `4.1`
  - Mirrors product catalog, quotations, orders, and invoices between Supabase and Google Sheets

## Required Setup

### n8n environment / workflow variables

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`
- `GEMINI_API_KEY`
- `N8N_WEBHOOK_URL`
- `N8N_SHEETS_SYNC_WEBHOOK_URL`
- `GOOGLE_SHEETS_DOCUMENT_ID`
- `INTERAKT_ORDER_RECEIVED_TEMPLATE_NAME`
- `INTERAKT_INVOICE_READY_TEMPLATE_NAME`
- `INTERAKT_FOLLOWUP_TEMPLATE_NAME` (`followup_regarding_case` in the screenshot you shared)

### n8n credential

- `Google Sheets OAuth2 API`

### Supabase function secret

- `INTERAKT_API_KEY`
