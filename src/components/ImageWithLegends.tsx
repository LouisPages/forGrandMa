import { useRef, useState, useEffect } from "react";
import type { LegendAnnotation } from "@/types/report";

const LEGEND_MARGIN = 100; // Espace réservé autour de l'image pour les légendes (px)
const ARROWHEAD_SIZE = 8;
const LABEL_PAD = 6;
const BOX_HEIGHT = 20;

type LegendSide = "left" | "right" | "top" | "bottom";

interface ImageWithLegendsProps {
  imageUrl: string;
  legendes: LegendAnnotation[];
  alt?: string;
  className?: string;
}

/** Choisit le côté de l'image où placer la légende (côté le plus proche du point cible). */
function chooseLegendSide(x2: number, y2: number): LegendSide {
  const toLeft = x2;
  const toRight = 1 - x2;
  const toTop = y2;
  const toBottom = 1 - y2;
  const min = Math.min(toLeft, toRight, toTop, toBottom);
  if (min === toLeft) return "left";
  if (min === toRight) return "right";
  if (min === toTop) return "top";
  return "bottom";
}

/** Affiche une image avec légendes en dehors de l'image et flèches pointant vers la zone (x2,y2). */
const ImageWithLegends = ({ imageUrl, legendes, alt = "Image légendée", className = "" }: ImageWithLegendsProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const img = el.querySelector("img");
      const cw = el.offsetWidth;
      const ch = el.offsetHeight;
      if (cw !== containerSize.width || ch !== containerSize.height) setContainerSize({ width: cw, height: ch });
      if (img) {
        const w = img.clientWidth;
        const h = img.clientHeight;
        if (w !== size.width || h !== size.height) setSize({ width: w, height: h });
      }
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [imageUrl, size.width, size.height, containerSize.width, containerSize.height]);

  const totalWidth = containerSize.width > 0 ? containerSize.width : size.width + 2 * LEGEND_MARGIN;
  const totalHeight = containerSize.height > 0 ? containerSize.height : size.height + 2 * LEGEND_MARGIN;
  const contentW = totalWidth - 2 * LEGEND_MARGIN;
  const contentH = totalHeight - 2 * LEGEND_MARGIN;
  const offsetX = LEGEND_MARGIN + (contentW > 0 && size.width > 0 ? Math.max(0, (contentW - size.width) / 2) : 0);
  const offsetY = LEGEND_MARGIN + (contentH > 0 && size.height > 0 ? Math.max(0, (contentH - size.height) / 2) : 0);

  return (
    <div
      ref={containerRef}
      className={`relative block w-full min-h-[min(70vh,800px)] ${className}`}
      style={{ padding: LEGEND_MARGIN }}
    >
      <div className="relative w-full h-full min-h-[400px]">
        <img
          src={imageUrl}
          alt={alt}
          className="max-w-full max-h-full w-full h-full object-contain block rounded-lg"
          draggable={false}
        />
      </div>

      {size.width > 0 && size.height > 0 && totalWidth > 0 && totalHeight > 0 && legendes.length > 0 && (
        <svg
          className="absolute top-0 left-0 pointer-events-none"
          width={totalWidth}
          height={totalHeight}
          style={{ overflow: "visible" }}
        >
          <defs>
            <marker
              id="arrowhead"
              markerWidth={ARROWHEAD_SIZE}
              markerHeight={ARROWHEAD_SIZE}
              refX={ARROWHEAD_SIZE}
              refY={ARROWHEAD_SIZE / 2}
              orient="auto"
            >
              <polygon
                points={`0 0, ${ARROWHEAD_SIZE} ${ARROWHEAD_SIZE / 2}, 0 ${ARROWHEAD_SIZE}`}
                fill="hsl(var(--primary))"
              />
            </marker>
          </defs>
          {legendes.map((leg, i) => {
            const tx = offsetX + leg.fleche.x2 * size.width;
            const ty = offsetY + leg.fleche.y2 * size.height;
            const side = chooseLegendSide(leg.fleche.x2, leg.fleche.y2);
            const labelText = leg.label.length > 25 ? leg.label.slice(0, 24) + "…" : leg.label;
            const approxLabelWidth = Math.min(labelText.length * 7, size.width * 0.35);
            const boxW = approxLabelWidth + LABEL_PAD * 2;
            const boxH = BOX_HEIGHT;

            let boxX: number;
            let boxY: number;
            let lineX1: number;
            let lineY1: number;
            const lineX2 = tx;
            const lineY2 = ty;

            switch (side) {
              case "left":
                boxX = 8;
                boxY = ty - boxH / 2;
                lineX1 = boxX + boxW;
                lineY1 = ty;
                break;
              case "right":
                boxX = totalWidth - boxW - 8;
                boxY = ty - boxH / 2;
                lineX1 = boxX;
                lineY1 = ty;
                break;
              case "top":
                boxX = Math.max(LEGEND_MARGIN, Math.min(totalWidth - boxW - LEGEND_MARGIN, tx - boxW / 2));
                boxY = 8;
                lineX1 = tx;
                lineY1 = boxY + boxH;
                break;
              default:
                // bottom
                boxX = Math.max(LEGEND_MARGIN, Math.min(totalWidth - boxW - LEGEND_MARGIN, tx - boxW / 2));
                boxY = totalHeight - boxH - 8;
                lineX1 = tx;
                lineY1 = boxY;
                break;
            }

            const textX = boxX + LABEL_PAD;
            const textY = boxY + boxH / 2 + 4;

            return (
              <g key={i}>
                <line
                  x1={lineX1}
                  y1={lineY1}
                  x2={lineX2}
                  y2={lineY2}
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  markerEnd="url(#arrowhead)"
                />
                <rect
                  x={boxX}
                  y={boxY}
                  width={boxW}
                  height={boxH}
                  rx={4}
                  fill="hsl(var(--card))"
                  stroke="hsl(var(--primary))"
                  strokeWidth={1}
                  opacity={0.98}
                />
                <text
                  x={textX}
                  y={textY}
                  fill="hsl(var(--foreground))"
                  fontSize={11}
                  fontWeight={600}
                >
                  {labelText}
                </text>
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
};

export default ImageWithLegends;
