import { createClient } from "@supabase/supabase-js";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

import { corsHeaders } from "../shared/cors.ts";

type InvoiceRequest = {
  quotationId?: string;
  dueInDays?: number | string;
  taxRate?: number | string;
};

function requiredEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

const supabase = createClient(
  requiredEnv("SUPABASE_URL"),
  requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
);

type RawQuotationItem = {
  id: string;
  qty: number | string | null;
  unit_price: number | string | null;
  products:
    | {
      id: string;
      sku: string | null;
      name: string | null;
    }
    | Array<{
      id: string;
      sku: string | null;
      name: string | null;
    }>
    | null;
};

type ProductRecord = {
  id: string;
  sku: string | null;
  name: string | null;
};

type CustomerRecord = {
  id: string;
  name: string | null;
  whatsapp_phone: string | null;
};

type QuotationItem = {
  id: string;
  qty: number;
  unit_price: number;
  products: ProductRecord | null;
};

type RawQuotationRecord = {
  id: string;
  total: number | string | null;
  created_at: string;
  customer_id: string | null;
  customers:
    | {
      id: string;
      name: string | null;
      whatsapp_phone: string | null;
    }
    | Array<{
      id: string;
      name: string | null;
      whatsapp_phone: string | null;
    }>
    | null;
  quotation_items: RawQuotationItem[] | null;
};

