/**
 * Pipeline agentique : Extraction → Vulgarisation → Validation → Questions.
 * Aucune persistance ; tout en mémoire.
 */

import { chatCompletion } from "./llm.js";
import {
  EXTRACTION_SYSTEM,
  EXTRACTION_USER,
  VULGARIZATION_SYSTEM,
  VULGARIZATION_SYSTEM_WITH_CONTEXT,
  VULGARIZATION_USER,
  VULGARIZATION_USER_WITH_CONTEXT,
  VALIDATION_SYSTEM,
  VALIDATION_USER,
  QUESTIONS_SYSTEM,
  QUESTIONS_USER,
  QUESTIONS_USER_WITH_CONTEXT,
} from "./prompts.js";

const FALLBACK_VULGARIZATION =
  "Les éléments de votre rapport doivent être interprétés par votre médecin. Nous n'avons pas pu générer une explication simplifiée pour le moment. Demandez des précisions à votre médecin lors de votre prochain rendez-vous.";

/**
 * Parse la sortie extraction en JSON. En cas d'échec, retourne un objet minimal.
 */
function parseExtraction(raw) {
  try {
    const cleaned = raw.replace(/```json\s?/g, "").replace(/```\s?/g, "").trim();
    return JSON.parse(cleaned);
  } catch {
    return {
      localisation: "",
      type_examen: "",
      faits_principaux: [],
      termes_techniques: [],
      conclusion_rapport: raw?.slice(0, 500) || "",
      niveau_urgence: null,
    };
  }
}

/**
 * Parse la liste de questions (une par ligne).
 */
function parseQuestions(raw) {
  if (!raw || typeof raw !== "string") return [];
  return raw
    .split("\n")
    .map((s) => s.replace(/^[\d.)\-\*]\s*/, "").trim())
    .filter(Boolean)
    .slice(0, 5);
}

/**
 * Envoie un événement SSE (Server-Sent Event).
 * @param {import('express').Response} res
 * @param {string} event
 * @param {object} data
 */
function sendSSE(res, event, data) {
  const payload = JSON.stringify(data);
  res.write(`event: ${event}\ndata: ${payload}\n\n`);
}

/**
 * Exécute uniquement l'extraction sur le texte du rapport.
 * @param {string} reportText - Texte du rapport
 * @returns {Promise<object>} extraction
 */
export async function runExtractionOnly(reportText) {
  if (!reportText || !reportText.trim()) {
    throw new Error("Le texte du rapport est vide.");
  }
  const text = reportText.trim().slice(0, 15000);
  const extractionRaw = await chatCompletion(
    [
      { role: "system", content: EXTRACTION_SYSTEM },
      { role: "user", content: EXTRACTION_USER(text) },
    ],
    { max_tokens: 1024, temperature: 0.2 }
  );
  return parseExtraction(extractionRaw);
}

/**
 * Formate le contexte patient (objet id -> réponse) en chaîne pour les prompts.
 * @param {Record<string, string>} patientContext
 * @returns {string}
 */
function formatPatientContext(patientContext) {
  if (!patientContext || typeof patientContext !== "object") return "";
  return Object.entries(patientContext)
    .filter(([, v]) => v != null && String(v).trim() !== "")
    .map(([k, v]) => `${k}: ${String(v).trim()}`)
    .join("\n");
}

/**
 * Exécute le pipeline à partir d'une extraction déjà faite, avec contexte patient optionnel.
 * Étapes : Vulgarisation → Validation → Questions.
 * @param {object} extraction - Résultat d'extraction (runExtractionOnly)
 * @param {{ onProgress?: (step: string, data: object) => void|Promise }} options
 * @param {Record<string, string>} [options.patientContext] - Réponses aux questions de contexte (id -> réponse)
 * @returns {Promise<{ extraction: object, vulgarization: string, validationOk: boolean, questions: string[] }>}
 */
export async function runPipelineFromExtraction(extraction, options = {}) {
  const { onProgress, patientContext = {} } = options;
  const extractionJson = JSON.stringify(extraction, null, 2);
  const contextStr = formatPatientContext(patientContext);
  const hasContext = contextStr && contextStr.trim().length > 0;

  // 2) Vulgarisation (avec contexte patient si fourni → prompt personnalisé)
  let vulgarization;
  try {
    const systemContent = hasContext
      ? `${VULGARIZATION_SYSTEM}\n\n${VULGARIZATION_SYSTEM_WITH_CONTEXT}`
      : VULGARIZATION_SYSTEM;
    vulgarization = await chatCompletion(
      [
        { role: "system", content: systemContent },
        {
          role: "user",
          content: VULGARIZATION_USER_WITH_CONTEXT(extractionJson, contextStr),
        },
      ],
      { max_tokens: 600, temperature: 0.3 }
    );
  } catch (e) {
    vulgarization = FALLBACK_VULGARIZATION;
  }
  await onProgress?.("vulgarization", { extraction, vulgarization });

  // 3) Validation (guardrail)
  let validationOk = true;
  try {
    const validationRaw = await chatCompletion(
      [
        { role: "system", content: VALIDATION_SYSTEM },
        { role: "user", content: VALIDATION_USER(vulgarization) },
      ],
      { max_tokens: 16, temperature: 0 }
    );
    validationOk = validationRaw.toUpperCase().trim().startsWith("OK");
  } catch {
    validationOk = false;
  }

  if (!validationOk) {
    vulgarization = vulgarization + "\n\nDemandez des précisions à votre médecin lors de votre prochain rendez-vous.";
  }
  await onProgress?.("validation", { extraction, vulgarization, validationOk });

  // 4) Questions pour le médecin (avec contexte patient si fourni)
  let questions = [];
  try {
    const questionsRaw = await chatCompletion(
      [
        { role: "system", content: QUESTIONS_SYSTEM },
        {
          role: "user",
          content: QUESTIONS_USER_WITH_CONTEXT(extractionJson, vulgarization, contextStr),
        },
      ],
      { max_tokens: 256, temperature: 0.4 }
    );
    questions = parseQuestions(questionsRaw);
  } catch {
    questions = ["Que signifie ce rapport pour mon cas ?", "Quels sont les prochains rendez-vous à prévoir ?"];
  }
  await onProgress?.("questions", { extraction, vulgarization, validationOk, questions });

  return {
    extraction,
    vulgarization,
    validationOk,
    questions,
  };
}

/**
 * Exécute le pipeline complet sur le texte du rapport.
 * Si onProgress est fourni (ex. pour SSE), appelle onProgress(step, partialResult) après chaque étape.
 * @param {string} reportText - Texte du rapport (anonymisé, pas stocké)
 * @param {{ onProgress?: (step: string, data: object) => void|Promise }} options
 * @returns {Promise<{ extraction: object, vulgarization: string, validationOk: boolean, questions: string[] }>}
 */
export async function runPipeline(reportText, options = {}) {
  const { onProgress } = options;
  if (!reportText || !reportText.trim()) {
    throw new Error("Le texte du rapport est vide.");
  }

  const text = reportText.trim().slice(0, 15000); // limite raisonnable

  // 1) Extraction
  const extractionRaw = await chatCompletion(
    [
      { role: "system", content: EXTRACTION_SYSTEM },
      { role: "user", content: EXTRACTION_USER(text) },
    ],
    { max_tokens: 1024, temperature: 0.2 }
  );
  const extraction = parseExtraction(extractionRaw);
  await onProgress?.("extraction", { extraction });

  return runPipelineFromExtraction(extraction, { onProgress });
}

export { sendSSE };
