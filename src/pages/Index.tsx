import RadioLogo from "@/components/RadioLogo";
import SegmentationViewer from "@/components/SegmentationViewer";
import AnalysisPanel from "@/components/AnalysisPanel";
import { useState } from "react";

const SEGMENTATIONS = [
  { id: "SEG-001", label: "Frontal lobe — Glial tumor", confidence: 94.2, type: "Tumor" },
  { id: "SEG-002", label: "Temporal lobe — Suspicious nodule", confidence: 87.5, type: "Nodule" },
  { id: "SEG-003", label: "Parietal lobe — Abnormal zone", confidence: 76.1, type: "Anomaly" },
];

const Index = () => {
  const [loaded, setLoaded] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [validationStates, setValidationStates] = useState<Record<number, "pending" | "validated" | "rejected">>({});

  const handleValidate = (index: number) => {
    setValidationStates((prev) => ({ ...prev, [index]: "validated" }));
  };

  const handleReject = (index: number) => {
    setValidationStates((prev) => ({ ...prev, [index]: "rejected" }));
  };

  const handleNavigateNext = () => {
    setCurrentIndex((prev) => Math.min(SEGMENTATIONS.length - 1, prev + 1));
  };

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="flex items-center justify-between px-5 py-3 bg-card border-b border-border/60 glass-white relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-ge-gradient flex items-center justify-center text-primary-foreground shadow-ge animate-gradient">
            <RadioLogo className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-base font-display font-bold text-foreground tracking-tight leading-tight">
              Radiologist <span className="text-ge-gradient">Review</span>
            </h1>
            <p className="text-[11px] text-muted-foreground font-medium tracking-wide">Powered by AI</p>
          </div>
        </div>
      </header>

      {/* Main layout: 60% viewer | 40% panel */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-[3fr_2fr] min-h-0">
        <div className="overflow-hidden border-r border-border/40">
          <SegmentationViewer
            loaded={loaded}
            onLoad={() => setLoaded(true)}
            currentIndex={currentIndex}
            onChangeIndex={setCurrentIndex}
            segmentations={SEGMENTATIONS}
            validationStates={validationStates}
          />
        </div>
        <div className="overflow-hidden">
          <AnalysisPanel
            loaded={loaded}
            segmentations={SEGMENTATIONS}
            currentIndex={currentIndex}
            validationStates={validationStates}
            onValidate={handleValidate}
            onReject={handleReject}
            onNavigateNext={handleNavigateNext}
          />
        </div>
      </main>
    </div>
  );
};

export default Index;
