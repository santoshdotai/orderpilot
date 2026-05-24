import { supabase } from "./supabase";
import type {
  AIExtraction,
  AnalyticsSnapshot,
  Customer,
  FollowUp,
  InboxMessage,
  Invoice,
  MessageRecord,
  Product,
  Quotation,
  QuotationItem,
} from "./types";

function toNumber(value: unknown) {
  if (value === null || value === undefined) {
    return null;
  }

  const numeric = Number(value);
  return Number.isNaN(numeric) ? null : numeric;
}

function uniqueIds(values: Array<string | null | undefined>) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

async function fetchCustomerMap(customerIds: Array<string | null | undefined>) {
  const ids = uniqueIds(customerIds);

  if (!ids.length) {
    return new Map<string, Customer>();
  }

  const { data, error } = await supabase
    .from("customers")
    .select("id, whatsapp_phone, name, language, segment, created_at")
    .in("id", ids);

  if (error) {
    throw error;
  }

  return new Map((data ?? []).map((customer) => [customer.id, customer as Customer]));
}

async function fetchProductMap(productIds: Array<string | null | undefined>) {
  const ids = uniqueIds(productIds);

  if (!ids.length) {
    return new Map<string, Product>();
  }

  const { data, error } = await supabase
    .from("products")
    .select("id, sku, name, price, stock")
    .in("id", ids);

  if (error) {
    throw error;
  }

  return new Map(
    (data ?? []).map((product) => [
      product.id,
      {
        ...product,
        price: toNumber(product.price),
        stock: toNumber(product.stock),
      } as Product,
    ]),
  );
}

function mapQuotationItemsByQuotationId(
  rows: Array<{
    id: string;
    quotation_id: string;
    product_id: string | null;
    qty: number | string | null;
    unit_price: number | string | null;
  }>,
  productMap: Map<string, Product>,
) {
  const itemsByQuotationId = new Map<string, QuotationItem[]>();

  rows.forEach((row) => {
    const item: QuotationItem = {
      id: row.id,
      quotation_id: row.quotation_id,
      product_id: row.product_id,
      qty: Number(row.qty ?? 0),
      unit_price: Number(row.unit_price ?? 0),
      product: row.product_id ? productMap.get(row.product_id) ?? null : null,
    };

    const bucket = itemsByQuotationId.get(row.quotation_id) ?? [];
    bucket.push(item);
    itemsByQuotationId.set(row.quotation_id, bucket);
  });

  return itemsByQuotationId;
}

export async function enrichInboxMessages(rows: MessageRecord[]) {
  const customerMap = await fetchCustomerMap(rows.map((row) => row.customer_id));
  const messageIds = rows.map((row) => row.id);

  let extractionMap = new Map<string, InboxMessage["aiExtraction"]>();

  if (messageIds.length) {
    const { data: extractions, error: extractionsError } = await supabase
      .from("ai_extractions")
      .select("id, message_id, products, urgency, delivery, created_at")
      .in("message_id", messageIds)
      .order("created_at", { ascending: false });

    if (extractionsError) {
      throw extractionsError;
    }

    extractionMap = new Map();

    (extractions ?? []).forEach((extraction) => {
      if (extractionMap.has(extraction.message_id)) {
        return;
      }

      extractionMap.set(extraction.message_id, {
        id: extraction.id,
        message_id: extraction.message_id,
        products: (extraction.products as AIExtraction["products"]) ?? null,
        urgency: (extraction.urgency as AIExtraction["urgency"]) ?? null,
        delivery: (extraction.delivery as AIExtraction["delivery"]) ?? null,
        raw_response: null,
        created_at: extraction.created_at,
      });
    });
  }

  return rows.map((row) => ({
    ...row,
    customer: row.customer_id ? customerMap.get(row.customer_id) ?? null : null,
    transcription: null,
    aiExtraction: extractionMap.get(row.id) ?? null,
  })) as InboxMessage[];
}

export async function fetchInboxMessages() {
  const { data, error } = await supabase
    .from("messages")
    .select("id, customer_id, direction, body, media_url, twilio_sid, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    throw error;
  }

  const rows = ((data ?? []) as MessageRecord[]).map((row) => ({
    ...row,
    twilio_sid: row.twilio_sid ?? null,
  }));

  return enrichInboxMessages(rows);
}

