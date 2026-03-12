import { useState } from "react";
import { FileText, ImageIcon, ChevronLeft, ChevronRight } from "lucide-react";
import ImageWithLegends from "@/components/ImageWithLegends";
import type { LegendItem } from "@/types/report";

interface LeftPanelProps {
  /** Main content: PDF / report zone */
  children: React.ReactNode;
  /** AI-labeled images (if present, shows Images tab + carousel) */
  legendItems?: LegendItem[] | null;
}

/** Left panel: report (PDF) or carousel of labeled images with navigation. */
const LeftPanel = ({ children, legendItems }: LeftPanelProps) => {
  const [view, setView] = useState<"report" | "legends">("report");
  const [legendIndex, setLegendIndex] = useState(0);

  const hasLegends = Array.isArray(legendItems) && legendItems.length > 0;
  const currentLegend = hasLegends ? legendItems[legendIndex] : null;

  return (
    <div className="flex flex-col h-full bg-card overflow-hidden">
      {hasLegends && (
        <div className="flex-shrink-0 flex border-b border-border/60 bg-card/80">
          <button
            type="button"
            onClick={() => setView("report")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors ${
              view === "report"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
          >
            <FileText className="w-4 h-4" />
            Report
          </button>
          <button
            type="button"
            onClick={() => setView("legends")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors ${
              view === "legends"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
          >
            <ImageIcon className="w-4 h-4" />
            Images ({legendItems.length})
          </button>
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
        {/* Report: always mounted to keep file/PDF displayed when returning to the tab */}
        <div className={`flex-1 min-h-0 flex flex-col ${!hasLegends || view === "report" ? "" : "hidden"}`}>
          {children}
        </div>
        {/* Labeled images: displayed only when Images tab is active */}
        {hasLegends && (
          <div className={`flex-1 min-h-0 flex flex-col ${view === "legends" ? "" : "hidden"}`}>
            <div className="flex-1 min-h-0 overflow-auto flex items-center justify-center p-4 bg-gm-gradient-soft">
              {currentLegend && (
                currentLegend.legendes && currentLegend.legendes.length > 0 ? (
                  <ImageWithLegends
                    imageUrl={currentLegend.imageUrl}
                    legendes={currentLegend.legendes}
                    alt={`Imaging image ${legendItems.length > 1 ? legendIndex + 1 : ""}`.trim()}
                    className="w-full h-full max-w-4xl min-h-[min(70vh,800px)]"
                  />
                ) : (
                  <img
                    src={currentLegend.imageUrl}
                    alt="Imaging image"
                    className="max-w-full max-h-[min(70vh,800px)] w-full max-w-4xl object-contain rounded-lg"
                  />
                )
              )}
            </div>
            <div className="flex-shrink-0 flex items-center justify-between gap-2 px-4 py-3 border-t border-border/60 bg-card">
              <button
                type="button"
                onClick={() => setLegendIndex((i) => Math.max(0, i - 1))}
                disabled={legendIndex === 0}
                className="p-2 rounded-lg border border-border text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                aria-label="Previous image"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className="text-sm text-muted-foreground">
                {legendIndex + 1} / {legendItems.length}
              </span>
              <button
                type="button"
                onClick={() => setLegendIndex((i) => Math.min(legendItems.length - 1, i + 1))}
                disabled={legendIndex === legendItems.length - 1}
                className="p-2 rounded-lg border border-border text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                aria-label="Next image"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LeftPanel;
