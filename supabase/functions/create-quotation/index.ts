import { createClient } from "@supabase/supabase-js";

import { corsHeaders } from "../shared/cors.ts";

type CreateQuotationItem = {
  productId?: string;
  qty?: number | string;
  unitPrice?: number | string;
};

type CreateQuotationRequest = {
  customerId?: string;
  items?: CreateQuotationItem[];
};

function requiredEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
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

function toNumber(value: number | string | undefined) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return Number.NaN;
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

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  try {
    const payload = (await req.json()) as CreateQuotationRequest;
    const customerId = typeof payload.customerId === "string" ? payload.customerId.trim() : "";
    const items = Array.isArray(payload.items) ? payload.items : [];

    if (!customerId) {
      return jsonResponse(400, { error: "customerId is required" });
    }

    if (items.length === 0) {
      return jsonResponse(400, { error: "At least one quotation item is required" });
    }

    const normalizedItems = items.map((item, index) => {
      const productId = typeof item.productId === "string" ? item.productId.trim() : "";
      const qty = toNumber(item.qty);
      const unitPrice = toNumber(item.unitPrice);

      if (!productId) {
        throw new Error(`Item ${index + 1} is missing productId`);
      }

      if (!Number.isFinite(qty) || qty <= 0) {
        throw new Error(`Item ${index + 1} has an invalid qty`);
      }

      if (!Number.isFinite(unitPrice) || unitPrice < 0) {
        throw new Error(`Item ${index + 1} has an invalid unitPrice`);
      }

      return { productId, qty, unitPrice };
    });

    const total = Number(
      normalizedItems.reduce((sum, item) => sum + item.qty * item.unitPrice, 0).toFixed(2),
    );

    const { data: quotation, error: quotationError } = await supabase
      .from("quotations")
      .insert({
        customer_id: customerId,
        total,
        status: "draft",
      })
      .select("id")
      .single();

    if (quotationError || !quotation) {
      return jsonResponse(500, { error: quotationError?.message ?? "Failed to create quotation" });
    }

    const lineItems = normalizedItems.map((item) => ({
      quotation_id: quotation.id,
      product_id: item.productId,
      qty: item.qty,
      unit_price: item.unitPrice,
    }));

    const { error: lineItemsError } = await supabase.from("quotation_items").insert(lineItems);
    if (lineItemsError) {
      return jsonResponse(500, { error: lineItemsError.message });
    }

    const { error: auditError } = await supabase.from("audit_log").insert({
      action: "quotation_created",
      entity_type: "quotation",
      entity_id: quotation.id,
      payload: {
        customerId,
        items: normalizedItems,
        total,
      },
    });

    if (auditError) {
      return jsonResponse(500, { error: auditError.message });
    }

    return jsonResponse(200, {
      quotationId: quotation.id,
      total,
      status: "draft",
    });
  } catch (error) {
    return jsonResponse(500, {
      error: error instanceof Error ? error.message : "Unexpected create quotation error",
    });
  }
});
