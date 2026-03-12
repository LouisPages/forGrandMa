import "dotenv/config";
import express from "express";
import cors from "cors";
import { runPipeline, runExtractionOnly } from "./pipeline.js";
import { chatCompletion, runOCR } from "./llm.js";
import { PROMPT_CHAT } from "./prompts.js";
import { getContextQuestions } from "./contextQuestions.js";
import { runLegendes } from "./legendes.js";
import { runAdaptVulgarizationToLegendes } from "./adaptVulgarization.js";

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: "50mb" }));

/** GET / — Minimal HTML page to avoid JSON browser view and CSP errors */
app.get("/", (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head><title>For GrandMa API</title></head>
<body style="font-family:sans-serif; padding: 2rem;">
  <h1>For GrandMa API</h1>
  <p>The server is started. Use the application at <strong>http://localhost:8080</strong>.</p>
  <p>Start the frontend with: <code>npm run dev</code></p>
</body>
</html>
  `);
});

/** Health check */
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

/** Quick LLM test */
app.get("/api/test-llm", async (req, res) => {
  try {
    const reply = await chatCompletion([
      { role: "user", content: "Say hello in one line." },
    ]);
    return res.json({ reply });
  } catch (err) {
    console.error("[ERROR] LLM test failed:", err);
    return res.status(500).json({ error: "LLM test failed: " + err.message });
  }
});

/** 
 * Understand Report (classical pipeline) 
 * Body: { reportText: string }
 */
app.post("/api/report/understand", async (req, res) => {
  const { reportText } = req.body;
  if (!reportText) return res.status(400).json({ error: "No report text provided." });

  try {
    const result = await runPipeline(reportText);
    return res.json(result);
  } catch (err) {
    return res.status(500).json({
      error: err.message || "Error processing the report.",
    });
  }
});

/**
 * Extraction only (to get context questions before full analysis)
 * Body: { reportText: string }
 * Returns: { extraction, contextQuestions }
 */
app.post("/api/report/extract", async (req, res) => {
  const { reportText } = req.body;
  if (!reportText) return res.status(400).json({ error: "No report text provided." });

  try {
    const extraction = await runExtractionOnly(reportText);
    const contextQuestions = getContextQuestions(extraction.type_examen || "");
    return res.json({ extraction, contextQuestions });
  } catch (err) {
    return res.status(500).json({
      error: err.message || "Error extracting the report.",
    });
  }
});

/**
 * Streaming Pipeline (SSE)
 * Body (option 1): { reportText: string } — classic full pipeline
 * Body (option 2): { extraction: object, patientContext?: Record<string, string> } — resume from extraction
 */
app.post("/api/report/understand-stream", async (req, res) => {
  const { reportText, extraction, patientContext } = req.body;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const sendSSE = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    let result;
    const hasImages = (req.body.legendImageDataUrls && req.body.legendImageDataUrls.length > 0) || (req.body.hasImages === true);

    if (extraction) {
      // Option 2: Resume from extraction with patient context
      result = await runPipeline(null, {
        extraction,
        patientContext,
        hasImages,
        onProgress: (step, partial) => sendSSE(step, partial),
      });
    } else {
      // Option 1: Full pipeline from text
      if (!reportText) throw new Error("No report text provided.");
      result = await runPipeline(reportText, {
        hasImages,
        onProgress: (step, partial) => sendSSE(step, partial),
      });
    }
    sendSSE("done", result);
    res.end();
  } catch (err) {
    sendSSE("error", { error: err.message || "Error processing the report." });
    res.end();
  }
});

/**
 * Chat
 * context = extraction + simplification (text or JSON) to anchor answers.
 */
app.post("/api/chat", async (req, res) => {
  const { message, context, history } = req.body;
  if (!message) return res.status(400).json({ error: "No message provided." });

  try {
    const prompt = PROMPT_CHAT.replace("{context}", context || "")
      .replace("{message}", message)
      .replace("{history}", JSON.stringify(history || []));

    const reply = await chatCompletion([{ role: "user", content: prompt }]);
    return res.json({ reply });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Error in chat." });
  }
});

/**
 * Legends (Vision)
 * Body: { image: base64, extraction: object }
 * Returns: { legendes: [{ label, fleche: {x1, y1, x2, y2} }] }
 */
app.post("/api/report/legendes", async (req, res) => {
  const { image, extraction } = req.body;
  if (!image) return res.status(400).json({ error: "No image provided." });

  try {
    const legendes = await runLegendes(image, extraction);
    return res.json({ legendes });
  } catch (err) {
    console.error("Legends error:", err.message);
    return res.status(500).json({ error: "Unable to generate legends." });
  }
});

/**
 * Adapt simplification to labels
 * Body: { vulgarization: string, legendLabels: string[] }
 * Returns: { vulgarization: string } — simplified explanation adapted to legends
 */
app.post("/api/report/adapt-vulgarization", async (req, res) => {
  const { vulgarization, legendLabels } = req.body;
  if (!vulgarization || !legendLabels) return res.status(400).json({ error: "Missing parameters." });

  try {
    const adapted = await runAdaptVulgarizationToLegendes(vulgarization, legendLabels);
    return res.json({ vulgarization: adapted });
  } catch (err) {
    return res.status(500).json({ error: "Error adapting explanation." });
  }
});

/**
 * OCR on image
 * Body: { image: base64 }
 * Returns: { text: string }
 */
app.post("/api/report/ocr", async (req, res) => {
  const { image } = req.body;
  if (!image) return res.status(400).json({ error: "No image provided." });

  try {
    const text = await runOCR(image);
    return res.json({ text });
  } catch (err) {
    return res.status(500).json({ error: "OCR failed: " + err.message });
  }
});

app.listen(port, () => {
  console.log(`[SERVER] Started on http://localhost:${port}`);
});
