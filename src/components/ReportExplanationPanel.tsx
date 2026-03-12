import {
  CheckCircle2,
  HelpCircle,
  Sparkles,
  AlertCircle,
  ChevronRight,
} from "lucide-react";
import { Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ReportPipelineResultPartial } from "@/types/report";

interface ReportExplanationPanelProps {
  result: ReportPipelineResultPartial;
  isComplete?: boolean;
  /** Embedded in chat: no own scroll, reduced padding */
  embedded?: boolean;
  /** true as soon as patient context has been sent and we're waiting for simplification (immediate display of "Simple explanation" block in loading) */
  explanationLoading?: boolean;
}

/** Displays pipeline blocks: simplification, validation, questions for the doctor (live if stream) */
const ReportExplanationPanel = ({ result, isComplete = true, embedded = false, explanationLoading = false }: ReportExplanationPanelProps) => {
  const { extraction, vulgarization, validationOk, questions, legendItems } = result;
  const hasVulgarization = vulgarization != null && vulgarization !== "";
  const hasQuestions = questions != null && questions.length > 0;
  const isAdaptingExplanation = (legendItems?.length ?? 0) > 0 && !hasVulgarization;
  const showExplanationBlock = hasVulgarization || isAdaptingExplanation || explanationLoading;

  const blocks = hasVulgarization ? vulgarization.split(/\s*---\s*/).filter(Boolean) : [];
  const blockLabels = [
    "What the images show",
    "What the doctor concludes",
    "What you can do",
  ];

  /** Removes any duplicate title at the beginning of a block (e.g. "What the doctor concludes:") to avoid repetition with the label displayed above. */
  const stripLabelFromBlock = (text: string, label: string) => {
    let t = text.trim();
    if (!label) return t;
    const prefixes = [label + " :", label + ":", label + " : ", label + "\n", label];
    for (const p of prefixes) {
      if (t.startsWith(p)) return t.slice(p.length).trim();
    }
    // First line = label only (with or without colon)
    const firstLine = t.split("\n")[0].trim();
    if (firstLine === label || firstLine === label + " :" || firstLine === label + ":") {
      return t.slice(firstLine.length).trimStart();
    }
    return t;
  };

  return (
    <div
      className={`flex flex-col gap-4 ${embedded ? "p-4 pt-2 pb-2 overflow-visible" : "p-4 pb-0 overflow-y-auto"}`}
    >
      {/* Journey timeline */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
        <span className="font-medium text-foreground">Report received</span>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="font-medium text-primary">Understand and prepare</span>
        <ChevronRight className="w-3.5 h-3.5" />
        <span>Next appointment</span>
      </div>

      {/* 1) Simplification (3 blocks) — displayed upon context submission (loading), then after legend adaptation or analysis */}
      {showExplanationBlock && (
      <div className="rounded-xl border border-border/60 bg-card shadow-gm-soft overflow-hidden">
        <div className="px-4 py-3 border-b border-border/40 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Simple explanation
            </span>
          </div>
          {isComplete && validationOk === true && (
            <span className="flex items-center gap-1.5 text-xs font-medium text-primary">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Explanation verified
            </span>
          )}
          {isComplete && validationOk === false && (
            <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <AlertCircle className="w-3.5 h-3.5" />
              To confirm with your doctor
            </span>
          )}
        </div>
        <div className="p-4 space-y-4">
          {explanationLoading && !hasVulgarization ? (
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin shrink-0" />
              <span>Preparing the simple explanation…</span>
            </div>
          ) : isAdaptingExplanation ? (
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin shrink-0" />
              <span>Preparing the explanation from your images and labels…</span>
            </div>
          ) : blocks.length > 0 ? (
            blocks.map((block, i) => (
              <div key={i}>
                <p className="text-xs font-semibold text-muted-foreground mb-1">
                  {blockLabels[i] || `Block ${i + 1}`}
                </p>
                <div className="text-sm leading-relaxed text-foreground prose prose-sm prose-slate dark:prose-invert max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {stripLabelFromBlock(block, blockLabels[i] ?? "")}
                  </ReactMarkdown>
                </div>
              </div>
            ))
          ) : (
            <div className="text-sm leading-relaxed text-foreground prose prose-sm prose-slate dark:prose-invert max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {vulgarization || ""}
              </ReactMarkdown>
            </div>
          )}
        </div>
      </div>
      )}

      {/* 3) Questions for the doctor — displayed after analysis (or "in progress" during stream) */}
      {(hasQuestions || (hasVulgarization && !isComplete)) && (
        <div className="rounded-xl border border-primary/20 bg-secondary/30 shadow-gm-soft overflow-hidden">
          <div className="px-4 py-3 border-b border-border/40 flex items-center gap-2">
            <HelpCircle className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Questions to ask your doctor
            </span>
            {!hasQuestions && !isComplete && (
              <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground ml-auto">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                In progress…
              </span>
            )}
          </div>
          <ul className="p-4 space-y-2">
            {hasQuestions
              ? (questions ?? []).map((q, i) => (
                  <li key={i} className="flex gap-2 text-sm text-foreground">
                    <span className="text-primary font-medium shrink-0">{i + 1}.</span>
                    <span>{q}</span>
                  </li>
                ))
              : (
                  <li className="text-sm text-muted-foreground flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                    Questions being prepared…
                  </li>
                )}
          </ul>
        </div>
      )}
    </div>
  );
};

export default ReportExplanationPanel;
