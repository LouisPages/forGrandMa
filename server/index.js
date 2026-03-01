/**
 * API backend For GrandMa : pipeline rapport + chat.
 * Aucune persistance ; pas de stockage des rapports ou conversations.
 */

import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env") });
import express from "express";
import cors from "cors";
import { runPipeline, sendSSE } from "./pipeline.js";
import { chatCompletion } from "./llm.js";
import { CHAT_SYSTEM, CHAT_USER } from "./prompts.js";

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: true }));
app.use(express.json({ limit: "1mb" }));

/** GET / — page HTML minimale (pas de script, pas d’image) pour éviter la vue JSON du navigateur et les erreurs CSP */
const ROOT_HTML = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>For GrandMa API</title>
</head>
<body style="font-family:system-ui,sans-serif;max-width:40em;margin:2rem auto;padding:0 1rem;">
  <h1>For GrandMa API</h1>
  <p>Le serveur est démarré. L'application s'utilise sur <strong>http://localhost:8080</strong>.</p>
  <p>Lancez le frontend avec : <code>npm run dev</code></p>
  <p>Endpoints : <code>POST /api/report/understand</code>, <code>POST /api/chat</code>, <code>GET /api/health</code></p>
</body>
</html>`;

app.get("/", (_, res) => {
  res.set("Content-Type", "text/html; charset=utf-8");
  res.send(ROOT_HTML);
});

/**
 * POST /api/report/understand
 * Body: { reportText: string }
 * Returns: { extraction, vulgarization, validationOk, questions }
 */
app.post("/api/report/understand", async (req, res) => {
  try {
    const { reportText } = req.body || {};
    if (!reportText || typeof reportText !== "string") {
      return res.status(400).json({ error: "reportText (string) is required" });
    }
    const result = await runPipeline(reportText);
    return res.json(result);
  } catch (err) {
    console.error("Pipeline error:", err.message);
    return res.status(500).json({
      error: err.message || "Erreur lors du traitement du rapport.",
    });
  }
});

/**
 * POST /api/report/understand-stream
 * Body: { reportText: string }
 * Returns: SSE stream — events: extraction, vulgarization, validation, questions, done, error
 */
app.post("/api/report/understand-stream", async (req, res) => {
  const { reportText } = req.body || {};
  if (!reportText || typeof reportText !== "string") {
    return res.status(400).json({ error: "reportText (string) is required" });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();

  const onProgress = (step, data) => {
    sendSSE(res, step, data);
    if (typeof res.flush === "function") res.flush();
  };

  try {
    const result = await runPipeline(reportText, { onProgress });
    sendSSE(res, "done", result);
  } catch (err) {
    console.error("Pipeline stream error:", err.message);
    sendSSE(res, "error", { error: err.message || "Erreur lors du traitement du rapport." });
  } finally {
    res.end();
  }
});

/**
 * POST /api/chat
 * Body: { message: string, context: string, history?: { role, text }[] }
 * context = extraction + vulgarisation (texte ou JSON stringifié) pour ancrer les réponses.
 * history = derniers échanges (optionnel, 3–5 max côté client).
 */
app.post("/api/chat", async (req, res) => {
  try {
    const { message, context, history = [] } = req.body || {};
    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "message (string) is required" });
    }
    const contextStr =
      typeof context === "string" ? context : context ? JSON.stringify(context) : "";
    const historyList = Array.isArray(history) ? history.slice(-5) : [];

    const userContent = CHAT_USER(contextStr, historyList, message.trim());

    const reply = await chatCompletion(
      [
        { role: "system", content: CHAT_SYSTEM },
        { role: "user", content: userContent },
      ],
      { max_tokens: 512, temperature: 0.4 }
    );

    return res.json({ reply });
  } catch (err) {
    console.error("Chat error:", err.message);
    return res.status(500).json({
      error: err.message || "Erreur lors de la génération de la réponse.",
    });
  }
});

app.get("/api/health", (_, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`For GrandMa API listening on http://localhost:${PORT}`);
});
