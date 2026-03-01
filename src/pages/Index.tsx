import { useState, useCallback } from "react";
import GrandMaLogo from "@/components/GrandMaLogo";
import PdfViewer from "@/components/PdfViewer";
import ChatPanel from "@/components/ChatPanel";
import type { ReportPipelineResult, ReportPipelineResultPartial } from "@/types/report";

const API_BASE = import.meta.env.VITE_API_URL || "";

/** Parse le flux SSE (lignes event: / data:) et appelle onEvent pour chaque message. */
async function consumeSSE(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  onEvent: (event: string, data: object) => void
) {
  const dec = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += dec.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";
    for (const part of parts) {
      let event = "message";
      let dataStr = "";
      for (const line of part.split("\n")) {
        if (line.startsWith("event: ")) event = line.slice(7).trim();
        else if (line.startsWith("data: ")) dataStr = line.slice(6);
      }
      if (dataStr) {
        try {
          onEvent(event, JSON.parse(dataStr));
        } catch {
          // ignore parse errors
        }
      }
    }
  }
}

const Index = () => {
  const [pipelineResult, setPipelineResult] = useState<ReportPipelineResultPartial | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUnderstandReport = useCallback(async (reportText: string) => {
    setError(null);
    setLoading(true);
    setPipelineResult(null);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 180_000); // 3 min (Ollama peut être lent)
    try {
      const res = await fetch(`${API_BASE}/api/report/understand-stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportText: reportText.trim() }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Error ${res.status}`);
      }
      const reader = res.body?.getReader();
      if (!reader) throw new Error("Stream non disponible");
      await consumeSSE(reader, (event, data) => {
        if (event === "error") {
          setError((data as { error?: string }).error ?? "Erreur inconnue");
          return;
        }
        if (event === "done") {
          setPipelineResult(data as ReportPipelineResult);
          setLoading(false);
          return;
        }
        setPipelineResult((prev) => ({ ...prev, ...data }));
      });
      setLoading(false);
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") {
        setError(
          "Analysis took too long. Check your GOOGLE_API_KEY (or other API) and that the backend server is running."
        );
      } else {
        setError(e instanceof Error ? e.message : "Erreur lors du traitement.");
      }
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
    }
  }, []);

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="flex items-center justify-between px-5 py-3 bg-card border-b border-border/60 glass-white relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gm-gradient flex items-center justify-center text-primary-foreground shadow-gm animate-gradient">
            <GrandMaLogo className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-base font-display font-bold text-foreground tracking-tight leading-tight">
              For <span className="text-gm-gradient">GrandMa</span>
            </h1>
            <p className="text-[11px] text-muted-foreground font-medium tracking-wide">Votre rapport, expliqué simplement</p>
          </div>
        </div>
      </header>

      {/* Main layout: 50% PDF + paste | 50% Explanation + Chat */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-2 min-h-0">
        <div className="overflow-hidden border-r border-border/40">
          <PdfViewer
            onUnderstandReport={handleUnderstandReport}
            isSubmitting={loading}
          />
        </div>
        <div className="overflow-hidden flex flex-col min-h-0">
          {error && (
            <div className="px-4 py-2 bg-destructive/10 text-destructive text-sm border-b border-border/60 flex-shrink-0">
              {error}
            </div>
          )}
          <div className="flex-1 min-h-0 overflow-hidden">
            <ChatPanel pipelineResult={pipelineResult} reportLoading={loading} />
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;
