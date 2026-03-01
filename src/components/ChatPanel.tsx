import { useState, useRef, useEffect, useMemo } from "react";
import { Send, Heart, User } from "lucide-react";
import type { ReportPipelineResultPartial } from "@/types/report";

interface Message {
  id: string;
  role: "assistant" | "user";
  text: string;
}

const API_BASE = import.meta.env.VITE_API_URL || "";

const blockLabels = [
  "Ce que montrent les images",
  "Ce que le médecin en conclut",
  "Ce que vous pouvez faire",
];

function buildReportMessages(
  pipelineResult: ReportPipelineResultPartial | null,
  reportLoading: boolean
): Message[] {
  const out: Message[] = [];
  if (reportLoading && !pipelineResult?.extraction) {
    out.push({ id: "report-loading", role: "assistant", text: "J'analyse votre rapport, un instant…" });
    return out;
  }
  if (!pipelineResult?.extraction) {
    out.push({
      id: "init",
      role: "assistant",
      text: "Bonjour ! 👋 Chargez votre rapport PDF à gauche puis cliquez sur « Comprendre mon rapport ». L'analyse s'affichera ici, puis vous pourrez poser vos questions.",
    });
    return out;
  }
  const { extraction, vulgarization, validationOk, questions } = pipelineResult;
  const hasVulgarization = vulgarization != null && vulgarization !== "";
  const hasQuestions = questions != null && questions.length > 0;
  const isComplete = hasVulgarization && hasQuestions;

  const summaryLines: string[] = [];
  if (extraction.type_examen) summaryLines.push(`Examen : ${extraction.type_examen}`);
  if (extraction.localisation) summaryLines.push(`Localisation : ${extraction.localisation}`);
  if (extraction.conclusion_rapport) summaryLines.push(extraction.conclusion_rapport);
  if (summaryLines.length > 0) {
    out.push({
      id: "report-summary",
      role: "assistant",
      text: "Résumé du rapport\n\n" + summaryLines.join("\n\n"),
    });
  }

  if (!hasVulgarization) {
    out.push({
      id: "report-vulgarization",
      role: "assistant",
      text: "Explication simple\n\nExplication en cours de rédaction…",
    });
  } else {
    const blocks = vulgarization.split(/\s*---\s*/).filter(Boolean);
    const explication =
      blocks.length >= 3
        ? blocks.map((b, i) => `${blockLabels[i] ?? `Bloc ${i + 1}`}\n${b.trim()}`).join("\n\n")
        : vulgarization;
    const verified =
      validationOk === true
        ? "\n\n✓ Explication vérifiée."
        : validationOk === false
          ? "\n\nÀ confirmer avec votre médecin."
          : "";
    out.push({
      id: "report-vulgarization",
      role: "assistant",
      text: "Explication simple\n\n" + explication + verified,
    });
  }

  if (!hasQuestions) {
    out.push({
      id: "report-questions",
      role: "assistant",
      text: "Questions à poser à votre médecin\n\nQuestions en cours de préparation…",
    });
  } else {
    const list = (questions ?? []).map((q, i) => `${i + 1}. ${q}`).join("\n");
    out.push({
      id: "report-questions",
      role: "assistant",
      text: "Questions à poser à votre médecin\n\n" + list,
    });
  }

  if (isComplete) {
    out.push({
      id: "report-ready",
      role: "assistant",
      text: "Vous pouvez maintenant poser vos questions ci-dessous.",
    });
  }
  return out;
}

interface ChatPanelProps {
  pipelineResult: ReportPipelineResultPartial | null;
  reportLoading?: boolean;
}

const ChatPanel = ({ pipelineResult, reportLoading = false }: ChatPanelProps) => {
  const reportMessages = useMemo(
    () => buildReportMessages(pipelineResult, reportLoading),
    [pipelineResult, reportLoading]
  );
  const isReportComplete =
    !reportLoading &&
    !!pipelineResult?.extraction &&
    pipelineResult.vulgarization != null &&
    pipelineResult.questions != null;
  const canAsk = isReportComplete;

  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (pipelineResult === null) setChatMessages([]);
  }, [pipelineResult]);

  const allMessages = useMemo(
    () => [...reportMessages, ...chatMessages],
    [reportMessages, chatMessages]
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [allMessages, reportLoading]);

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

      const contextStr = pipelineResult?.extraction
        ? `Extraction : ${JSON.stringify(pipelineResult.extraction, null, 2)}\n\nVulgarisation : ${pipelineResult.vulgarization ?? ""}`
        : "";

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
        throw new Error(data.error || `Erreur ${res.status}`);
      }
      const data = await res.json();
      setChatMessages((prev) => [
        ...prev,
        { id: `a-${Date.now()}`, role: "assistant", text: data.reply || "Désolé, je n'ai pas pu répondre." },
      ]);
    } catch (e) {
      setChatMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: "assistant",
          text: e instanceof Error ? e.message : "Une erreur s'est produite. Réessayez.",
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

  return (
    <div className="flex flex-col h-full bg-card">
      <div className="px-5 py-4 border-b border-border/60 bg-gm-gradient relative overflow-hidden">
        <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-primary-foreground/10 blur-xl" />
        <div className="absolute -bottom-4 -left-4 w-16 h-16 rounded-full bg-primary-foreground/5 blur-lg" />
        <div className="relative">
          <h2 className="text-sm font-display font-semibold text-primary-foreground tracking-wide flex items-center gap-2">
            <Heart className="w-4 h-4" />
            Votre assistant santé
          </h2>
          <p className="text-xs text-primary-foreground/70 mt-1">
            {canAsk ? "Posez vos questions, je vous explique simplement." : "L'analyse du rapport s'affiche ici."}
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4 bg-gm-gradient-soft">
        {allMessages.map((msg) => (
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
              {msg.role === "assistant" ? <Heart className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
            </div>
            <div
              className={`max-w-[85%] px-4 py-3 text-sm leading-relaxed ${
                msg.role === "assistant"
                  ? "rounded-2xl rounded-tl-md bg-card border border-border/60 text-foreground shadow-gm-soft"
                  : "rounded-2xl rounded-tr-md bg-gm-gradient text-primary-foreground shadow-gm"
              }`}
            >
              <p className="whitespace-pre-wrap break-words">{msg.text}</p>
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex gap-3 animate-float-up">
            <div className="w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center bg-secondary text-secondary-foreground shadow-gm-soft">
              <Heart className="w-3.5 h-3.5" />
            </div>
            <div className="rounded-2xl rounded-tl-md bg-card border border-border/60 px-4 py-3 text-sm text-muted-foreground">
              Réflexion…
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="px-4 py-3 border-t border-border/60 bg-card">
        <div className="flex items-end gap-2 rounded-xl border border-border bg-background px-3 py-2 focus-within:border-primary/50 focus-within:shadow-gm transition-all">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={canAsk ? "Posez votre question ici…" : "L'analyse doit se terminer avant de poser une question."}
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
