import { useState, useRef, useEffect } from "react";
import { Send, Sparkles, User, CheckCircle2, XCircle, FileText, AlertTriangle, ArrowRight, ChevronRight } from "lucide-react";

interface Segmentation {
  id: string;
  label: string;
  confidence: number;
  type: string;
}

interface Message {
  id: string;
  role: "assistant" | "user";
  text: string;
}

interface AnalysisPanelProps {
  loaded: boolean;
  segmentations: Segmentation[];
  currentIndex: number;
  validationStates: Record<number, "pending" | "validated" | "rejected">;
  onValidate: (index: number) => void;
  onReject: (index: number) => void;
  onNavigateNext: () => void;
}

const DEMO_REPORTS: Record<string, string> = {
  "SEG-001": `**Location:** Right frontal lobe, periventricular region
**Lesion type:** High-grade glial tumor (suspected glioblastoma)
**Estimated dimensions:** 3.2 × 2.8 × 2.5 cm
**Characteristics:**
• Irregular ring enhancement after gadolinium injection
• Central necrosis with extensive perilesional edema
• Moderate mass effect with 4 mm midline shift
**Recommendation:** Stereotactic biopsy recommended. MRI spectroscopy correlation suggested.`,

  "SEG-002": `**Location:** Left temporal lobe, cortical zone
**Lesion type:** Suspicious nodule — probable meningioma
**Estimated dimensions:** 1.5 × 1.2 cm
**Characteristics:**
• Well-defined extra-axial lesion
• Intense homogeneous enhancement
• Visible dural attachment base
• No significant edema
**Recommendation:** MRI surveillance at 6 months. No urgent intervention required.`,

  "SEG-003": `**Location:** Right parietal lobe, deep white matter
**Lesion type:** Abnormal signal zone — probable demyelination
**Estimated dimensions:** Diffuse zone, approximately 2.0 × 1.8 cm
**Characteristics:**
• T2/FLAIR hyperintensity without enhancement
• No diffusion restriction
• No mass effect
**Recommendation:** Clinical correlation with neurological assessment. Rule out inflammatory pathology (MS).`,
};

