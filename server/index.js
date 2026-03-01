/**
 * API backend For GrandMa : pipeline rapport + chat.
 * Aucune persistance ; pas de stockage des rapports ou conversations.
 */

import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, "..", ".env");
console.log("Loading .env from:", envPath);
dotenv.config({ path: envPath });
console.log("GOOGLE_API_KEY loaded:", !!process.env.GOOGLE_API_KEY);
import express from "express";
import cors from "cors";
import { runPipeline, runExtractionOnly, runPipelineFromExtraction, sendSSE } from "./pipeline.js";
import { getContextQuestions } from "./contextQuestions.js";
import { chatCompletion, performOCR } from "./llm.js";
import { CHAT_SYSTEM, CHAT_USER } from "./prompts.js";
import { runLegendes } from "./legendes.js";
import { runAdaptVulgarizationToLegendes } from "./adaptVulgarization.js";

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: true }));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

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
 * GET /api/test-llm — Teste que l'API LLM fonctionne
 */
app.get("/api/test-llm", async (req, res) => {
  try {
    const result = await chatCompletion(
      [
        { role: "system", content: "Tu es un assistant utile." },
        { role: "user", content: "Dis bonjour en une ligne." },
      ],
      { max_tokens: 50, temperature: 0.3 }
    );
    return res.json({ success: true, message: result });
  } catch (err) {
    console.error("[ERROR] LLM test failed:", err);
    return res.status(500).json({ error: err.message });
  }
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
    console.error("[ERROR] Pipeline error:", err);
    return res.status(500).json({
      error: err.message || "Erreur lors du traitement du rapport.",
    });
  }
});

/**
 * POST /api/report/extract
 * Body: { reportText: string }
 * Returns: { extraction } — extraction seule pour afficher les questions de contexte puis lancer l'analyse avec contexte
 */
app.post("/api/report/extract", async (req, res) => {
  try {
    const { reportText } = req.body || {};
    if (!reportText || typeof reportText !== "string") {
      return res.status(400).json({ error: "reportText (string) is required" });
    }
    const extraction = await runExtractionOnly(reportText);
    const contextQuestions = getContextQuestions(extraction.type_examen || "");
    return res.json({ extraction, contextQuestions });
  } catch (err) {
    console.error("Extract error:", err.message);
    return res.status(500).json({
      error: err.message || "Erreur lors de l'extraction du rapport.",
    });
  }
});

/**
 * GET /api/report/context-questions?type_examen=...
 * Returns: { contextQuestions: { id, label }[] }
 */
app.get("/api/report/context-questions", (req, res) => {
  const typeExamen = req.query.type_examen ? String(req.query.type_examen) : "";
  const contextQuestions = getContextQuestions(typeExamen);
  return res.json({ contextQuestions });
});

/**
 * POST /api/report/understand-stream
 * Body (option 1): { reportText: string } — pipeline complet classique
 * Body (option 2): { extraction: object, patientContext?: Record<string, string> } — à partir d'une extraction déjà faite, avec contexte patient
 * Returns: SSE stream — events: vulgarization, validation, questions, done, error (option 2 n'envoie pas extraction)
 */
app.post("/api/report/understand-stream", async (req, res) => {
  const body = req.body || {};
  const { reportText, extraction, patientContext } = body;

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
    let result;
    if (extraction && typeof extraction === "object") {
      // Option 2 : reprendre à partir de l'extraction avec contexte patient
      sendSSE(res, "extraction", { extraction });
      result = await runPipelineFromExtraction(extraction, {
        onProgress,
        patientContext: patientContext && typeof patientContext === "object" ? patientContext : {},
      });
    } else if (reportText && typeof reportText === "string") {
      // Option 1 : pipeline complet depuis le texte
      result = await runPipeline(reportText, { onProgress });
    } else {
      return res.status(400).json({ error: "reportText or extraction is required" });
    }
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
      error: err.message || "Error generating response.",
    });
  }
});

/**
 * POST /api/report/legendes
 * Body: { image: string (data URL base64), extraction: object }
 * Returns: { legendes: Array<{ label, fleche: { x1, y1, x2, y2 } }> }
 */
app.post("/api/report/legendes", async (req, res) => {
  try {
    const { image, extraction } = req.body || {};
    if (!image || typeof image !== "string") {
      return res.status(400).json({ error: "image (base64 data url) is required" });
    }
    if (!extraction || typeof extraction !== "object") {
      return res.status(400).json({ error: "extraction (object) is required" });
    }
    const legendes = await runLegendes(image, extraction);
    return res.json({ legendes });
  } catch (err) {
    console.error("Legendes error:", err.message);
    return res.status(500).json({
      error: err.message || "Error generating legends.",
    });
  }
});

/**
 * POST /api/report/adapt-vulgarization
 * Body: { vulgarization: string, legendLabels: string[] }
 * Returns: { vulgarization: string } — explication adaptée pour s'appuyer sur les légendes
 */
app.post("/api/report/adapt-vulgarization", async (req, res) => {
  try {
    const { vulgarization, legendLabels } = req.body || {};
    if (!vulgarization || typeof vulgarization !== "string") {
      return res.status(400).json({ error: "vulgarization (string) is required" });
    }
    const labels = Array.isArray(legendLabels) ? legendLabels : [];
    console.log("[adapt-vulgarization] Adapting with", labels.length, "legend label(s):", labels.slice(0, 5));
    const adapted = await runAdaptVulgarizationToLegendes(vulgarization, labels);
    console.log("[adapt-vulgarization] Done, response length:", adapted?.length ?? 0, "contains legend ref:", labels.some((l) => adapted?.includes(l)));
    return res.json({ vulgarization: adapted });
  } catch (err) {
    console.error("Adapt vulgarization error:", err.message);
    return res.status(500).json({
      error: err.message || "Error adapting explanation to legends.",
    });
  }
});

/**
 * POST /api/report/ocr
 * Body: { image: string } (data URL base64)
 * Returns: { text: string }
 */
app.post("/api/report/ocr", async (req, res) => {
  try {
    const { image } = req.body || {};
    if (!image || typeof image !== "string") {
      return res.status(400).json({ error: "image (base64 data url) is required" });
    }
    console.log("Starting OCR for image size:", image.length);
    const text = await performOCR(image);
    console.log("OCR success, extracted text (preview):", text.slice(0, 100));
    return res.json({ text });
  } catch (err) {
    console.error("OCR error detail:", err);
    return res.status(500).json({
      error: err.message || "Error during image OCR.",
    });
  }
});

app.get("/api/health", (_, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`For GrandMa API listening on http://localhost:${PORT}`);
});