export async function fetchQuotations() {
  const { data, error } = await supabase
    .from("quotations")
    .select("id, customer_id, status, total, approved_by, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  const quotationRows = (data ?? []) as Array<{
    id: string;
    customer_id: string | null;
    status: Quotation["status"];
    total: number | string | null;
    approved_by: string | null;
    created_at: string;
  }>;

  const quotationIds = quotationRows.map((row) => row.id);
  const customerMap = await fetchCustomerMap(quotationRows.map((row) => row.customer_id));

  let itemsByQuotationId = new Map<string, QuotationItem[]>();

  if (quotationIds.length) {
    const { data: itemRows, error: itemsError } = await supabase
      .from("quotation_items")
      .select("id, quotation_id, product_id, qty, unit_price")
      .in("quotation_id", quotationIds);

    if (itemsError) {
      throw itemsError;
    }

    const items = (itemRows ?? []) as Array<{
      id: string;
      quotation_id: string;
      product_id: string | null;
      qty: number | string | null;
      unit_price: number | string | null;
    }>;

    const productMap = await fetchProductMap(items.map((item) => item.product_id));
    itemsByQuotationId = mapQuotationItemsByQuotationId(items, productMap);
  }

  return quotationRows.map((row) => {
    const items = itemsByQuotationId.get(row.id) ?? [];

    return {
      id: row.id,
      customer_id: row.customer_id,
      status: row.status,
      total: toNumber(row.total) ?? items.reduce((sum, item) => sum + item.qty * item.unit_price, 0),
      approved_by: row.approved_by,
      created_at: row.created_at,
      customer: row.customer_id ? customerMap.get(row.customer_id) ?? null : null,
      items,
    } satisfies Quotation;
  });
}

export async function approveAndSendQuotation(quotationId: string) {
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  const userId = userData.user?.id ?? null;
  const updatePayload: { status: "approved"; approved_by?: string | null } = { status: "approved" };

  if (userId) {
    updatePayload.approved_by = userId;
  }

  const { error: updateError } = await supabase
    .from("quotations")
    .update(updatePayload)
    .eq("id", quotationId);

  if (updateError) {
    throw updateError;
  }

  if (userId) {
    const { error: auditError } = await supabase
      .from("audit_log")
      .insert({ user_id: userId, action: "quotation_approved", target_id: quotationId });

    if (auditError) {
      throw auditError;
    }
  }

  const approvalWebhook = import.meta.env.VITE_N8N_APPROVAL_WEBHOOK_URL;

  if (approvalWebhook) {
    const response = await fetch(approvalWebhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quotationId }),
    });

    if (!response.ok) {
      throw new Error("Quotation approved in Supabase, but the n8n approval webhook returned an error.");
    }
  }
}