const AnalysisPanel = ({
  loaded,
  segmentations,
  currentIndex,
  validationStates,
  onValidate,
  onReject,
  onNavigateNext,
}: AnalysisPanelProps) => {
  const [chatMessages, setChatMessages] = useState<Record<number, Message[]>>({});
  const [input, setInput] = useState("");
  const [manualMode, setManualMode] = useState(false);
  const [manualCorrection, setManualCorrection] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const seg = segmentations[currentIndex];
  const state = validationStates[currentIndex] || "pending";
  const allValidated = segmentations.every((_, i) => validationStates[i] === "validated");
  const isLastSegmentation = currentIndex === segmentations.length - 1;
  const messages = chatMessages[currentIndex] || [];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    setInput("");
    setManualMode(false);
    setManualCorrection("");
  }, [currentIndex]);

  const sendMessage = () => {
    const text = input.trim();
    if (!text) return;
    const userMsg: Message = { id: `u-${Date.now()}`, role: "user", text };
    setChatMessages((prev) => ({
      ...prev,
      [currentIndex]: [...(prev[currentIndex] || []), userMsg],
    }));
    setInput("");
    setTimeout(() => {
      setChatMessages((prev) => ({
        ...prev,
        [currentIndex]: [
          ...(prev[currentIndex] || []),
          {
            id: `a-${Date.now()}`,
            role: "assistant" as const,
            text: "Thank you for your feedback. The analysis will be adjusted based on your observations. In production, Med-Gemini would reprocess the segmentation with your corrections.",
          },
        ],
      }));
    }, 800);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (!loaded) {
    return (
      <div className="flex flex-col h-full bg-card">
        <div className="px-5 py-4 border-b border-border/60 bg-ge-gradient relative overflow-hidden">
          <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-accent/20 blur-xl" />
          <div className="relative">
            <h2 className="text-sm font-display font-semibold text-primary-foreground tracking-wide flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              Analysis Report
            </h2>
            <p className="text-xs text-primary-foreground/70 mt-1">
              Load patient data to view the analysis.
            </p>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center bg-ge-gradient-soft">
          <div className="text-center space-y-3 animate-float-up">
            <FileText className="w-12 h-12 text-muted-foreground/40 mx-auto" />
            <p className="text-sm text-muted-foreground">Waiting for data to load…</p>
          </div>
        </div>
      </div>
    );
  }

  if (allValidated) {
    return (
      <div className="flex flex-col h-full bg-card">
        <div className="px-5 py-4 border-b border-border/60 bg-ge-gradient relative overflow-hidden">
          <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-accent/20 blur-xl" />
          <div className="relative">
            <h2 className="text-sm font-display font-semibold text-primary-foreground tracking-wide flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              All analyses validated
            </h2>
            <p className="text-xs text-primary-foreground/70 mt-1">
              {segmentations.length} segmentations reviewed and validated.
            </p>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center bg-ge-gradient-soft">
          <div className="text-center space-y-6 animate-float-up">
            <div className="w-20 h-20 mx-auto rounded-2xl bg-secondary flex items-center justify-center shadow-ge-soft">
              <CheckCircle2 className="w-10 h-10 text-primary" />
            </div>
            <div className="space-y-2">
              <p className="text-lg font-display font-semibold text-foreground">Review complete</p>
              <p className="text-sm text-muted-foreground max-w-xs mx-auto leading-relaxed">
                All segmentations have been validated. You can generate the final consolidated report.
              </p>
            </div>
            <div className="space-y-3">
              {segmentations.map((s, i) => (
                <div key={s.id} className="flex items-center gap-2 text-xs text-muted-foreground justify-center">
                  <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                  <span>{s.label}</span>
                  <span className="text-primary font-semibold">{s.confidence}%</span>
                </div>
              ))}
            </div>
            <button
              className="inline-flex items-center gap-2.5 px-6 py-3 rounded-xl bg-ge-gradient text-primary-foreground font-semibold text-sm shadow-ge-lg hover:shadow-ge-glow hover:scale-[1.03] active:scale-[0.98] transition-all animate-gradient"
            >
              <FileText className="w-4 h-4" />
              Generate final report
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-card">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border/60 bg-ge-gradient relative overflow-hidden">
        <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-accent/20 blur-xl" />
        <div className="relative">
          <h2 className="text-sm font-display font-semibold text-primary-foreground tracking-wide flex items-center gap-2">
            {state === "rejected" ? (
              <><AlertTriangle className="w-4 h-4" /> Correction in progress</>
            ) : (
              <><FileText className="w-4 h-4" /> Analysis Report — {seg?.id}</>
            )}
          </h2>
          <p className="text-xs text-primary-foreground/70 mt-1">
            {state === "rejected"
              ? "Describe the necessary corrections in the chat below."
              : "Analysis generated by Med-Gemini. Validate or contest the results."}
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto bg-ge-gradient-soft">
        {state === "pending" && seg && (
          <div className="p-5 space-y-4 animate-float-up">
            {/* Validation progress */}
            <div className="flex items-center gap-2">
              {segmentations.map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 flex-1 rounded-full transition-colors ${
                    validationStates[i] === "validated"
                      ? "bg-primary"
                      : validationStates[i] === "rejected"
                      ? "bg-destructive/60"
                      : i === currentIndex
                      ? "bg-primary/40"
                      : "bg-border"
                  }`}
                />
              ))}
            </div>

            {/* Report card */}
            <div className="rounded-xl border border-border/60 bg-card shadow-ge-soft overflow-hidden">
              <div className="px-4 py-3 border-b border-border/40 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-primary" />
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Med-Gemini Analysis
                  </span>
                </div>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                  Confidence: {seg.confidence}%
                </span>
              </div>
              <div className="p-4">
                <p className="text-sm leading-relaxed text-foreground whitespace-pre-line">
                  {DEMO_REPORTS[seg.id]?.split("**").map((part, i) =>
                    i % 2 === 1 ? (
                      <strong key={i} className="text-foreground font-semibold">{part}</strong>
                    ) : (
                      <span key={i}>{part}</span>
                    )
                  )}
                </p>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => onValidate(currentIndex)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-ge-gradient text-primary-foreground font-semibold text-sm shadow-ge hover:shadow-ge-lg hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                <CheckCircle2 className="w-4 h-4" />
                Validate analysis
              </button>
              <button
                onClick={() => onReject(currentIndex)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-destructive/30 bg-destructive/5 text-destructive font-semibold text-sm hover:bg-destructive/10 hover:border-destructive/50 active:scale-[0.98] transition-all"
              >
                <XCircle className="w-4 h-4" />
                Contest
              </button>
            </div>
          </div>
        )}

        {state === "validated" && seg && (
          <div className="p-5 space-y-4 animate-float-up">
            {/* Progress */}
            <div className="flex items-center gap-2">
              {segmentations.map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 flex-1 rounded-full transition-colors ${
                    validationStates[i] === "validated"
                      ? "bg-primary"
                      : validationStates[i] === "rejected"
                      ? "bg-destructive/60"
                      : "bg-border"
                  }`}
                />
              ))}
            </div>

            <div className="rounded-xl border border-primary/20 bg-secondary/50 p-6 text-center space-y-4 shadow-ge-soft">
              <CheckCircle2 className="w-12 h-12 text-primary mx-auto" />
              <div>
                <p className="text-base font-display font-semibold text-foreground">Analysis validated</p>
                <p className="text-sm text-muted-foreground mt-1">{seg.label} — {seg.confidence}%</p>
              </div>
              {!isLastSegmentation && (
                <button
                  onClick={onNavigateNext}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-ge-gradient text-primary-foreground font-semibold text-sm shadow-ge hover:shadow-ge-lg hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                  Next segmentation
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        )}

        {state === "rejected" && (
          <div className="flex flex-col h-full">
            {/* Compact report reminder */}
            <div className="px-4 py-3 border-b border-border/40 bg-destructive/5">
              <div className="flex items-center gap-2 text-xs text-destructive font-semibold">
                <AlertTriangle className="w-3.5 h-3.5" />
                Analysis contested — {seg?.label}
              </div>
            </div>

            {/* Chat messages */}
            <div className={`${manualMode ? 'hidden' : 'flex-1'} overflow-y-auto px-4 py-4 space-y-3`}>
              {messages.length === 0 && (
                <div className="text-center py-6 animate-float-up">
                  <p className="text-sm text-muted-foreground">
                    Describe what doesn't match in the analysis.
                  </p>
                </div>
              )}
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-2.5 animate-float-up ${msg.role === "user" ? "flex-row-reverse" : ""}`}
                >
                  <div
                    className={`w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center text-xs ${
                      msg.role === "assistant"
                        ? "bg-secondary text-secondary-foreground shadow-ge-soft"
                        : "bg-ge-gradient text-primary-foreground shadow-ge"
                    }`}
                  >
                    {msg.role === "assistant" ? <Sparkles className="w-3 h-3" /> : <User className="w-3 h-3" />}
                  </div>
                  <div
                    className={`max-w-[85%] px-3.5 py-2.5 text-sm leading-relaxed ${
                      msg.role === "assistant"
                        ? "rounded-2xl rounded-tl-md bg-card border border-border/60 text-foreground shadow-ge-soft"
                        : "rounded-2xl rounded-tr-md bg-ge-gradient text-primary-foreground shadow-ge"
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            {manualMode ? (
              <div className="flex-1 flex flex-col px-4 py-3 border-t border-border/60 bg-card space-y-2">
                <p className="text-xs font-semibold text-muted-foreground">Manual correction</p>
                <textarea
                  value={manualCorrection}
                  onChange={(e) => setManualCorrection(e.target.value)}
                  placeholder="Enter your detailed correction…"
                  className="flex-1 w-full bg-background text-sm text-foreground placeholder:text-muted-foreground resize-none outline-none rounded-xl border border-border px-3 py-2 focus:border-primary/50 focus:shadow-ge transition-all"
                />
                <div className="flex justify-between items-center">
                  <button
                    onClick={() => setManualMode(false)}
                    className="text-xs font-semibold text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                  >
                    ← Back to chat
                  </button>
                  <button
                    onClick={() => {
                      if (manualCorrection.trim()) {
                        onValidate(currentIndex);
                      }
                    }}
                    disabled={!manualCorrection.trim()}
                    className="text-xs font-semibold text-primary hover:text-primary/80 flex items-center gap-1 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    Validate correction
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="px-4 py-3 border-t border-border/60 bg-card">
                <div className="flex items-end gap-2 rounded-xl border border-border bg-background px-3 py-2 focus-within:border-primary/50 focus-within:shadow-ge transition-all">
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Describe the correction…"
                    rows={1}
                    className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground resize-none outline-none min-h-[36px] max-h-[100px] py-1.5"
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!input.trim()}
                    className="w-8 h-8 rounded-lg bg-ge-gradient text-primary-foreground flex items-center justify-center flex-shrink-0 hover:scale-105 active:scale-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="mt-2 flex justify-between">
                  <button
                    onClick={() => setManualMode(true)}
                    className="text-xs font-semibold text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                  >
                    <FileText className="w-3 h-3" />
                    Manual correction
                  </button>
                  <button
                    onClick={() => onValidate(currentIndex)}
                    className="text-xs font-semibold text-primary hover:text-primary/80 flex items-center gap-1 transition-colors"
                  >
                    Validate after correction
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AnalysisPanel;
