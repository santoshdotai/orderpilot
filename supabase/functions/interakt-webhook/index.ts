import { createClient } from "@supabase/supabase-js";
import { transcribeVoiceNote } from "../shared/ai.ts";
import { corsHeaders } from "../shared/cors.ts";

// WATI payload types
type WatiMessagePayload = {
  id?: string;
  type?: string;
  text?: string;
  image?: { link?: string };
  audio?: { link?: string };
  document?: { link?: string };
  video?: { link?: string };
  waId?: string;
  senderName?: string;
  data?: {
    message?: {
      id?: string;
      type?: string;
      text?: { body?: string };
      mediaUrl?: string;
      media_url?: string;
      media?: { url?: string };
    };
    customer?: {
      phone_number?: string;
      name?: string;
      id?: string;
    };
  };
};

function requiredEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function getServiceRoleKey(): string {
  const secretKeys = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (secretKeys) {
    try {
      const parsed = JSON.parse(secretKeys);
      const val = Object.values(parsed)[0];
      if (typeof val === "string") return val;
    } catch {
      if (secretKeys.startsWith("eyJ")) return secretKeys;
    }
  }
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legacy) return legacy;
  throw new Error("No Supabase service role key found");
}

function jsonResponse(status: number, payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizePhoneNumber(phoneNumber: string) {
  const digits = phoneNumber.trim().replace(/\D/g, "");
  return digits ? `+${digits}` : "";
}

const supabase = createClient(
  requiredEnv("SUPABASE_URL"),
  getServiceRoleKey(),
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const n8nWebhookUrl = requiredEnv("N8N_WEBHOOK_URL");

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  try {
    const rawBody = await req.text();
    console.log("Raw payload received:", rawBody);

    const payload = JSON.parse(rawBody) as WatiMessagePayload;
    console.log("Parsed payload type:", payload.type);

    let messageId = "";
    let phoneNumber = "";
    let profileName = "";
    let body = "";
    let mediaUrl = "";
    let messageType = "";

    if (payload.waId) {
      // WATI format
      console.log("Detected WATI payload");
      messageId = payload.id ?? "";
      phoneNumber = payload.waId ?? "";
      profileName = payload.senderName ?? "";
      messageType = payload.type ?? "text";
      body = payload.text ?? "";
      mediaUrl =
        payload.image?.link ??
        payload.audio?.link ??
        payload.document?.link ??
        payload.video?.link ??
        "";
    } else if (payload.data?.customer) {
      // Interakt format
      console.log("Detected Interakt payload");
      const message = payload.data.message;
      const customer = payload.data.customer;
      messageId = message?.id ?? "";
      phoneNumber = customer?.phone_number ?? "";
      profileName = customer?.name ?? "";
      messageType = message?.type ?? "";
      body = message?.text?.body ?? "";
      mediaUrl =
        message?.mediaUrl ??
        message?.media_url ??
        message?.media?.url ??
        "";
    } else {
      console.log("Unknown payload format, ignoring:", payload.type);
      return jsonResponse(200, { status: "ignored", reason: "unknown format" });
    }

    let normalizedBody = body.trim();
    let transcriptText: string | null = null;

    if (!normalizedBody && mediaUrl) {
      const openAiApiKey = Deno.env.get("OPENAI_API_KEY");
      if (!openAiApiKey) {
        return jsonResponse(400, { error: "OPENAI_API_KEY is required to transcribe voice notes" });
      }
      const transcript = await transcribeVoiceNote(mediaUrl, openAiApiKey);
      transcriptText = typeof transcript?.text === "string" ? transcript.text.trim() : "";
      if (!transcriptText) {
        return jsonResponse(500, { error: "Voice note transcription returned empty text" });
      }
      normalizedBody = transcriptText;
    }

    console.log("messageId:", messageId, "phone:", phoneNumber, "body:", normalizedBody, "type:", messageType);

    if (!messageId) return jsonResponse(400, { error: "message id is required" });
    if (!phoneNumber) return jsonResponse(400, { error: "phone number is required" });
    if (!normalizedBody) return jsonResponse(400, { error: "message body is required" });

    const from = normalizePhoneNumber(phoneNumber);
    if (!from) return jsonResponse(400, { error: "phone number is invalid" });

    const customerPayload: { whatsapp_phone: string; name?: string } = { whatsapp_phone: from };
    if (profileName) customerPayload.name = profileName;

    const { data: customerRecord, error: customerError } = await supabase
      .from("customers")
      .upsert(customerPayload, { onConflict: "whatsapp_phone" })
      .select("id")
      .single();

    if (customerError || !customerRecord) {
      throw new Error(customerError?.message ?? "Failed to upsert customer");
    }

    let messageRecordId: string | null = null;
    const { data: existingMessage, error: existingMessageError } = await supabase
      .from("messages")
      .select("id")
      .eq("twilio_sid", messageId)
      .maybeSingle();

    if (existingMessageError) throw new Error(existingMessageError.message);

    if (existingMessage?.id) {
      messageRecordId = existingMessage.id;
    } else {
      const { data: insertedMessage, error: insertError } = await supabase
        .from("messages")
        .insert({
          customer_id: customerRecord.id,
          direction: "in",
          body: normalizedBody,
          media_url: mediaUrl || null,
          twilio_sid: messageId,
        })
        .select("id")
        .single();

      if (insertError || !insertedMessage) {
        throw new Error(insertError?.message ?? "Failed to store inbound message");
      }
      messageRecordId = insertedMessage.id;
    }

    if (transcriptText && messageRecordId) {
      const { data: existingTranscription } = await supabase
        .from("transcriptions")
        .select("id")
        .eq("message_id", messageRecordId)
        .maybeSingle();

      if (!existingTranscription?.id) {
        await supabase.from("transcriptions").insert({
          message_id: messageRecordId,
          text: transcriptText,
          model: "whisper-1",
        });
      }
    }

    const n8nResponse = await fetch(n8nWebhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        body: {
          from,
          body: normalizedBody,
          profileName,
          customerId: customerRecord.id,
          messageId,
        },
      }),
    });

    if (!n8nResponse.ok) {
      const responseText = await n8nResponse.text();
      throw new Error(`n8n webhook failed with ${n8nResponse.status}: ${responseText.slice(0, 250)}`);
    }

    return jsonResponse(200, {
      status: "ok",
      messageId: messageRecordId,
      customerId: customerRecord.id,
    });

  } catch (error) {
    console.error("interakt-webhook failed", error);
    return jsonResponse(500, {
      error: error instanceof Error ? error.message : "Unexpected webhook error",
    });
  }
});