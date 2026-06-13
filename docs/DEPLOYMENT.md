# Deployment

This repo follows Phase `8a` and Phase `8b` from `step_wise_solution.md`.

## Phase 8a

- Use Lovable for the first stakeholder demo.
- Keep Supabase, Interakt, and n8n running in the cloud.
- Point the generated UI to the same Supabase project used by the webhook and workflows.

## Phase 8b

### Frontend

```bash
cd apps/web
npm install
npm run build
```

Deploy the contents through Vercel using:

```bash
vercel link
vercel --prod
```

Required frontend environment variables:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
VITE_N8N_APPROVAL_WEBHOOK_URL
```

### Supabase

- Push `supabase/migrations/0001_init.sql` through `0004_automation_helpers.sql`
- Deploy:
  - `interakt-webhook`
  - `send-whatsapp`
  - `invoice-engine`
  - `create-quotation` (optional helper for manual quoting)
- Confirm the public `invoices` storage bucket exists

### n8n

- Import every workflow from `n8n/workflows/`
- Attach credentials for:
  - Google AI Studio / Gemini
  - Google Sheets
- Keep the intake webhook URL aligned with `N8N_WEBHOOK_URL`
- Set `N8N_SHEETS_SYNC_WEBHOOK_URL` to the imported `04-google-sheets-sync.json` webhook path
- Set `GOOGLE_SHEETS_DOCUMENT_ID` to the production spreadsheet id
- Set the n8n instance env vars for `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, and the Interakt template names

### Supabase Secrets

- Set `INTERAKT_API_KEY` for the `send-whatsapp` Edge Function
- Set `OPENAI_API_KEY` for `interakt-webhook` voice-note transcription

### Interakt

- Move from test sender to the approved WhatsApp Business sender
- Set the production incoming webhook URL to the deployed Supabase `interakt-webhook`

### Google Sheets

- Provide the production sheet id in `04-google-sheets-sync.json`
- Grant the n8n service account edit access
