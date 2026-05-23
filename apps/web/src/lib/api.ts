import { supabase } from "./supabase";
import type {
  AnalyticsSnapshot,
  Customer,
  FollowUp,
  InboxMessage,
  Product,
  Quotation,
} from "./types";

type RawRecord = Record<string, unknown>;

function mapInboxMessage(row: RawRecord): InboxMessage {
  return {
    id: row.id as string,
    customer_id: row.customer_id as string | null,
    direction: row.direction as "in" | "out",
    body: row.body as string | null,
    media_url: row.media_url as string | null,
    twilio_sid: row.twilio_sid as string | null,
    created_at: row.created_at as string,
    customer: (row.customers as Customer | null) ?? null,
    transcription: ((row.transcriptions as RawRecord[] | null)?.[0] as InboxMessage["transcription"]) ?? null,
    aiExtraction: ((row.ai_extractions as RawRecord[] | null)?.[0] as InboxMessage["aiExtraction"]) ?? null,
  };
}

function mapQuotation(row: RawRecord): Quotation {
  const items = ((row.quotation_items as RawRecord[] | null) ?? []).map((item) => ({
    id: item.id as string,
    quotation_id: row.id as string,
    product_id: item.product_id as string | null,
    qty: Number(item.qty ?? 0),
    unit_price: Number(item.unit_price ?? 0),
    product: (item.products as Product | null) ?? null,
  }));

  return {
    id: row.id as string,
    customer_id: row.customer_id as string | null,
    status: row.status as Quotation["status"],
    total:
      row.total !== null && row.total !== undefined
        ? Number(row.total)
        : items.reduce((sum, item) => sum + item.qty * item.unit_price, 0),
    approved_by: row.approved_by as string | null,
    created_at: row.created_at as string,
    customer: (row.customers as Customer | null) ?? null,
    items,
  };
}

export async function fetchInboxMessages() {
  const { data, error } = await supabase
    .from("messages")
    .select(`
      id,
      customer_id,
      direction,
      body,
      media_url,
      twilio_sid,
      created_at,
      customers (
        id,
        whatsapp_phone,
        name,
        language,
        segment,
        created_at
      ),
      transcriptions (
        id,
        message_id,
        text,
        model,
        created_at
      ),
      ai_extractions (
        id,
        message_id,
        products,
        urgency,
        delivery,
        raw_response,
        created_at
      )
    `)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw error;
  return (data ?? []).map((row) => mapInboxMessage(row as RawRecord));
}

export async function fetchQuotations() {
  const { data, error } = await supabase
    .from("quotations")
    .select(`
      id,
      customer_id,
      status,
      total,
      approved_by,
      created_at,
      customers (
        id,
        whatsapp_phone,
        name,
        language,
        segment,
        created_at
      ),
      quotation_items (
        id,
        product_id,
        qty,
        unit_price,
        products (
          id,
          sku,
          name,
          price,
          stock
        )
      )
    `)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []).map((row) => mapQuotation(row as RawRecord));
}

export async function approveAndSendQuotation(quotationId: string) {
  const [{ data: userData, error: userError }, { error: updateError }] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from("quotations")
      .update({ status: "approved" })
      .eq("id", quotationId),
  ]);

  if (userError) throw userError;
  if (updateError) throw updateError;

  const userId = userData.user?.id ?? null;

  if (userId) {
    await supabase
      .from("quotations")
      .update({ approved_by: userId })
      .eq("id", quotationId);

    await supabase.from("audit_log").insert({
      actor_user_id: userId,
      action: "quotation_approved",
      entity_type: "quotation",
      entity_id: quotationId,
      payload: { approvedAt: new Date().toISOString() },
    });
  }

  const approvalWebhook = import.meta.env.VITE_N8N_APPROVAL_WEBHOOK_URL;
  if (approvalWebhook) {
    const response = await fetch(approvalWebhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quotationId }),
    });

    if (!response.ok) {
      throw new Error("Quotation approved locally, but the n8n approval workflow did not accept the request.");
    }
  }
}

