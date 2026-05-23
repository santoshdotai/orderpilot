type ExtractionResult = {
  products: Array<{ sku?: string; name: string; qty: number }>;
  urgency: "low" | "medium" | "high";
  delivery: { address?: string; date?: string };
  rawText: string;
  provider: "gemini" | "openai";
};

const EXTRACTION_PROMPT = `You are an order-extraction assistant for a B2B WhatsApp seller.
Return strict JSON with keys: products[{sku?, name, qty}], urgency (low|medium|high),
delivery({address?, date?}).

Customer message:
"""
<MESSAGE_OR_TRANSCRIPT>
"""`;

function sanitizeJsonBlock(text: string) {
  return text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
}

function parseModelJson(rawText: string) {
  return JSON.parse(sanitizeJsonBlock(rawText));
}

export async function transcribeVoiceNote(mediaUrl: string, openAiApiKey: string) {
  const audio = await fetch(mediaUrl).then((r) => r.blob());
  const fd = new FormData();
  fd.append("file", audio, "voice.ogg");
  fd.append("model", "whisper-1");

  const transcript = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${openAiApiKey}` },
    body: fd,
  }).then((r) => r.json());

  return transcript;
}

export async function extractWithGemini(messageOrTranscript: string, geminiApiKey: string): Promise<ExtractionResult> {
  const prompt = EXTRACTION_PROMPT.replace("<MESSAGE_OR_TRANSCRIPT>", messageOrTranscript);
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
        },
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`Gemini extraction failed with ${response.status}`);
  }

  const data = await response.json();
  const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) {
    throw new Error("Gemini returned no extraction text");
  }

  return {
    ...parseModelJson(rawText),
    rawText,
    provider: "gemini",
  };
}

export async function extractWithOpenAiFallback(messageOrTranscript: string, openAiApiKey: string): Promise<ExtractionResult> {
  const prompt = EXTRACTION_PROMPT.replace("<MESSAGE_OR_TRANSCRIPT>", messageOrTranscript);
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openAiApiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "You extract structured order data and return valid JSON only.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI extraction failed with ${response.status}`);
  }

  const data = await response.json();
  const rawText = data?.choices?.[0]?.message?.content;
  if (!rawText) {
    throw new Error("OpenAI returned no extraction text");
  }

  return {
    ...parseModelJson(rawText),
    rawText,
    provider: "openai",
  };
}

export async function extractOrderWithFallback(messageOrTranscript: string, geminiApiKey: string, openAiApiKey: string) {
  try {
    return await extractWithGemini(messageOrTranscript, geminiApiKey);
  } catch {
    return extractWithOpenAiFallback(messageOrTranscript, openAiApiKey);
  }
}
