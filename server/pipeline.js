import { chatCompletion } from "./llm.js";
import {
  PROMPT_EXTRACTION,
  PROMPT_VULGARIZATION,
  PROMPT_VALIDATION,
  PROMPT_QUESTIONS,
} from "./prompts.js";

/**
 * Pipeline Agentic: Extraction -> Vulgarization -> Validation -> Questions
 * No persistence; all in memory.
 */

/**
 * Parses the extraction output as JSON.
 */
function parseExtraction(raw) {
  try {
    const clean = raw.trim().replace(/^```json/, "").replace(/```$/, "").trim();
    return JSON.parse(clean);
  } catch (err) {
    console.warn("[PIPELINE] Extraction parsing failed. Returning minimal object.");
    return {
      localisation: "",
      type_examen: "Medical Report",
      faits_principaux: [],
      termes_techniques: [],
      conclusion_rapport: raw,
      niveau_urgence: "normal",
    };
  }
}

/**
 * Parses the list of questions (one per line).
 */
function parseQuestions(raw) {
  return raw
    .split("\n")
    .map((q) => q.replace(/^\d+[\.\)]\s*/, "").trim())
    .filter((q) => q.length > 5);
}

/**
 * Performs extraction only on the report text.
 */
export async function runExtractionOnly(reportText) {
  const prompt = PROMPT_EXTRACTION.replace("{reportText}", reportText);
  const raw = await chatCompletion([{ role: "user", content: prompt }], {
    temperature: 0.1,
  });
  return parseExtraction(raw);
}

/**
 * Formats the patient context (id -> answer object) into a string for prompts.
 */
function formatPatientContext(ctx) {
  if (!ctx || Object.keys(ctx).length === 0) return "None provided.";
  return Object.entries(ctx)
    .map(([id, val]) => `- ${id}: ${val}`)
    .join("\n");
}

/**
 * Executes the pipeline starting from an already existing extraction.
 */
export async function runPipelineFromExtraction(extraction, options = {}) {
  const { patientContext, onProgress, hasImages } = options;
  const patientContextStr = formatPatientContext(patientContext);
  const extractionStr = JSON.stringify(extraction, null, 2);

  const imageInstruction = hasImages 
    ? "Analysis of the imaging images provided by the patient (X-ray, MRI, etc.)." 
    : "Simplification of what the doctor saw and described in the report.";
  
  const imageInstructionDetail = hasImages
    ? "Refer directly to the imaging images provided by the patient (X-ray, MRI, etc.)."
    : "Do NOT mention 'the provided image' or 'the image' if no image files were provided. Instead, describe what the report text says was seen during the exam.";

  // 1) Vulgarization (with patient context if provided -> personalized prompt)
  const promptV = PROMPT_VULGARIZATION
    .replace("{extraction}", extractionStr)
    .replace("{patientContext}", patientContextStr)
    .replace("{imageInstruction}", imageInstruction)
    .replace("{imageInstructionDetail}", imageInstructionDetail);
  
  const vulgarization = await chatCompletion([{ role: "user", content: promptV }], {
    temperature: 0.7,
  });
  if (onProgress) onProgress("vulgarization", { vulgarization });

  // 2) Validation
  const promptVal = PROMPT_VALIDATION.replace("{extraction}", extractionStr).replace(
    "{vulgarization}",
    vulgarization
  );
  const validationRaw = await chatCompletion([{ role: "user", content: promptVal }], {
    temperature: 0.1,
  });
  const validationOk = validationRaw.toUpperCase().startsWith("OK");
  if (onProgress) onProgress("validation", { validationOk });

  // 3) Questions for the doctor (with patient context if provided)
  const promptQ = PROMPT_QUESTIONS.replace("{extraction}", extractionStr).replace(
    "{patientContext}",
    patientContextStr
  );
  const questionsRaw = await chatCompletion([{ role: "user", content: promptQ }], {
    temperature: 0.7,
  });
  const questions = parseQuestions(questionsRaw);
  if (onProgress) onProgress("questions", { questions });

  return {
    extraction,
    vulgarization,
    validationOk,
    questions,
  };
}

/**
 * Executes the full pipeline on the report text.
 */
export async function runPipeline(reportText, options = {}) {
  const { patientContext, onProgress } = options;

  let extraction;
  if (options.extraction) {
    extraction = options.extraction;
  } else {
    extraction = await runExtractionOnly(reportText);
  }
  if (onProgress) onProgress("extraction", { extraction });

  return runPipelineFromExtraction(extraction, options);
}
