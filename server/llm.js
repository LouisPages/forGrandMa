/**
 * Appel à une API LLM : Google Gemini (Gemma 3 27B) ou API compatible OpenAI (chat completions).
 * - Si GOOGLE_API_KEY est défini : utilise l'API Gemini avec gemma-3-27b-it.
 * - Sinon : OPENAI_API_KEY + OPENAI_API_URL (ex. OpenAI, Ollama).
 */

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";
const GEMINI_MODEL = "gemma-3-27b-it";

const getConfig = () => {
  const googleKey = process.env.GOOGLE_API_KEY;
  const apiKey = process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_OPENAI;
  const baseUrl = process.env.OPENAI_API_URL || "https://api.openai.com/v1";
  const isLocal = /^https?:\/\/localhost(\d*)/.test(baseUrl) || /^https?:\/\/127\.0\.0\.1/.test(baseUrl);
  const useGoogle = !!googleKey;
  return { googleKey, apiKey, baseUrl, isLocal, useGoogle };
};

/**
 * Convertit les messages OpenAI (system, user, assistant) en format Gemini (contents uniquement).
 * Supporte désormais les images (base64).
 */
function toGeminiPayload(messages, generationConfig) {
  let systemText = "";
  const contents = [];

  for (const msg of messages) {
    if (msg.role === "system") {
      systemText = msg.content;
      continue;
    }
    const role = msg.role === "assistant" ? "model" : "user";
    
    const parts = [];
    
    // Si le contenu est une chaîne, c'est du texte simple
    if (typeof msg.content === "string") {
      let text = msg.content;
      if (role === "user" && systemText) {
        text = systemText + "\n\n" + text;
        systemText = "";
      }
      parts.push({ text });
    } 
    // Si c'est un tableau, il peut contenir du texte et des images (format OpenAI-like)
    else if (Array.isArray(msg.content)) {
      for (const item of msg.content) {
        if (item.type === "text") {
          let text = item.text;
          if (role === "user" && systemText) {
            text = systemText + "\n\n" + text;
            systemText = "";
          }
          parts.push({ text });
        } else if (item.type === "image_url") {
          // Format attendu: data:image/jpeg;base64,...
          const dataUrl = item.image_url.url;
          const match = dataUrl.match(/^data:(image\/\w+);base64,(.+)$/);
          if (match) {
            parts.push({
              inlineData: {
                mimeType: match[1],
                data: match[2],
              },
            });
          }
        }
      }
    }

    contents.push({ role, parts });
  }

  return {
    contents,
    generationConfig: {
      maxOutputTokens: generationConfig.maxOutputTokens ?? 2048,
      temperature: generationConfig.temperature ?? 0.3,
    },
  };
}

/**
 * Appel à l'API Gemini (Gemma 3 27B).
 */
async function chatCompletionGemini(messages, options = {}) {
  const { googleKey } = getConfig();
  const maxTokens = options.max_tokens ?? 2048;
  const temperature = options.temperature ?? 0.3;
  const timeoutMs = options.timeoutMs ?? 120_000; // Augmenté à 2 minutes pour l'OCR

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const url = `${GEMINI_BASE}/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(googleKey)}`;
  const body = toGeminiPayload(messages, {
    maxOutputTokens: maxTokens,
    temperature,
  });

  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeoutId);
    if (err?.name === "AbortError") {
      throw new Error(
        "L'API Google (Gemma) n'a pas répondu à temps. Vérifiez votre clé GOOGLE_API_KEY."
      );
    }
    throw err;
  }
  clearTimeout(timeoutId);

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Google Gemini API error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (text == null) {
    const reason = data.candidates?.[0]?.finishReason || data.promptFeedback?.blockReason || "unknown";
    throw new Error(`Google Gemini API: pas de texte (${reason})`);
  }
  return text.trim();
}

/**
 * Appel à une API compatible OpenAI (chat completions).
 */
async function chatCompletionOpenAI(messages, options = {}) {
  const { apiKey, baseUrl, isLocal } = getConfig();
  const model = options.model || process.env.OPENAI_MODEL || (isLocal ? "llama3.2" : "gpt-4o-mini");
  const maxTokens = options.max_tokens ?? 2048;
  const temperature = options.temperature ?? 0.3;
  const timeoutMs = options.timeoutMs ?? 90_000;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const headers = {
    "Content-Type": "application/json",
    ...(apiKey && { Authorization: `Bearer ${apiKey}` }),
  };

  let res;
  try {
    res = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        messages,
        max_tokens: maxTokens,
        temperature,
      }),
      signal: controller.signal,
    });
  } catch (err) {
    if (err?.name === "AbortError") {
      throw new Error(
        "Le serveur LLM n'a pas répondu à temps. Vérifiez votre configuration (clé API ou Ollama)."
      );
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`LLM API error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (content == null) {
    throw new Error("LLM API: no content in response");
  }
  return content.trim();
}

/**
 * Effectue l'OCR d'une image (base64) via Gemma 3 (Vision).
 * @param {string} base64DataUrl - "data:image/jpeg;base64,..."
 */
export async function performOCR(base64DataUrl) {
  const prompt = "Veuillez extraire tout le texte lisible de ce document médical. Ne faites aucun commentaire, ne résumez pas, extrayez simplement le texte tel quel (OCR).";
  const messages = [
    {
      role: "user",
      content: [
        { type: "image_url", image_url: { url: base64DataUrl } },
        { type: "text", text: prompt },
      ],
    },
  ];
  return chatCompletion(messages, { max_tokens: 2048, temperature: 0 }); // Température à 0 pour plus de précision
}

/**
 * @param {Array<{ role: 'system' | 'user' | 'assistant'; content: string | Array<any> }>} messages
 * @param {{ model?: string; max_tokens?: number; temperature?: number }} options
 * @returns {Promise<string>} contenu du premier choix
 */
export async function chatCompletion(messages, options = {}) {
  const { googleKey, apiKey, isLocal } = getConfig();

  if (googleKey) {
    return chatCompletionGemini(messages, options);
  }

  if (!apiKey && !isLocal) {
    throw new Error(
      "Définissez GOOGLE_API_KEY (Google AI Studio) pour Gemma 3 27B, ou OPENAI_API_KEY / Ollama pour un autre modèle."
    );
  }

  return chatCompletionOpenAI(messages, options);
}
