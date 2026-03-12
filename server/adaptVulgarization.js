import { chatCompletion } from "./llm.js";
import { PROMPT_ADAPT_VULGARIZATION } from "./prompts.js";

/**
 * Agent for adapting the explanation: takes the initial simple explanation
 * and the labels displayed on the image, and rewrites the text
 * to rely on these labels (explicit references to areas/labels).
 */

/**
 * Adapts the simplification text to refer to the displayed legends.
 */
export async function runAdaptVulgarizationToLegendes(vulgarization, legendLabels) {
  if (!legendLabels || legendLabels.length === 0) return vulgarization;

  const labelsStr = legendLabels.map((l, i) => `${i + 1}) ${l}`).join(", ");
  const prompt = PROMPT_ADAPT_VULGARIZATION.replace("{legendLabels}", labelsStr).replace(
    "{vulgarization}",
    vulgarization
  );

  const raw = await chatCompletion([{ role: "user", content: prompt }], {
    temperature: 0.7,
  });

  let trimmed = raw && typeof raw === "string" ? raw.trim() : "";
  if (!trimmed) return vulgarization;

  // Clean the output if the LLM repeats the prompt
  if (trimmed.startsWith("Rewritten explanation")) {
    trimmed = trimmed.replace(/^Rewritten explanation.*:?\n*/i, "").trim();
  }

  return trimmed;
}
