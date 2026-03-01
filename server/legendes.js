/**
 * Génération des légendes (flèches + labels) sur une image d'imagerie via LLM vision.
 */

import { chatCompletion } from "./llm.js";
import { LEGENDES_SYSTEM, LEGENDES_USER } from "./prompts.js";

/**
 * Parse la réponse JSON du LLM et valide le format des légendes.
 * @param {string} raw - Réponse brute du LLM
 * @returns {{ label: string, fleche: { x1, y1, x2, y2 } }[]}
 */
function parseLegendesResponse(raw) {
  if (!raw || typeof raw !== "string") return [];
  try {
    const cleaned = raw
      .replace(/```json\s?/g, "")
      .replace(/```\s?/g, "")
      .trim();
    const obj = JSON.parse(cleaned);
    const list = Array.isArray(obj.legendes) ? obj.legendes : [];
    return list
      .filter(
        (item) =>
          item &&
          typeof item.label === "string" &&
          item.fleche &&
          typeof item.fleche.x1 === "number" &&
          typeof item.fleche.y1 === "number" &&
          typeof item.fleche.x2 === "number" &&
          typeof item.fleche.y2 === "number"
      )
      .map((item) => ({
        label: String(item.label).trim() || "Zone",
        fleche: {
          x1: clamp(item.fleche.x1, 0, 1),
          y1: clamp(item.fleche.y1, 0, 1),
          x2: clamp(item.fleche.x2, 0, 1),
          y2: clamp(item.fleche.y2, 0, 1),
        },
      }));
  } catch {
    return [];
  }
}

function clamp(v, min, max) {
  const n = Number(v);
  if (Number.isNaN(n)) return min;
  return Math.max(min, Math.min(max, n));
}

/** Orientation signée: > 0 si c à gauche de (a->b), < 0 si à droite, 0 si alignés */
function orientation(ax, ay, bx, by, cx, cy) {
  return (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
}

/** Vrai si le point (px,py) est sur le segment (ax,ay)-(bx,by) (entre les deux extrémités). */
function pointOnSegment(ax, ay, bx, by, px, py) {
  const cross = orientation(ax, ay, bx, by, px, py);
  if (Math.abs(cross) > 1e-9) return false;
  const minX = Math.min(ax, bx), maxX = Math.max(ax, bx);
  const minY = Math.min(ay, by), maxY = Math.max(ay, by);
  return px >= minX - 1e-9 && px <= maxX + 1e-9 && py >= minY - 1e-9 && py <= maxY + 1e-9;
}

/** Vrai si les segments (a1,a2) et (b1,b2) se croisent (intersection stricte ou point sur segment). */
function segmentsIntersect(a1, a2, b1, b2) {
  const [ax1, ay1] = a1, [ax2, ay2] = a2, [bx1, by1] = b1, [bx2, by2] = b2;
  const o1 = orientation(ax1, ay1, ax2, ay2, bx1, by1);
  const o2 = orientation(ax1, ay1, ax2, ay2, bx2, by2);
  const o3 = orientation(bx1, by1, bx2, by2, ax1, ay1);
  const o4 = orientation(bx1, by1, bx2, by2, ax2, ay2);
  if (o1 * o2 < 0 && o3 * o4 < 0) return true;
  if (pointOnSegment(ax1, ay1, ax2, ay2, bx1, by1) || pointOnSegment(ax1, ay1, ax2, ay2, bx2, by2)) return true;
  if (pointOnSegment(bx1, by1, bx2, by2, ax1, ay1) || pointOnSegment(bx1, by1, bx2, by2, ax2, ay2)) return true;
  return false;
}

/** Points de départ candidats sur le bord de l'image (coordonnées 0–1), déterministes pour éviter les croisements */
function getBoundaryStarts() {
  const pts = [];
  for (let t = 0; t <= 1; t += 0.1) {
    pts.push([0, t], [1, t], [t, 0], [t, 1]);
  }
  return pts;
}

/** Vérifie si le segment (x1,y1)->(x2,y2) croise l'un des segments des autres légendes (indices dans list, excluant excludeIndex). */
function arrowCrossesOthers(x1, y1, x2, y2, list, excludeIndex) {
  for (let i = 0; i < list.length; i++) {
    if (i === excludeIndex) continue;
    const f = list[i].fleche;
    if (segmentsIntersect([x1, y1], [x2, y2], [f.x1, f.y1], [f.x2, f.y2])) return true;
  }
  return false;
}

/**
 * Ajuste les (x1,y1) des légendes pour qu'aucune flèche n'en croise une autre.
 * Déterministe : on essaie des points de départ sur le bord de l'image jusqu'à plus de croisement.
 * @param {{ label: string, fleche: { x1, y1, x2, y2 } }[]} legendes
 * @returns {typeof legendes}
 */
function resolveArrowCrossings(legendes) {
  if (legendes.length <= 1) return legendes;
  const list = legendes.map((leg) => ({ ...leg, fleche: { ...leg.fleche } }));
  const boundary = getBoundaryStarts();
  const maxPasses = 10;

  for (let pass = 0; pass < maxPasses; pass++) {
    let changed = false;
    for (let i = 0; i < list.length; i++) {
      const leg = list[i];
      const { x1, y1, x2, y2 } = leg.fleche;
      if (!arrowCrossesOthers(x1, y1, x2, y2, list, i)) continue;

      for (const [sx, sy] of boundary) {
        if (arrowCrossesOthers(sx, sy, x2, y2, list, i)) continue;
        leg.fleche.x1 = sx;
        leg.fleche.y1 = sy;
        changed = true;
        break;
      }
    }
    if (!changed) break;
  }
  return list;
}

/**
 * Génère les légendes (flèches + labels) pour une image d'imagerie.
 * @param {string} imageDataUrl - Data URL base64 de l'image (data:image/...;base64,...)
 * @param {object} extraction - Résultat de l'extraction du rapport
 * @returns {Promise<{ label: string, fleche: { x1, y1, x2, y2 } }[]>}
 */
export async function runLegendes(imageDataUrl, extraction) {
  const extractionStr =
    typeof extraction === "string" ? extraction : JSON.stringify(extraction, null, 2);
  const textContent = LEGENDES_USER(extractionStr);

  const messages = [
    { role: "system", content: LEGENDES_SYSTEM },
    {
      role: "user",
      content: [
        // detail: "high" améliore la précision des coordonnées pour les APIs qui le supportent (ex. OpenAI)
        { type: "image_url", image_url: { url: imageDataUrl, detail: "high" } },
        { type: "text", text: textContent },
      ],
    },
  ];

  const raw = await chatCompletion(messages, {
    max_tokens: 1024,
    temperature: 0.2,
    timeoutMs: 60_000,
  });

  const legendes = parseLegendesResponse(raw);
  return resolveArrowCrossings(legendes);
}
