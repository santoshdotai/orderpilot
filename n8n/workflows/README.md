# n8n Workflows

Import these workflow skeletons into n8n Cloud or self-hosted n8n and replace placeholder URLs, credentials, and environment references with your project-specific values.

- `01-order-intake.json`
  - Phase `5.2`
  - Handles `Webhook -> Whisper -> Gemini/OpenAI fallback -> ai_extractions -> quotations -> Twilio ack -> follow_up scheduling`
- `02-quotation-approval-send.json`
  - Phase `5.3`
  - Handles dashboard approval webhook, quotation delivery, invoice generation via the Supabase `invoice-engine` Edge Function, and post-send updates
- `03-follow-up-cron.json`
  - Phase `5.4`
  - Runs every 15 minutes to send reminders and mark due follow-ups complete
- `04-google-sheets-sync.json`
  - Architecture companion to `best_solution.md` section `4.1`
  - Mirrors product catalog, quotations, orders, and invoices between Supabase and Google Sheets
