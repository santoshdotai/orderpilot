import { createClient } from "@supabase/supabase-js";

import { corsHeaders } from "../shared/cors.ts";

type SendWhatsappRequest = {
  to?: string;
  body?: string;
  mediaUrl?: string | null;
  customerId?: string;
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
    const body = typeof payload.body === "string" ? payload.body.trim() : "";
    const customerId = typeof payload.customerId === "string" ? payload.customerId.trim() : "";
    const mediaUrl = typeof payload.mediaUrl === "string" && payload.mediaUrl.trim() !== ""
      ? payload.mediaUrl.trim()
      : null;

    if (!to) {
      return jsonResponse(400, { error: "to is required" });
    }

    if (!body && !mediaUrl) {
      return jsonResponse(400, { error: "body or mediaUrl is required" });
    }

    if (!customerId) {
      return jsonResponse(400, { error: "customerId is required" });
    }

    const twilioSid = requiredEnv("TWILIO_ACCOUNT_SID");
    const twilioToken = requiredEnv("TWILIO_AUTH_TOKEN");
    const from = requiredEnv("TWILIO_WHATSAPP_FROM");

    const formData = new URLSearchParams();
    formData.append("From", from);
    formData.append("To", to);

    if (body) {
      formData.append("Body", body);
    }

    if (mediaUrl) {
      formData.append("MediaUrl", mediaUrl);
    }

    const twilioResponse = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${btoa(`${twilioSid}:${twilioToken}`)}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formData.toString(),
      },
    );

    const twilioPayload = await twilioResponse.json();
    if (!twilioResponse.ok) {
      return jsonResponse(500, {
        error: twilioPayload?.message ?? `Twilio request failed with ${twilioResponse.status}`,
      });
    }

    const { error: messageError } = await supabase.from("messages").insert({
      customer_id: customerId,
      direction: "out",
      body: body || null,
      media_url: mediaUrl,
      twilio_sid: typeof twilioPayload?.sid === "string" ? twilioPayload.sid : null,
    });

    if (messageError) {
      return jsonResponse(500, { error: messageError.message });
    }

    return jsonResponse(200, {
      sid: twilioPayload?.sid ?? null,
      status: twilioPayload?.status ?? "queued",
    });
  } catch (error) {
    return jsonResponse(500, {
      error: error instanceof Error ? error.message : "Unexpected send WhatsApp error",
    });
  }
});