export async function fetchCustomers() {
  const { data, error } = await supabase
    .from("customers")
    .select("id, whatsapp_phone, name, language, segment, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as Customer[];
}

export async function fetchProducts() {
  const { data, error } = await supabase
    .from("products")
    .select("id, sku, name, price, stock")
    .order("name", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []).map((product) => ({
    ...product,
    price: toNumber(product.price),
    stock: toNumber(product.stock),
  })) as Product[];
}

export async function saveProduct(product: Product) {
  const payload = {
    sku: product.sku,
    name: product.name,
    price: product.price !== null ? Number(product.price) : null,
    stock: product.stock !== null ? Number(product.stock) : null,
  };

  if (product.id) {
    const { error } = await supabase.from("products").update(payload).eq("id", product.id);

    if (error) {
      throw error;
    }

    return;
  }

  const { error } = await supabase.from("products").insert(payload);

  if (error) {
    throw error;
  }
}

export async function deleteProduct(productId: string) {
  const { error } = await supabase.from("products").delete().eq("id", productId);

  if (error) {
    throw error;
  }
}

export async function fetchFollowUps() {
  const { data, error } = await supabase
    .from("follow_ups")
    .select("id, customer_id, remind_at, reason, done, created_at")
    .order("remind_at", { ascending: true });

  if (error) {
    throw error;
  }

  const followUpRows = (data ?? []) as Array<{
    id: string;
    customer_id: string | null;
    remind_at: string | null;
    reason: string | null;
    done: boolean;
    created_at: string;
  }>;

  const customerMap = await fetchCustomerMap(followUpRows.map((row) => row.customer_id));

  return followUpRows.map((row) => ({
    id: row.id,
    customer_id: row.customer_id,
    remind_at: row.remind_at,
    reason: row.reason,
    done: Boolean(row.done),
    created_at: row.created_at,
    customer: row.customer_id ? customerMap.get(row.customer_id) ?? null : null,
  })) as FollowUp[];
}

export async function markFollowUpDone(followUpId: string) {
  const { error } = await supabase
    .from("follow_ups")
    .update({ done: true })
    .eq("id", followUpId);

  if (error) {
    throw error;
  }
}

export async function snoozeFollowUp(followUpId: string, hours = 24) {
  const remindAt = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
  const { error } = await supabase
    .from("follow_ups")
    .update({ remind_at: remindAt, done: false })
    .eq("id", followUpId);

  if (error) {
    throw error;
  }
}

export async function fetchInvoices() {
  const { data, error } = await supabase
    .from("invoices")
    .select("id, invoice_number, customer_id, total, tax, status, due_date, pdf_url, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  const invoiceRows = (data ?? []) as Array<{
    id: string;
    invoice_number: string | null;
    customer_id: string | null;
    total: number | string | null;
    tax: number | string | null;
    status: string | null;
    due_date: string | null;
    pdf_url: string | null;
    created_at: string;
  }>;

  const customerMap = await fetchCustomerMap(invoiceRows.map((row) => row.customer_id));

  return invoiceRows.map((row) => ({
    id: row.id,
    invoice_number: row.invoice_number,
    customer_id: row.customer_id,
    total: toNumber(row.total),
    tax: toNumber(row.tax),
    status: row.status,
    due_date: row.due_date,
    pdf_url: row.pdf_url,
    created_at: row.created_at,
    customer: row.customer_id ? customerMap.get(row.customer_id) ?? null : null,
  })) as Invoice[];
}

export async function fetchAnalytics(): Promise<AnalyticsSnapshot> {
  const [
    { data: messages, error: messagesError },
    { data: quotations, error: quotationsError },
    { data: followUps, error: followUpsError },
    { data: invoices, error: invoicesError },
    { data: payments, error: paymentsError },
  ] = await Promise.all([
    supabase.from("messages").select("id, direction"),
    supabase.from("quotations").select("id, status"),
    supabase.from("follow_ups").select("id, done"),
    supabase.from("invoices").select("id, status, total, due_date"),
    supabase.from("payments").select("id, amount"),
  ]);

  if (messagesError) {
    throw messagesError;
  }

  if (quotationsError) {
    throw quotationsError;
  }

  if (followUpsError) {
    throw followUpsError;
  }

  if (invoicesError) {
    throw invoicesError;
  }

  if (paymentsError) {
    throw paymentsError;
  }

  const messageRows = messages ?? [];
  const quotationRows = quotations ?? [];
  const followUpRows = followUps ?? [];
  const invoiceRows = invoices ?? [];
  const paymentRows = payments ?? [];

  return {
    inboundMessages: messageRows.filter((item) => item.direction === "in").length,
    draftQuotes: quotationRows.filter((item) => item.status === "draft").length,
    approvedQuotes: quotationRows.filter((item) => item.status === "approved").length,
    sentQuotes: quotationRows.filter((item) => item.status === "sent").length,
    confirmedOrders: invoiceRows.length,
    openFollowUps: followUpRows.filter((item) => !item.done).length,
    invoicedRevenue: invoiceRows.reduce((sum, item) => sum + Number(item.total ?? 0), 0),
    paidRevenue: paymentRows.reduce((sum, item) => sum + Number(item.amount ?? 0), 0),
    overdueInvoices: invoiceRows.filter((item) => {
      if (item.status === "overdue") {
        return true;
      }

      if (!item.due_date || item.status === "paid") {
        return false;
      }

      return new Date(item.due_date).getTime() < Date.now();
    }).length,
  };
}
