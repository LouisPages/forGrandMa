/**
 * LLM API Call: Google Gemini (Gemma 3 27B).
 */
export async function chatCompletion(messages, options = {}) {
  const googleKey = process.env.GOOGLE_API_KEY;

  if (!googleKey) {
    throw new Error("Missing GOOGLE_API_KEY. Please set it in your .env file.");
  }

  return chatGoogleGemini(messages, options, googleKey);
}

/**
 * Converts OpenAI-style messages (system, user, assistant) to Gemini format.
 */
function toGeminiFormat(messages) {
  let systemText = "";
  const contents = [];

  for (const msg of messages) {
    if (msg.role === "system") {
      systemText = msg.content;
      continue;
    }
    const role = msg.role === "assistant" ? "model" : "user";
    const parts = [];

    if (typeof msg.content === "string") {
      let text = msg.content;
      if (role === "user" && systemText) {
        text = `Instructions: ${systemText}\n\nUser Message: ${text}`;
        systemText = "";
      }
      parts.push({ text });
    } else if (Array.isArray(msg.content)) {
      for (const item of msg.content) {
        if (item.type === "text") {
          let text = item.text;
          if (role === "user" && systemText) {
            text = `Instructions: ${systemText}\n\nUser Message: ${text}`;
            systemText = "";
          }
          parts.push({ text });
        } else if (item.type === "image_url") {
          // Extract base64 from data URL
          const b64 = item.image_url.url.split(",")[1];
          const mime = item.image_url.url.split(";")[0].split(":")[1];
          parts.push({
            inline_data: {
              mime_type: mime,
              data: b64,
            },
          });
        }
      }
    }
    contents.push({ role, parts });
  }
  return { contents };
}

async function chatGoogleGemini(messages, options, key) {
  const body = toGeminiFormat(messages);
  
  if (options.temperature !== undefined) {
    body.generationConfig = { temperature: options.temperature };
  }
  
  if (options.max_tokens !== undefined) {
    body.generationConfig = body.generationConfig || {};
    body.generationConfig.maxOutputTokens = options.max_tokens;
  }

  // Primary model: Gemma 3 27B
  const model = "gemma-3-27b-it";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

  const timeoutMs = options.timeoutMs ?? 120_000;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(id);

    if (!res.ok) {
      const errText = await res.text();
      if (res.status === 403) throw new Error("Google API (Gemma 3) key error or unauthorized.");
      if (res.status === 404) throw new Error("Gemma 3 27B model not found.");
      throw new Error(`Google Gemini API error ${res.status}: ${errText}`);
    }

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      const reason = data.candidates?.[0]?.finishReason || "unknown reason";
      throw new Error(`Google Gemini API (Gemma 3): no text returned (${reason})`);
    }
    return text;
  } catch (err) {
    if (err.name === "AbortError") throw new Error("Google API (Gemma 3) timeout.");
    throw err;
  }
}

/**
 * Perform OCR on image (base64) via Gemma 3 (Vision).
 */
export async function runOCR(imageDataUrl) {
  const messages = [
    {
      role: "user",
      content: [
        { type: "text", text: "Please extract all readable text from this medical document. Do not make any comments, do not summarize, just extract the text as is (OCR)." },
        { type: "image_url", image_url: { url: imageDataUrl } },
      ],
    },
  ];

  return chatCompletion(messages, { max_tokens: 2048, temperature: 0 });
}
