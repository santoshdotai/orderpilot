import { createClient } from "@supabase/supabase-js";
import { corsHeaders } from "../shared/cors.ts";

type SendWhatsappRequest = {
  to?: string;
  templateName?: string;
  bodyValues?: string[];
  customerId?: string;
};

type InteraktResponsePayload = Record<string, unknown> | string | null;

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

function normalizeIndianPhoneNumber(value: string) {
  const digits = value
    .trim()
    .replace(/^whatsapp:\+91/i, "")
    .replace(/^whatsapp:/i, "")
    .replace(/^\+91/, "")
    .replace(/\D/g, "");

  if (digits.startsWith("91") && digits.length > 10) {
    return digits.slice(2);
  }

  return digits;
}

function formatOutboundBody(templateName: string, bodyValues: string[]) {
  const parts = [templateName, ...bodyValues].filter((part) => part.length > 0);
  return parts.join(" | ");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function extractInteraktMessageId(payload: InteraktResponsePayload) {
  if (!isRecord(payload)) {
    return null;
  }

  const candidateValues: unknown[] = [
    payload.id,
    payload.messageId,
    payload.message_id,
  ];

  if (isRecord(payload.data)) {
    candidateValues.push(payload.data.id, payload.data.messageId, payload.data.message_id);

    if (isRecord(payload.data.message)) {
      candidateValues.push(
        payload.data.message.id,
        payload.data.message.messageId,
        payload.data.message.message_id,
      );
    }
  }

  if (isRecord(payload.result)) {
    candidateValues.push(payload.result.id, payload.result.messageId, payload.result.message_id);
  }

  for (const value of candidateValues) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

async function readResponsePayload(response: Response): Promise<InteraktResponsePayload> {
  const text = await response.text();

  if (!text.trim()) {
    return null;
  }

  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return text;
  }
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
    const payload = (await req.json()) as SendWhatsappRequest;
    const to = typeof payload.to === "string" ? payload.to.trim() : "";
    const templateName = typeof payload.templateName === "string" ? payload.templateName.trim() : "";
    const bodyValues = Array.isArray(payload.bodyValues)
      ? payload.bodyValues.map((value) => (typeof value === "string" ? value.trim() : String(value ?? "").trim()))
      : [];
    const customerId = typeof payload.customerId === "string" ? payload.customerId.trim() : "";

    if (!to) {
      return jsonResponse(400, { error: "to is required" });
    }

    if (!templateName) {
      return jsonResponse(400, { error: "templateName is required" });
    }

    if (!customerId) {
      return jsonResponse(400, { error: "customerId is required" });
    }

    const phone = normalizeIndianPhoneNumber(to);

    if (!phone) {
      return jsonResponse(400, { error: "to must include a valid Indian phone number" });
    }

    const interaktApiKey = requiredEnv("INTERAKT_API_KEY");

    const interaktResponse = await fetch("https://api.interakt.ai/v1/public/message/", {
      method: "POST",
      headers: {
        "Authorization": `Basic ${interaktApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        countryCode: "+91",
        phoneNumber: phone,
        callbackData: templateName,
        type: "Template",
        template: {
          name: templateName,
          languageCode: "en",
          bodyValues: bodyValues,
        },
      }),
    });

    const interaktPayload = await readResponsePayload(interaktResponse);
    const interaktMessageId = extractInteraktMessageId(interaktPayload);

    if (!interaktResponse.ok) {
      return jsonResponse(500, {
        error:
          (isRecord(interaktPayload) && typeof interaktPayload.message === "string" && interaktPayload.message) ||
          (typeof interaktPayload === "string" ? interaktPayload : null) ||
          `Interakt request failed with ${interaktResponse.status}`,
      });
    }

    // Log outbound message to DB
    const { error: messageError } = await supabase.from("messages").insert({
      customer_id: customerId,
      direction: "out",
      body: formatOutboundBody(templateName, bodyValues),
      media_url: null,
      twilio_sid: interaktMessageId,
    });

    if (messageError) {
      return jsonResponse(500, { error: messageError.message });
    }

    return jsonResponse(200, {
      status: "sent",
      result: interaktPayload,
    });
  } catch (error) {
    return jsonResponse(500, {
      error: error instanceof Error ? error.message : "Unexpected send WhatsApp error",
    });
  }
});
