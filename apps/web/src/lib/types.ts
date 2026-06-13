export type Customer = {
  id: string;
  whatsapp_phone: string;
  name: string | null;
  language: string | null;
  created_at: string;
};

export type MessageRecord = {
  id: string;
  customer_id: string | null;
  direction: "in" | "out";
  body: string | null;
  media_url: string | null;
  twilio_sid: string | null;
  created_at: string;
};

export type Transcription = {
  id: string;
  message_id: string;
  text: string | null;
  model: string | null;
  created_at: string;
};

export type AIExtraction = {
  id: string;
  message_id: string;
  products: AIExtractionProduct[];
  urgency: "low" | "medium" | "high" | null;
  delivery: { address?: string; date?: string } | null;
  raw_response: unknown;
  created_at: string;
};

export type AIExtractionProduct = {
  sku?: string;
  name: string;
  qty: number;
};

export type InboxMessage = MessageRecord & {
  customer: Customer | null;
  transcription: Transcription | null;
  aiExtraction: AIExtraction | null;
};

export type Product = {
  id?: string;
  sku: string | null;
  name: string;
  price: number | null;
  stock: number | null;
};

export type QuotationItem = {
  id: string;
  quotation_id: string;
  product_id: string | null;
  qty: number;
  unit_price: number;
  product: Product | null;
};

export type QuotationInvoice = {
  id: string;
  invoice_number: string | null;
  total: number | null;
  pdf_url: string | null;
};

export type Quotation = {
  id: string;
  customer_id: string | null;
  status: "draft" | "approved" | "sent" | "rejected";
  total: number | null;
  approved_by: string | null;
  created_at: string;
  customer: Customer | null;
  items: QuotationItem[];
  invoice: QuotationInvoice | null;
};

export type FollowUp = {
  id: string;
  customer_id: string | null;
  remind_at: string | null;
  reason: string | null;
  done: boolean;
  customer: Customer | null;
};

export type Invoice = {
  id: string;
  invoice_number: string | null;
  customer_id: string | null;
  total: number | null;
  tax: number | null;
  status: string | null;
  due_date: string | null;
  pdf_url: string | null;
  created_at: string;
  customer: Customer | null;
};

export type AnalyticsSnapshot = {
  inboundMessages: number;
  draftQuotes: number;
  approvedQuotes: number;
  sentQuotes: number;
  confirmedOrders: number;
  openFollowUps: number;
  invoicedRevenue: number;
  paidRevenue: number;
  overdueInvoices: number;
};