type QuotationRecord = {
  id: string;
  total: number;
  created_at: string;
  customer_id: string | null;
  customers: CustomerRecord | null;
  quotation_items: QuotationItem[];
};

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function jsonResponse(status: number, payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function formatMoney(value: number) {
  return `INR ${value.toFixed(2)}`;
}

function toNumber(value: number | string | null | undefined, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
}

function normalizeQuotationRecord(raw: RawQuotationRecord): QuotationRecord {
  const items = Array.isArray(raw.quotation_items) ? raw.quotation_items : [];

  return {
    id: raw.id,
    total: toNumber(raw.total, 0),
    created_at: raw.created_at,
    customer_id: raw.customer_id,
    customers: firstRelation(raw.customers),
    quotation_items: items.map((item) => {
      const qty = toNumber(item.qty, Number.NaN);
      const unitPrice = toNumber(item.unit_price, Number.NaN);

      if (!Number.isFinite(qty) || qty <= 0) {
        throw new Error(`Quotation item ${item.id} has an invalid qty`);
      }

      if (!Number.isFinite(unitPrice) || unitPrice < 0) {
        throw new Error(`Quotation item ${item.id} has an invalid unit_price`);
      }

      return {
        id: item.id,
        qty,
        unit_price: unitPrice,
        products: firstRelation(item.products),
      };
    }),
  };
}

async function buildInvoicePdf(
  invoiceNumber: string,
  quotation: QuotationRecord,
  items: QuotationItem[],
  subtotal: number,
  taxTotal: number,
  total: number,
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  page.drawText("OrderPilot Invoice", {
    x: 50,
    y: 790,
    size: 22,
    font: boldFont,
    color: rgb(0.11, 0.15, 0.28),
  });

  page.drawText(`Invoice No: ${invoiceNumber}`, { x: 50, y: 760, size: 12, font });
  page.drawText(`Customer: ${quotation.customers?.name ?? quotation.customers?.whatsapp_phone ?? "Unknown"}`, {
    x: 50,
    y: 742,
    size: 12,
    font,
  });
  page.drawText(`Created from quotation ${quotation.id}`, { x: 50, y: 724, size: 12, font });

  page.drawText("Items", {
    x: 50,
    y: 690,
    size: 14,
    font: boldFont,
  });

  let y = 665;
  for (const item of items) {
    const lineTotal = item.qty * item.unit_price;
    page.drawText(`${item.products?.name ?? "Custom item"} x ${item.qty}`, { x: 50, y, size: 11, font });
    page.drawText(formatMoney(item.unit_price), { x: 340, y, size: 11, font });
    page.drawText(formatMoney(lineTotal), { x: 460, y, size: 11, font });
    y -= 20;
  }

  y -= 12;
  page.drawLine({
    start: { x: 50, y },
    end: { x: 545, y },
    thickness: 1,
    color: rgb(0.8, 0.84, 0.9),
  });
  y -= 24;

  page.drawText(`Subtotal: ${formatMoney(subtotal)}`, { x: 340, y, size: 12, font });
  y -= 18;
  page.drawText(`Tax: ${formatMoney(taxTotal)}`, { x: 340, y, size: 12, font });
  y -= 18;
  page.drawText(`Total: ${formatMoney(total)}`, { x: 340, y, size: 14, font: boldFont });

  return pdfDoc.save();
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  try {
    const payload = (await req.json()) as InvoiceRequest;
    const quotationId = typeof payload.quotationId === "string" ? payload.quotationId.trim() : "";
    const dueInDays = Math.floor(toNumber(payload.dueInDays, 7));
    const rawTaxRate = toNumber(payload.taxRate, 0);

    if (!quotationId) {
      return jsonResponse(400, { error: "quotationId is required" });
    }

    if (!Number.isFinite(dueInDays) || dueInDays < 0) {
      return jsonResponse(400, { error: "dueInDays must be a non-negative number" });
    }

    if (!Number.isFinite(rawTaxRate) || rawTaxRate < 0) {
      return jsonResponse(400, { error: "taxRate must be a non-negative number" });
    }

    const taxRate = rawTaxRate > 1 ? rawTaxRate / 100 : rawTaxRate;

    const { data: existingInvoice, error: existingInvoiceError } = await supabase
      .from("invoices")
      .select("id, invoice_number, pdf_url, total, status")
      .eq("quotation_id", quotationId)
      .maybeSingle();

    if (existingInvoiceError) {
      return jsonResponse(500, { error: existingInvoiceError.message });
    }

    if (existingInvoice) {
      return jsonResponse(200, existingInvoice);
    }

    const { data: quotation, error: quotationError } = await supabase
      .from("quotations")
      .select(`
        id,
        total,
        created_at,
        customer_id,
        customers (
          id,
          name,
          whatsapp_phone
        ),
        quotation_items (
          id,
          qty,
          unit_price,
          products (
            id,
            sku,
            name
          )
        )
      `)
      .eq("id", quotationId)
      .single();

    if (quotationError || !quotation) {
      return jsonResponse(404, { error: "Quotation not found" });
    }

    const quotationRecord = normalizeQuotationRecord(quotation as RawQuotationRecord);
    const items = quotationRecord.quotation_items;

    if (items.length === 0) {
      return jsonResponse(400, { error: "Quotation has no line items" });
    }

    if (!quotationRecord.customer_id) {
      return jsonResponse(500, { error: "Quotation is missing a customer reference" });
    }

    const subtotal = items.reduce((sum, item) => sum + item.qty * item.unit_price, 0);
    const taxTotal = Number((subtotal * taxRate).toFixed(2));
    const total = Number((subtotal + taxTotal).toFixed(2));
    const invoiceNumber = `INV-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${quotationId.slice(0, 6).toUpperCase()}`;
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + dueInDays);

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .upsert(
        {
          quotation_id: quotationId,
          customer_id: quotationRecord.customer_id,
          status: "confirmed",
        },
        { onConflict: "quotation_id" },
      )
      .select()
      .single();

    if (orderError) {
      return jsonResponse(500, { error: orderError.message });
    }

    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .insert({
        invoice_number: invoiceNumber,
        quotation_id: quotationId,
        order_id: order?.id ?? null,
        customer_id: quotationRecord.customer_id,
        subtotal,
        tax_total: taxTotal,
        total,
        status: "draft",
        due_date: dueDate.toISOString().slice(0, 10),
      })
      .select()
      .single();

    if (invoiceError || !invoice) {
      return jsonResponse(500, { error: invoiceError?.message ?? "Failed to create invoice" });
    }

    const invoiceItemsPayload = items.map((item) => {
      const lineTotal = Number((item.qty * item.unit_price).toFixed(2));
      const lineTax = Number((lineTotal * taxRate).toFixed(2));

      return {
        invoice_id: invoice.id,
        product_id: item.products?.id ?? null,
        description: item.products?.name ?? "Custom item",
        qty: item.qty,
        unit_price: item.unit_price,
        tax: lineTax,
        line_total: Number((lineTotal + lineTax).toFixed(2)),
      };
    });

    const { error: invoiceItemsError } = await supabase.from("invoice_items").insert(invoiceItemsPayload);
    if (invoiceItemsError) {
      return jsonResponse(500, { error: invoiceItemsError.message });
    }

    const pdfBytes = await buildInvoicePdf(invoiceNumber, quotationRecord, items, subtotal, taxTotal, total);
    const filePath = `${invoice.id}.pdf`;
    const { error: uploadError } = await supabase.storage
      .from("invoices")
      .upload(filePath, pdfBytes, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadError) {
      return jsonResponse(500, { error: uploadError.message });
    }

    const { data: publicUrlData } = supabase.storage.from("invoices").getPublicUrl(filePath);

    const { error: invoiceUpdateError } = await supabase
      .from("invoices")
      .update({ pdf_url: publicUrlData.publicUrl })
      .eq("id", invoice.id);

    if (invoiceUpdateError) {
      return jsonResponse(500, { error: invoiceUpdateError.message });
    }

    const { error: auditError } = await supabase.from("audit_log").insert({
      action: "invoice_generated",
      entity_type: "invoice",
      entity_id: invoice.id,
      payload: {
        quotationId,
        invoiceNumber,
        pdfUrl: publicUrlData.publicUrl,
      },
    });

    if (auditError) {
      return jsonResponse(500, { error: auditError.message });
    }

    return jsonResponse(200, {
      invoiceId: invoice.id,
      invoiceNumber,
      pdfUrl: publicUrlData.publicUrl,
      total,
      status: "draft",
    });
  } catch (error) {
    return jsonResponse(500, {
      error: error instanceof Error ? error.message : "Unexpected invoice engine error",
    });
  }
});
