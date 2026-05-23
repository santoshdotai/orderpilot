import { createClient } from "@supabase/supabase-js";

function requiredEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function xmlResponse(body: string, status = 200) {
  return new Response(body, {
    status,
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
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

const n8nWebhookUrl = requiredEnv("N8N_WEBHOOK_URL");

function readFormValue(form: FormData, key: string) {
  const entry = form.get(key);
  return typeof entry === "string" ? entry.trim() : entry?.toString().trim() ?? "";
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return xmlResponse("<Response></Response>", 405);
  }

  try {
    const form = await req.formData();
    const from = readFormValue(form, "From");
    const body = readFormValue(form, "Body");
    const mediaUrl = readFormValue(form, "MediaUrl0") || null;
    const twilioSid = readFormValue(form, "MessageSid");
    const profileName = readFormValue(form, "ProfileName") || null;

    if (!from) {
      return xmlResponse("<Response></Response>", 400);
    }

    const customerPayload: { whatsapp_phone: string; name?: string } = {
      whatsapp_phone: from,
    };

    if (profileName) {
      customerPayload.name = profileName;
    }

    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .upsert(customerPayload, { onConflict: "whatsapp_phone" })
      .select("id")
      .single();

    if (customerError || !customer) {
      throw new Error(customerError?.message ?? "Failed to upsert customer");
    }

    let messageId: string | null = null;

    if (twilioSid) {
      const { data: existingMessage, error: existingMessageError } = await supabase
        .from("messages")
        .select("id")
        .eq("twilio_sid", twilioSid)
        .maybeSingle();

      if (existingMessageError) {
        throw new Error(existingMessageError.message);
      }

      messageId = existingMessage?.id ?? null;
    }

    if (!messageId) {
      const { data: message, error: messageError } = await supabase
        .from("messages")
        .insert({
          customer_id: customer.id,
          direction: "in",
          body: body || null,
          media_url: mediaUrl,
          twilio_sid: twilioSid || null,
        })
        .select("id")
        .single();

      if (messageError || !message) {
        throw new Error(messageError?.message ?? "Failed to store inbound message");
      }

      messageId = message.id;
    }

    const n8nResponse = await fetch(n8nWebhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messageId,
        body,
        mediaUrl,
        from,
        profileName,
        twilioSid,
      }),
    });

    if (!n8nResponse.ok) {
      const responseText = await n8nResponse.text();
      throw new Error(`n8n intake webhook failed with ${n8nResponse.status}: ${responseText.slice(0, 250)}`);
    }

    return xmlResponse("<Response></Response>");
  } catch (error) {
    console.error("twilio-webhook failed", error);
    return xmlResponse("<Response></Response>", 500);
  }
});
