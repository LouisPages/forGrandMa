import { useState, useRef, useEffect } from "react";
import type { Legend } from "@/types/report";
import { cn } from "@/lib/utils";

const LEGEND_MARGIN = 100; // Reserved space around the image for legends (px)

type LegendSide = "left" | "right" | "top" | "bottom";

interface ImageWithLegendsProps {
  imageUrl: string;
  legendes: Legend[];
  alt?: string;
  className?: string;
}

/** Chooses the side of the image to place the legend (side closest to the target point). */
function chooseLegendSide(x2: number, y2: number): LegendSide {
  const distLeft = x2;
  const distRight = 1 - x2;
  const distTop = y2;
  const distBottom = 1 - y2;

  const minDist = Math.min(distLeft, distRight, distTop, distBottom);
  if (minDist === distLeft) return "left";
  if (minDist === distRight) return "right";
  if (minDist === distTop) return "top";
  return "bottom";
}

/** Displays an image with legends outside the image and arrows pointing to the area (x2,y2). */
const ImageWithLegends = ({
  imageUrl,
  legendes,
  alt = "Imaging image",
  className,
}: ImageWithLegendsProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        // The image itself is in the center, with LEGEND_MARGIN all around
        setDimensions({
          width: width - LEGEND_MARGIN * 2,
          height: height - LEGEND_MARGIN * 2,
        });
      }
    };
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative flex items-center justify-center bg-black/5 overflow-hidden rounded-xl",
        className
      )}
      style={{ padding: LEGEND_MARGIN }}
    >
      <img
        src={imageUrl}
        alt={alt}
        className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
        onLoad={(e) => {
          const img = e.currentTarget;
          setDimensions({ width: img.clientWidth, height: img.clientHeight });
        }}
      />

      {dimensions.width > 0 && (
        <svg
          className="absolute inset-0 pointer-events-none"
          width="100%"
          height="100%"
          viewBox={`0 0 ${dimensions.width + LEGEND_MARGIN * 2} ${dimensions.height + LEGEND_MARGIN * 2}`}
        >
          <defs>
            <marker
              id="arrowhead"
              markerWidth="10"
              markerHeight="7"
              refX="9"
              refY="3.5"
              orient="auto"
            >
              <polygon points="0 0, 10 3.5, 0 7" fill="currentColor" className="text-primary" />
            </marker>
          </defs>

          {legendes.map((leg, i) => {
            const side = chooseLegendSide(leg.fleche.x2, leg.fleche.y2);

            // Coordinates of the target point relative to the SVG container
            const targetX = LEGEND_MARGIN + leg.fleche.x2 * dimensions.width;
            const targetY = LEGEND_MARGIN + leg.fleche.y2 * dimensions.height;

            let boxX: number;
            let boxY: number;
            let lineX1: number;
            let lineY1: number;

            const boxW = 120;
            const boxH = 40;

            if (side === "left") {
              boxX = 10;
              boxY = targetY - boxH / 2;
              lineX1 = boxX + boxW;
              lineY1 = targetY;
            } else if (side === "right") {
              boxX = dimensions.width + LEGEND_MARGIN * 2 - boxW - 10;
              boxY = targetY - boxH / 2;
              lineX1 = boxX;
              lineY1 = targetY;
            } else if (side === "top") {
              boxX = targetX - boxW / 2;
              boxY = 10;
              lineX1 = targetX;
              lineY1 = boxY + boxH;
            } else {
              boxX = targetX - boxW / 2;
              boxY = dimensions.height + LEGEND_MARGIN * 2 - boxH - 10;
              lineX1 = targetX;
              lineY1 = boxY;
            }

            // Ensure boxes stay within the SVG
            boxX = Math.max(5, Math.min(boxX, dimensions.width + LEGEND_MARGIN * 2 - boxW - 5));
            boxY = Math.max(5, Math.min(boxY, dimensions.height + LEGEND_MARGIN * 2 - boxH - 5));

            return (
              <g key={i} className="animate-in fade-in zoom-in duration-500" style={{ transitionDelay: `${i * 150}ms` }}>
                {/* Connection line (arrow) */}
                <line
                  x1={lineX1}
                  y1={lineY1}
                  x2={targetX}
                  y2={targetY}
                  stroke="currentColor"
                  strokeWidth="2"
                  className="text-primary/60"
                  markerEnd="url(#arrowhead)"
                />
                
                {/* Target point glow */}
                <circle
                  cx={targetX}
                  cy={targetY}
                  r="4"
                  className="fill-primary animate-pulse"
                />

                {/* Legend box */}
                <foreignObject x={boxX} y={boxY} width={boxW} height={boxH}>
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="bg-white/95 backdrop-blur-sm border border-primary/30 shadow-lg rounded-lg px-2 py-1 text-[10px] font-bold text-primary text-center leading-tight uppercase tracking-tight">
                      {leg.label}
                    </div>
                  </div>
                </foreignObject>
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
};

export default ImageWithLegends;
