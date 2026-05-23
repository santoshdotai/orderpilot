# Hardening Checklist

Phase `9` items mapped to this repo:

- [ ] Add Twilio webhook signature validation inside [supabase/functions/twilio-webhook/index.ts](/Users/shubham9162/Desktop/Order_Pilot_AI/supabase/functions/twilio-webhook/index.ts)
- [ ] Replace permissive RLS policies in [0003_rls.sql](/Users/shubham9162/Desktop/Order_Pilot_AI/supabase/migrations/0003_rls.sql) with tenant-aware policies once tenant ownership fields are finalized
- [ ] Keep all AI and Twilio secrets server-side only in Supabase and n8n
- [ ] Add request throttling and retry controls to the AI calls in [ai.ts](/Users/shubham9162/Desktop/Order_Pilot_AI/supabase/functions/shared/ai.ts)
- [ ] Add Sentry or equivalent monitoring for the React dashboard and Edge Functions
- [ ] Verify Gemini failover to OpenAI using the fallback helpers in [ai.ts](/Users/shubham9162/Desktop/Order_Pilot_AI/supabase/functions/shared/ai.ts)
- [ ] Enable Supabase PITR backups and confirm Storage retention for invoice PDFs
- [ ] Expose GDPR export/delete operations for `customers`, `messages`, `transcriptions`, `ai_extractions`, `quotations`, and `invoices`
- [ ] Confirm `audit_log` insert paths for quotation approvals and invoice generation