export async function fetchCustomers() {
  const { data, error } = await supabase
    .from("customers")
    .select("id, whatsapp_phone, name, language, segment, created_at")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as Customer[];
}

export async function fetchProducts() {
  const { data, error } = await supabase
    .from("products")
    .select("id, sku, name, price, stock")
    .order("name", { ascending: true });

  if (error) throw error;
  return (data ?? []).map((product) => ({
    ...product,
    price: product.price !== null ? Number(product.price) : null,
    stock: product.stock !== null ? Number(product.stock) : null,
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
    if (error) throw error;
    return;
  }

  const { error } = await supabase.from("products").insert(payload);
  if (error) throw error;
}

export async function deleteProduct(productId: string) {
  const { error } = await supabase.from("products").delete().eq("id", productId);
  if (error) throw error;
}

export async function fetchFollowUps() {
  const { data, error } = await supabase
    .from("follow_ups")
    .select(`
      id,
      customer_id,
      remind_at,
      reason,
      done,
      customers (
        id,
        whatsapp_phone,
        name,
        language,
        segment,
        created_at
      )
    `)
    .order("remind_at", { ascending: true });

  if (error) throw error;

  return ((data ?? []) as RawRecord[]).map((row) => ({
    id: row.id as string,
    customer_id: row.customer_id as string | null,
    remind_at: row.remind_at as string | null,
    reason: row.reason as string | null,
    done: Boolean(row.done),
    customer: (row.customers as Customer | null) ?? null,
  })) as FollowUp[];
}

export async function markFollowUpDone(followUpId: string) {
  const { error } = await supabase
    .from("follow_ups")
    .update({ done: true })
    .eq("id", followUpId);

  if (error) throw error;
}

export async function snoozeFollowUp(followUpId: string, hours = 24) {
  const remindAt = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
  const { error } = await supabase
    .from("follow_ups")
    .update({ remind_at: remindAt, done: false })
    .eq("id", followUpId);

  if (error) throw error;
}

export async function fetchAnalytics(): Promise<AnalyticsSnapshot> {
  const [
    { data: messages, error: messagesError },
    { data: quotations, error: quotationsError },
    { data: orders, error: ordersError },
    { data: followUps, error: followUpsError },
    { data: invoices, error: invoicesError },
  ] = await Promise.all([
    supabase.from("messages").select("id, direction"),
    supabase.from("quotations").select("id, status, total"),
    supabase.from("orders").select("id, status"),
    supabase.from("follow_ups").select("id, done"),
    supabase.from("invoices").select("id, status, total"),
  ]);

  if (messagesError) throw messagesError;
  if (quotationsError) throw quotationsError;
  if (ordersError) throw ordersError;
  if (followUpsError) throw followUpsError;
  if (invoicesError) throw invoicesError;

  const messageRows = messages ?? [];
  const quotationRows = quotations ?? [];
  const orderRows = orders ?? [];
  const followUpRows = followUps ?? [];
  const invoiceRows = invoices ?? [];

  return {
    inboundMessages: messageRows.filter((item) => item.direction === "in").length,
    draftQuotes: quotationRows.filter((item) => item.status === "draft").length,
    approvedQuotes: quotationRows.filter((item) => item.status === "approved").length,
    sentQuotes: quotationRows.filter((item) => item.status === "sent").length,
    confirmedOrders: orderRows.filter((item) => item.status === "confirmed").length,
    openFollowUps: followUpRows.filter((item) => !item.done).length,
    invoicedRevenue: invoiceRows.reduce((sum, item) => sum + Number(item.total ?? 0), 0),
    paidRevenue: invoiceRows
      .filter((item) => item.status === "paid")
      .reduce((sum, item) => sum + Number(item.total ?? 0), 0),
    overdueInvoices: invoiceRows.filter((item) => item.status === "overdue").length,
  };
}
