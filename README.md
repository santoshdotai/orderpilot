# OrderPilot

**OrderPilot** is an AI-powered WhatsApp sales and order management platform designed to help businesses automate customer communication, quotation creation, follow-ups, and sales workflows.

## Project Overview

OrderPilot helps businesses handle incoming customer orders from WhatsApp text and voice notes, process them with AI, and route them through an automated sales workflow.

## Core Workflow

1. Customer sends a WhatsApp message or voice note.
2. Interakt WhatsApp Business API receives the message.
3. Interakt webhook forwards the message data to the OrderPilot AI backend.
4. The message is stored in the Supabase database.
5. If the customer sends a voice note, the audio is transcribed.
6. Gemini AI or OpenAI processes the message.
7. AI extracts products, quantities, urgency, and delivery details.
8. `n8n` automation workflows execute business logic.
9. A quotation draft is generated automatically.
10. The sales team reviews and approves the quotation.
11. The dashboard updates analytics, leads, and follow-up reminders.

## Message Flow

`Customer WhatsApp Message -> Interakt WhatsApp Business API -> OrderPilot AI Backend -> Supabase Database -> Gemini AI / OpenAI -> n8n Automation -> Quotation / Reply Sent via Interakt WhatsApp`

## WhatsApp Architecture

OrderPilot now uses the Interakt WhatsApp Business API for all messaging. There is no local Baileys session or WhatsApp socket to run on this machine.

- Inbound messages flow from Interakt webhook to the Supabase Edge Function `interakt-webhook`, which stores the message and voice-note transcript, then into n8n.
- Outbound replies flow from n8n to the Supabase Edge Function `send-whatsapp`, then to Interakt, and finally to the customer.
- The local root server is only a lightweight health check placeholder.
- Set the Interakt incoming webhook to `https://<your-project>.supabase.co/functions/v1/interakt-webhook`.

## Use Case

- Customers send orders through WhatsApp text or voice notes.
- AI interprets products and quantities automatically.
- Quotations are drafted instantly.
- Sales teams can respond faster.
- AI follow-ups help prevent missed opportunities.
- The dashboard provides business insights and tracking.

## Applications and Services Used

### Frontend UI

- Lovable for prototype and UI generation
- React
- Tailwind CSS

### Backend

- Supabase
- `n8n`
- SQL
- Supabase Auth + RLS

### WhatsApp Integration

- Interakt WhatsApp Business API

### AI Layer

- Gemini AI
- OpenAI

### Automation

- `n8n` workflow automations

### Deployment

- Lovable deployment initially
- Future deployment on Vercel or Netlify

## Final Goal

OrderPilot AI aims to become **an AI sales operating system for WhatsApp-based businesses**.

The platform should automate:

- Lead management
- Quotation generation
- Customer communication
- Follow-ups
- Sales workflow through AI-powered WhatsApp operations
