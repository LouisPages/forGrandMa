import { chatCompletion } from "./llm.js";
import { PROMPT_LEGENDES } from "./prompts.js";

/**
 * Generation of legends (arrows + labels) on an imaging image via LLM vision.
 * No persistence; all in memory.
 */

/**
 * Parses the LLM JSON response and validates the legend format.
 */
function parseLegendesResponse(raw) {
  try {
    const clean = raw.trim().replace(/^```json/, "").replace(/```$/, "").trim();
    const obj = JSON.parse(clean);
    const list = Array.isArray(obj.legendes) ? obj.legendes : [];
    return list.map((leg) => ({
      label: String(leg.label || "Area"),
      fleche: {
        x1: 0,
        y1: 0,
        x2: Number(leg.fleche?.x2 ?? 0.5),
        y2: Number(leg.fleche?.y2 ?? 0.5),
      },
    }));
  } catch (err) {
    console.warn("[LEGENDES] Parsing failed.");
    return [];
  }
}

/** Signed orientation: > 0 if c is to the left of (a->b), < 0 if to the right, 0 if aligned */
function getOrientation(ax, ay, bx, by, cx, cy) {
  return (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
}

/** True if point (px,py) is on segment (ax,ay)-(bx,by) (between the two ends). */
function onSegment(ax, ay, bx, by, px, py) {
  return (
    px >= Math.min(ax, bx) &&
    px <= Math.max(ax, bx) &&
    py >= Math.min(ay, by) &&
    py <= Math.max(ay, by)
  );
}

/** True if segments (a1,a2) and (b1,b2) cross (strict intersection or point on segment). */
function doIntersect(ax1, ay1, ax2, ay2, bx1, by1, bx2, by2) {
  const o1 = getOrientation(ax1, ay1, ax2, ay2, bx1, by1);
  const o2 = getOrientation(ax1, ay1, ax2, ay2, bx2, by2);
  const o3 = getOrientation(bx1, by1, bx2, by2, ax1, ay1);
  const o4 = getOrientation(bx1, by1, bx2, by2, ax2, ay2);

  if (((o1 > 0 && o2 < 0) || (o1 < 0 && o2 > 0)) && ((o3 > 0 && o4 < 0) || (o3 < 0 && o4 > 0))) {
    return true;
  }
  if (o1 === 0 && onSegment(ax1, ay1, ax2, ay2, bx1, by1)) return true;
  if (o2 === 0 && onSegment(ax1, ay1, ax2, ay2, bx2, by2)) return true;
  if (o3 === 0 && onSegment(bx1, by1, bx2, by2, ax1, ay1)) return true;
  if (o4 === 0 && onSegment(bx1, by1, bx2, by2, ax2, ay2)) return true;

  return false;
}

/**
 * Returns a point (x, y) on the image contour in normalized coordinates 0–1.
 * Clockwise from top-left corner: top → right → bottom → left.
 */
function getPointOnBorder(t) {
  if (t < 0.25) return { x: t * 4, y: 0 }; // Top
  if (t < 0.5) return { x: 1, y: (t - 0.25) * 4 }; // Right
  if (t < 0.75) return { x: 1 - (t - 0.5) * 4, y: 1 }; // Bottom
  return { x: 0, y: 1 - (t - 0.75) * 4 }; // Left
}

/**
 * Distributes starting points (x1, y1) regularly clockwise around the image.
 * Keeps (x2, y2) unchanged. Avoids crossings by placing starts deterministically.
 */
function assignStartsClockwise(list) {
  if (!list.length) return [];
  // Candidate starting points on the image border (0–1), deterministic to avoid crossings
  const borderPoints = [];
  for (let t = 0; t <= 1; t += 0.05) {
    borderPoints.push(getPointOnBorder(t));
  }

  /** Checks if segment (x1,y1)->(x2,y2) crosses any other legend segments. */
  function anyCross(x1, y1, x2, y2, excludeIndex) {
    for (let i = 0; i < list.length; i++) {
      if (i === excludeIndex) continue;
      const other = list[i];
      if (doIntersect(x1, y1, x2, y2, other.fleche.x1, other.fleche.y1, other.fleche.x2, other.fleche.y2)) {
        return true;
      }
    }
    return false;
  }

  // Initial assignment (first points)
  list.forEach((leg, i) => {
    const p = borderPoints[Math.floor((i / list.length) * borderPoints.length)];
    leg.fleche.x1 = p.x;
    leg.fleche.y1 = p.y;
  });

  // Iterative optimization to avoid crossings
  const maxPasses = 5;
  for (let pass = 0; pass < maxPasses; pass++) {
    let changed = false;
    for (let i = 0; i < list.length; i++) {
      const leg = list[i];
      if (anyCross(leg.fleche.x1, leg.fleche.y1, leg.fleche.x2, leg.fleche.y2, i)) {
        // Try other border points
        for (const p of borderPoints) {
          if (!anyCross(p.x, p.y, leg.fleche.x2, leg.fleche.y2, i)) {
            leg.fleche.x1 = p.x;
            leg.fleche.y1 = p.y;
            changed = true;
            break;
          }
        }
      }
    }
    if (!changed) break;
  }

  return list;
}

/**
 * Generates legends (arrows + labels) for an imaging image.
 */
export async function runLegendes(imageDataUrl, extraction) {
  const messages = [
    {
      role: "user",
      content: [
        { type: "text", text: PROMPT_LEGENDES.replace("{extraction}", JSON.stringify(extraction)) },
        { type: "image_url", image_url: { url: imageDataUrl } },
      ],
    },
  ];

  const raw = await chatCompletion(messages, {
    temperature: 0.1,
    max_tokens: 1024,
  });

  let legendes = parseLegendesResponse(raw);
  legendes = assignStartsClockwise(legendes);
  return legendes;
}
