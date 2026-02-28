import { useState, useCallback, useRef, useEffect } from "react";
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCcw, ScanSearch, CheckCircle2 } from "lucide-react";
import sampleScan from "@/assets/sample-scan.jpg";

interface Segmentation {
  id: string;
  label: string;
  confidence: number;
  type: string;
}

interface SegmentationViewerProps {
  loaded: boolean;
  onLoad: () => void;
  currentIndex: number;
  onChangeIndex: (index: number) => void;
  segmentations: Segmentation[];
  validationStates: Record<number, "pending" | "validated" | "rejected">;
}

const MIN_ZOOM = 1;
const MAX_ZOOM = 8;
const ZOOM_STEP = 0.25;
const ZOOM_SCROLL_STEP = 0.15;

const SegmentationViewer = ({
  loaded,
  onLoad,
  currentIndex,
  onChangeIndex,
  segmentations,
  validationStates,
}: SegmentationViewerProps) => {
  const seg = loaded ? segmentations[currentIndex] : null;
  const total = segmentations.length;
  const state = validationStates[currentIndex];

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Reset zoom & pan on image change
  const prevIndex = useRef(currentIndex);
  useEffect(() => {
    if (prevIndex.current !== currentIndex) {
      prevIndex.current = currentIndex;
      setZoom(1);
      setPan({ x: 0, y: 0 });
    }
  }, [currentIndex]);

  const handleZoomIn = useCallback(() => {
    setZoom((z) => Math.min(z + ZOOM_STEP, MAX_ZOOM));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom((z) => {
      const next = Math.max(z - ZOOM_STEP, MIN_ZOOM);
      if (next === 1) setPan({ x: 0, y: 0 });
      return next;
    });
  }, []);

  const handleResetZoom = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  // Scroll wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -ZOOM_SCROLL_STEP : ZOOM_SCROLL_STEP;
    setZoom((z) => {
      const next = Math.min(Math.max(z + delta * z, MIN_ZOOM), MAX_ZOOM);
      if (next <= 1) setPan({ x: 0, y: 0 });
      return next;
    });
  }, []);

  // Double-click to toggle zoom
  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    if (zoom > 1) {
      setZoom(1);
      setPan({ x: 0, y: 0 });
    } else {
      // Zoom to 3x centered on click position
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        const relX = (e.clientX - rect.left) / rect.width - 0.5;
        const relY = (e.clientY - rect.top) / rect.height - 0.5;
        setZoom(3);
        setPan({ x: -relX * rect.width * 0.5, y: -relY * rect.height * 0.5 });
      } else {
        setZoom(3);
      }
    }
  }, [zoom]);

  // Pan handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (zoom <= 1) return;
    e.preventDefault();
    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
  }, [zoom, pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    setPan({ x: dragStart.current.panX + dx, y: dragStart.current.panY + dy });
  }, [isDragging]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    const handleGlobalUp = () => setIsDragging(false);
    window.addEventListener("mouseup", handleGlobalUp);
    return () => window.removeEventListener("mouseup", handleGlobalUp);
  }, []);

  const zoomPercent = Math.round(zoom * 100);

  return (
    <div className="flex flex-col h-full bg-ge-gradient-radial">
      {/* Toolbar */}
      {loaded && (
        <div className="flex items-center justify-between px-4 py-2 glass-white border-b border-border/60">
          {/* Zoom controls */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleZoomOut}
              disabled={zoom <= MIN_ZOOM}
              className="w-7 h-7 rounded-lg border border-border bg-card hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-primary transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              title="Zoom out (−)"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] font-semibold text-muted-foreground min-w-[3rem] text-center tabular-nums">
              {zoomPercent}%
            </span>
            <button
              onClick={handleZoomIn}
              disabled={zoom >= MAX_ZOOM}
              className="w-7 h-7 rounded-lg border border-border bg-card hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-primary transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              title="Zoom in (+)"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            {zoom > 1 && (
              <button
                onClick={handleResetZoom}
                className="w-7 h-7 rounded-lg border border-border bg-card hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-primary transition-all ml-1"
                title="Reset zoom"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Navigation */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onChangeIndex(Math.max(0, currentIndex - 1))}
              disabled={currentIndex === 0}
              className="w-7 h-7 rounded-lg border border-border bg-card hover:bg-secondary hover:border-primary/20 flex items-center justify-center text-muted-foreground hover:text-primary transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] font-semibold text-muted-foreground min-w-[3rem] text-center tabular-nums">
              {currentIndex + 1} / {total}
            </span>
            <button
              onClick={() => onChangeIndex(Math.min(total - 1, currentIndex + 1))}
              disabled={currentIndex === total - 1}
              className="w-7 h-7 rounded-lg border border-border bg-card hover:bg-secondary hover:border-primary/20 flex items-center justify-center text-muted-foreground hover:text-primary transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Viewer area */}
      <div className="flex-1 flex items-center justify-center overflow-hidden bg-ge-mesh relative">
        {!loaded ? (
          <div className="text-center space-y-6 animate-float-up">
            <div className="w-24 h-24 mx-auto rounded-2xl bg-secondary flex items-center justify-center shadow-ge-soft shimmer-border animate-ge-pulse">
              <ScanSearch className="w-10 h-10 text-primary" />
            </div>
            <div className="space-y-2">
              <p className="text-lg font-display font-semibold text-foreground">No data loaded</p>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
                Click below to load the critical segmentations identified by the analysis agent.
              </p>
            </div>
            <button
              onClick={onLoad}
              className="inline-flex items-center gap-2.5 px-6 py-3 rounded-xl bg-ge-gradient text-primary-foreground font-semibold text-sm shadow-ge-lg hover:shadow-ge-glow hover:scale-[1.03] active:scale-[0.98] transition-all animate-gradient"
            >
              <ScanSearch className="w-4 h-4" />
              Load patient data
            </button>
          </div>
        ) : seg ? (
          <div className="w-full h-full flex flex-col animate-float-up p-[44px]" key={currentIndex}>
            <div
              ref={containerRef}
              className={`relative flex-1 overflow-hidden rounded-xl ${
                state === "validated" ? "ring-2 ring-primary/30 ring-inset" : ""
              }`}
              onWheel={handleWheel}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onDoubleClick={handleDoubleClick}
              style={{ cursor: zoom > 1 ? (isDragging ? "grabbing" : "grab") : "crosshair" }}
            >
              <img
                src={sampleScan}
                alt={seg.label}
                className="w-full h-full object-contain select-none pointer-events-none"
                style={{
                  transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
                  transformOrigin: "center center",
                  transition: isDragging ? "none" : "transform 0.2s ease-out",
                }}
                draggable={false}
              />
              {/* Validation badge */}
              {state === "validated" && (
                <div className="absolute top-3 left-3 z-10">
                  <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/90 text-primary-foreground text-xs font-semibold backdrop-blur-sm shadow-ge">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Validated
                  </span>
                </div>
              )}
            </div>
            {/* Compact meta bar */}
            <div className="flex items-center justify-between px-4 py-2 glass-white border-t border-border/60">
              <div className="flex items-center gap-2">
                <p className="text-xs font-display font-semibold text-foreground">{seg.label}</p>
                <span className="text-[10px] text-muted-foreground">({seg.id})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Confidence</span>
                <span className="text-sm font-display font-bold text-ge-gradient">{seg.confidence}%</span>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default SegmentationViewer;
