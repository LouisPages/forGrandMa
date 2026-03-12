import { useState, useRef, useEffect } from "react";
import { Send, Heart, User, Settings, Sparkles, X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import ReportExplanationPanel from "@/components/ReportExplanationPanel";
import type {
  ReportPipelineResultPartial,
  ContextQuestion,
  PatientContext,
} from "@/types/report";

interface Message {
  id: string;
  role: "assistant" | "user";
  text: string;
}

const API_BASE = import.meta.env.VITE_API_URL || "";

interface ChatPanelProps {
  pipelineResult: ReportPipelineResultPartial | null;
  reportLoading?: boolean;
  contextQuestions?: ContextQuestion[] | null;
  patientContext?: PatientContext;
  onPatientContextChange?: (id: string, value: string) => void;
  /** Launches analysis (simplification + questions). If contextOverride is provided, use that context (e.g. after saving settings). */
  onLaunchAnalysisWithContext?: (contextOverride?: PatientContext) => void;
  setPatientContextBulk?: (ctx: PatientContext) => void;
  clearPatientContext?: () => void;
}

const ChatPanel = ({
  pipelineResult,
  reportLoading = false,
  contextQuestions = null,
  patientContext = {},
  onPatientContextChange,
  onLaunchAnalysisWithContext,
  setPatientContextBulk,
  clearPatientContext,
}: ChatPanelProps) => {
  const isReportComplete =
    !reportLoading &&
    !!pipelineResult?.extraction &&
    pipelineResult.vulgarization != null &&
    pipelineResult.questions != null;
  const canAsk = isReportComplete;

  /** Waiting for context responses: extraction available, context questions available, but simplification not yet. Not displayed when explanation is being adapted to legends. */
  const awaitingContext =
    !!pipelineResult?.extraction &&
    Array.isArray(contextQuestions) &&
    contextQuestions.length >= 0 &&
    pipelineResult.vulgarization == null &&
    !reportLoading &&
    !(pipelineResult?.legendItems && pipelineResult.legendItems.length > 0);

  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsDraft, setSettingsDraft] = useState<PatientContext>({});
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (pipelineResult === null) setChatMessages([]);
  }, [pipelineResult]);

  const openSettings = () => {
    setSettingsDraft({ ...patientContext });
    setSettingsOpen(true);
  };
  const closeSettings = () => setSettingsOpen(false);
  const saveSettings = () => {
    setPatientContextBulk?.(settingsDraft);
    closeSettings();
    if (pipelineResult?.extraction) {
      onLaunchAnalysisWithContext?.(settingsDraft);
    }
  };
  const hasContextToShow = !!pipelineResult?.extraction;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, sending, isReportComplete]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || !canAsk) return;
    const userMsg: Message = { id: `u-${Date.now()}`, role: "user", text };
    setChatMessages((prev) => [...prev, userMsg]);
    setInput("");
    setSending(true);

    try {
      const history = chatMessages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .slice(-5)
        .map((m) => ({ role: m.role as "user" | "assistant", text: m.text }));

      let contextStr = "";
      if (pipelineResult?.extraction) {
        try {
          const seen = new WeakSet<object>();
          const extractionStr = JSON.stringify(
            pipelineResult.extraction,
            (_, value) => {
              if (typeof value === "object" && value !== null) {
                if (seen.has(value)) return "[Circular]";
                seen.add(value);
              }
              return value;
            },
            2
          );
          contextStr = `Extraction: ${extractionStr}\n\nSimplification: ${pipelineResult.vulgarization ?? ""}`;
        } catch {
          contextStr = `Simplification: ${pipelineResult.vulgarization ?? ""}`;
        }
      }
      if (pipelineResult?.legendItems && pipelineResult.legendItems.length > 0) {
        const allLabels = pipelineResult.legendItems.flatMap((it) => it.legendes?.map((l) => l.label).filter(Boolean) ?? []);
        contextStr += `\n\nImaging images (X-ray/MRI) accompany this report. Labels: ${allLabels.length > 0 ? allLabels.map((l, i) => `${i + 1}) "${l}"`).join("; ") : "in progress"}. When relevant, refer to these images and labels (e.g. "as shown on the image, the area \"…\" corresponds to…").`;
      }
      if (Object.keys(patientContext).length > 0) {
        contextStr += `\n\nPatient context (answers to context questions):\n${Object.entries(patientContext)
          .filter(([, v]) => v != null && String(v).trim() !== "")
          .map(([k, v]) => `${k}: ${String(v).trim()}`)
          .join("\n")}`;
      }

      const res = await fetch(`${API_BASE}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          context: contextStr,
          history,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Error ${res.status}`);
      }
      const data = await res.json();
      setChatMessages((prev) => [
        ...prev,
        { id: `a-${Date.now()}`, role: "assistant", text: data.reply || "Sorry, I couldn't reply." },
      ]);
    } catch (e) {
      setChatMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: "assistant",
          text: e instanceof Error ? e.message : "An error occurred. Please try again.",
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const showReportBlock = pipelineResult?.extraction != null;
  const showWelcomeOnly = !pipelineResult && !reportLoading;
  const showLoadingOnly = reportLoading && !pipelineResult?.extraction;
  const showConversation = showReportBlock && (isReportComplete || chatMessages.length > 0);

  return (
    <div className="flex flex-col h-full bg-card">
      <div className="px-5 py-4 border-b border-border/60 bg-gm-gradient relative overflow-hidden flex-shrink-0">
        <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-primary-foreground/10 blur-xl" />
        <div className="absolute -bottom-4 -left-4 w-16 h-16 rounded-full bg-primary-foreground/5 blur-lg" />
        <div className="relative flex items-center justify-between w-full gap-2">
          <div className="min-w-0">
            <h2 className="text-sm font-display font-semibold text-primary-foreground tracking-wide flex items-center gap-2">
              <Heart className="w-4 h-4 shrink-0" />
              Your health assistant
            </h2>
            <p className="text-xs text-primary-foreground/70 mt-1">
              {canAsk
                ? "Ask your questions, I'll explain simply."
                : awaitingContext
                  ? "A few questions to personalize the explanation."
                  : "The report analysis will appear here."}
            </p>
          </div>
          <button
            type="button"
            onClick={openSettings}
            className="p-2 rounded-lg text-primary-foreground/80 hover:bg-primary-foreground/15 hover:text-primary-foreground transition-colors shrink-0"
            title="Patient context (answers to personalise the explanation)"
            aria-label="Context settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Settings Modal: patient context */}
      {settingsOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="settings-title"
        >
          <div className="bg-card border border-border rounded-2xl shadow-xl max-w-md w-full max-h-[85vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h3 id="settings-title" className="text-sm font-semibold text-foreground">
                Patient Context
              </h3>
              <button
                type="button"
                onClick={closeSettings}
                className="p-2 rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <p className="text-xs text-muted-foreground">
                This information helps tailor the explanation and questions for your doctor. You can edit or clear it.
              </p>
              {(contextQuestions?.length ?? 0) > 0 ? (
                contextQuestions!.map((q) => (
                  <div key={q.id}>
                    <label htmlFor={`ctx-${q.id}`} className="block text-xs font-medium text-foreground mb-1">
                      {q.label}
                    </label>
                    <input
                      id={`ctx-${q.id}`}
                      type="text"
                      value={settingsDraft[q.id] ?? ""}
                      onChange={(e) => setSettingsDraft((prev) => ({ ...prev, [q.id]: e.target.value }))}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                      placeholder="Your answer…"
                    />
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No context questions for this exam type.</p>
              )}
            </div>
            <div className="flex gap-2 px-4 py-3 border-t border-border">
              <button
                type="button"
                onClick={() => {
                  clearPatientContext?.();
                  setSettingsDraft({});
                  closeSettings();
                  if (pipelineResult?.extraction) {
                    onLaunchAnalysisWithContext?.({});
                  }
                }}
                className="px-3 py-2 text-xs font-medium rounded-lg border border-border text-muted-foreground hover:bg-secondary transition-colors"
              >
                Clear all
              </button>
              <button
                type="button"
                onClick={saveSettings}
                className="flex-1 px-4 py-2 text-sm font-medium rounded-lg bg-gm-gradient text-primary-foreground shadow-gm hover:opacity-90 transition-opacity"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto min-h-0 flex flex-col bg-gm-gradient-soft">
        <div className="flex flex-col">
          {/* Report block */}
          {showReportBlock && (
            <div className="flex-shrink-0 border-b border-border/40 bg-background/50">
              <ReportExplanationPanel
                result={pipelineResult}
                isComplete={!reportLoading}
                embedded
                explanationLoading={reportLoading && !!pipelineResult?.extraction && pipelineResult.vulgarization == null}
              />
            </div>
          )}

          {/* Conversation part */}
          <div className="px-5 py-4 space-y-4 flex-1">
            {showWelcomeOnly && (
              <div className="flex gap-3 animate-float-up">
                <div className="w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center bg-secondary text-secondary-foreground shadow-gm-soft">
                  <Heart className="w-3.5 h-3.5" />
                </div>
                <div className="max-w-[85%] px-4 py-3 text-sm leading-relaxed rounded-2xl rounded-tl-md bg-card border border-border/60 text-foreground shadow-gm-soft">
                  <p className="whitespace-pre-wrap break-words">
                    Hello! 👋 Upload your report (PDF or photo) on the left, then click "Understand my report". The analysis will appear above, then you can ask your questions here.
                  </p>
                </div>
              </div>
            )}

            {showLoadingOnly && (
              <div className="flex gap-3 animate-float-up">
                <div className="w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center bg-secondary text-secondary-foreground shadow-gm-soft">
                  <Heart className="w-3.5 h-3.5" />
                </div>
                <div className="max-w-[85%] px-4 py-3 text-sm rounded-2xl rounded-tl-md bg-card border border-border/60 text-muted-foreground shadow-gm-soft">
                  Analyzing your report, one moment…
                </div>
              </div>
            )}

            {/* Context phase */}
            {awaitingContext && (
              <div className="space-y-4">
                <div className="flex gap-3 animate-float-up">
                  <div className="w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center bg-secondary text-secondary-foreground shadow-gm-soft">
                    <Heart className="w-3.5 h-3.5" />
                  </div>
                  <div className="max-w-[85%] px-4 py-3 text-sm leading-relaxed rounded-2xl rounded-tl-md bg-card border border-border/60 text-foreground shadow-gm-soft">
                    {(contextQuestions ?? []).length > 0 ? (
                      <>
                        <p className="mb-2">
                          To better tailor the explanation to your situation, could you answer these few questions (optional)?
                        </p>
                        <div className="space-y-3 mt-3">
                          {(contextQuestions ?? []).map((q) => (
                        <div key={q.id}>
                          <label htmlFor={`context-${q.id}`} className="block text-xs font-medium text-muted-foreground mb-1">
                            {q.label}
                          </label>
                          <input
                            id={`context-${q.id}`}
                            type="text"
                            value={patientContext[q.id] ?? ""}
                            onChange={(e) => onPatientContextChange?.(q.id, e.target.value)}
                            className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                            placeholder="Your answer…"
                          />
                        </div>
                      ))}
                        </div>
                      </>
                    ) : (
                      <p className="mb-2">Click below to start the explanation of your report.</p>
                    )}
                    <div className="mt-4">
                      <button
                        type="button"
                        onClick={() => onLaunchAnalysisWithContext?.(patientContext)}
                        disabled={reportLoading}
                        className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl bg-gm-gradient text-primary-foreground font-semibold text-sm shadow-gm hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                      >
                        <Sparkles className="w-4 h-4" />
                        {reportLoading ? "Analysis in progress…" : "Run analysis"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {isReportComplete && (
              <div className="flex gap-3 animate-float-up">
                <div className="w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center bg-secondary text-secondary-foreground shadow-gm-soft">
                  <Heart className="w-3.5 h-3.5" />
                </div>
                <div className="max-w-[85%] px-4 py-3 text-sm leading-relaxed rounded-2xl rounded-tl-md bg-card border border-border/60 text-foreground shadow-gm-soft">
                  You can now ask your questions below.
                </div>
              </div>
            )}

            {showConversation &&
              chatMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-3 animate-float-up ${msg.role === "user" ? "flex-row-reverse" : ""}`}
                >
                  <div
                    className={`w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center text-xs font-bold ${
                      msg.role === "assistant"
                        ? "bg-secondary text-secondary-foreground shadow-gm-soft"
                        : "bg-gm-gradient text-primary-foreground shadow-gm"
                    }`}
                  >
                    {msg.role === "assistant" ? (
                      <Heart className="w-3.5 h-3.5" />
                    ) : (
                      <User className="w-3.5 h-3.5" />
                    )}
                  </div>
                  <div
                    className={`max-w-[85%] px-4 py-3 text-sm leading-relaxed ${
                      msg.role === "assistant"
                        ? "rounded-2xl rounded-tl-md bg-card border border-border/60 text-foreground shadow-gm-soft prose prose-sm prose-slate dark:prose-invert"
                        : "rounded-2xl rounded-tr-md bg-gm-gradient text-primary-foreground shadow-gm"
                    }`}
                  >
                    {msg.role === "assistant" ? (
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {msg.text}
                      </ReactMarkdown>
                    ) : (
                      <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                    )}
                  </div>
                </div>
              ))}

            {sending && (
              <div className="flex gap-3 animate-float-up">
                <div className="w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center bg-secondary text-secondary-foreground shadow-gm-soft">
                  <Heart className="w-3.5 h-3.5" />
                </div>
                <div className="rounded-2xl rounded-tl-md bg-card border border-border/60 px-4 py-3 text-sm text-muted-foreground">
                  Thinking…
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </div>
      </div>

      <div className="px-4 py-3 border-t border-border/60 bg-card flex-shrink-0">
        <div className="flex items-end gap-2 rounded-xl border border-border bg-background px-3 py-2 focus-within:border-primary/50 focus-within:shadow-gm transition-all">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              canAsk ? "Ask your question here…" : "Analysis must finish before you can ask a question."
            }
            rows={1}
            disabled={!canAsk}
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground resize-none outline-none min-h-[40px] max-h-[120px] py-2 disabled:opacity-60 disabled:cursor-not-allowed"
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || sending || !canAsk}
            className="w-9 h-9 rounded-lg bg-gm-gradient text-primary-foreground flex items-center justify-center flex-shrink-0 hover:scale-105 hover:shadow-gm-lg active:scale-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatPanel;
