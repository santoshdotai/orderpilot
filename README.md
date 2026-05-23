# OrderPilot

**OrderPilot** is an AI-powered WhatsApp sales and order management platform designed to help businesses automate customer communication, quotation creation, follow-ups, and sales workflows.

## Project Overview

OrderPilot helps businesses handle incoming customer orders from WhatsApp text and voice notes, process them with AI, and route them through an automated sales workflow.

## Core Workflow

1. Customer sends a WhatsApp message or voice note.
2. Twilio WhatsApp API receives the message.
3. Twilio webhook forwards the message data to the OrderPilot AI backend.
4. The message is stored in the Supabase database.
5. If the customer sends a voice note, the audio is transcribed.
6. Gemini AI or OpenAI processes the message.
7. AI extracts products, quantities, urgency, and delivery details.
8. `n8n` automation workflows execute business logic.
9. A quotation draft is generated automatically.
10. The sales team reviews and approves the quotation.
11. The dashboard updates analytics, leads, and follow-up reminders.

## Message Flow

`Customer WhatsApp Message -> Twilio WhatsApp API -> OrderPilot AI Backend -> Supabase Database -> Gemini AI / OpenAI -> n8n Automation -> Quotation / Reply Sent via Twilio WhatsApp`

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

- Twilio WhatsApp API

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
