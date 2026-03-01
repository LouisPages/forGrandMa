import { useState, useCallback } from "react";
import GrandMaLogo from "@/components/GrandMaLogo";
import LeftPanel from "@/components/LeftPanel";
import PdfViewer from "@/components/PdfViewer";
import ChatPanel from "@/components/ChatPanel";
import type {
  ReportPipelineResult,
  ReportPipelineResultPartial,
  LegendItem,
  ExtractedFacts,
  ContextQuestion,
  PatientContext,
} from "@/types/report";

const API_BASE = import.meta.env.VITE_API_URL || "";

/** Clé connues d'ExtractedFacts pour éviter toute référence circulaire à la sérialisation. */
const EXTRACTION_KEYS: (keyof ExtractedFacts)[] = [
  "localisation",
  "type_examen",
  "faits_principaux",
  "termes_techniques",
  "conclusion_rapport",
  "niveau_urgence",
];

/** Retourne une copie sérialisable de l'extraction (évite "cyclic object value"). */
function getSafeExtraction(extraction: unknown): ExtractedFacts {
  if (!extraction || typeof extraction !== "object") {
    return {};
  }
  const raw = extraction as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of EXTRACTION_KEYS) {
    if (Object.prototype.hasOwnProperty.call(raw, key)) {
      const v = raw[key];
      if (Array.isArray(v)) out[key] = [...v];
      else if (v !== null && v !== undefined) out[key] = v;
    }
  }
  return out as ExtractedFacts;
}

/** Contexte patient en objet plat (évite références circulaires). */
function getSafePatientContext(ctx: PatientContext | undefined): PatientContext {
  if (!ctx || typeof ctx !== "object") return {};
  return Object.fromEntries(
    Object.entries(ctx).filter(
      (entry): entry is [string, string] =>
        typeof entry[0] === "string" && typeof entry[1] === "string"
    )
  );
}

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
  const [contextQuestions, setContextQuestions] = useState<ContextQuestion[] | null>(null);
  const [patientContext, setPatientContext] = useState<PatientContext>({});
  /** Images d'imagerie (radio/IRM) ajoutées en plus du rapport — pour les légendes */
  const [legendImageDataUrls, setLegendImageDataUrls] = useState<string[]>([]);
  /** Image du rapport quand le document est une photo (pas un PDF) — utilisée pour les légendes */
  const [reportImageDataUrl, setReportImageDataUrl] = useState<string | null>(null);

  /** Phase 1 : extraction seule pour obtenir le type d'examen et les questions de contexte */
  const handleUnderstandReport = useCallback(async (reportText: string) => {
    setError(null);
    setLoading(true);
    setPipelineResult(null);
    setContextQuestions(null);
    setPatientContext({});
    try {
      const res = await fetch(`${API_BASE}/api/report/extract`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportText: reportText.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Error ${res.status}`);
      }
      const data = await res.json();
      setPipelineResult({ extraction: data.extraction });
      setContextQuestions(data.contextQuestions ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error during extraction.");
    } finally {
      setLoading(false);
    }
  }, []);

  /** Phase 2 : lancer vulgarisation + questions avec le contexte patient. Si contextOverride est fourni (ex. après modification des réglages), on l'utilise pour la requête. */
  const handleLaunchAnalysisWithContext = useCallback(
    async (contextOverride?: PatientContext) => {
      if (!pipelineResult?.extraction) return;
      const contextToUse = contextOverride ?? patientContext;
      setError(null);
      setLoading(true);
      if (contextOverride != null) setPatientContext(contextOverride);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 180_000);
      try {
        const extractionPlain = getSafeExtraction(pipelineResult.extraction);
        const res = await fetch(`${API_BASE}/api/report/understand-stream`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            extraction: extractionPlain,
            patientContext: getSafePatientContext(contextToUse),
          }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `Error ${res.status}`);
        }
        const reader = res.body?.getReader();
        if (!reader) throw new Error("Stream non disponible");
        /** Seules les images d'imagerie optionnelles (radio, IRM…) sont légendées ; pas la photo du rapport. */
        const allImagesForLegends = legendImageDataUrls ?? [];
        const hasImagesForStream = allImagesForLegends.length > 0;
        await consumeSSE(reader, (event, data) => {
          if (event === "error") {
            setError((data as { error?: string }).error ?? "Unknown error");
            return;
          }
          if (event === "done") {
            const fullResult = data as ReportPipelineResult;
            const hasImages = allImagesForLegends.length > 0;
            setPipelineResult({
              ...fullResult,
              legendItems: hasImages ? allImagesForLegends.map((url) => ({ imageUrl: url, legendes: undefined })) : undefined,
              vulgarization: hasImages ? undefined : fullResult.vulgarization,
            });
            setLoading(false);
            if (hasImages && fullResult.extraction) {
              const extractionPlain = getSafeExtraction(fullResult.extraction);
              const firstVulgarization = fullResult.vulgarization ?? "";
              Promise.all(
                allImagesForLegends.map((url) =>
                  fetch(`${API_BASE}/api/report/legendes`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ image: url, extraction: extractionPlain }),
                  })
                    .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Legendes failed"))))
                    .then((data: { legendes: LegendItem["legendes"] }) => ({ url, legendes: data.legendes }))
                    .catch(() => ({ url, legendes: [] }))
                )
              ).then((results) => {
                const legendItemsWithLegendes = allImagesForLegends.map((url, i) => ({
                  imageUrl: url,
                  legendes: results[i]?.legendes ?? [],
                }));
                const allLabels = legendItemsWithLegendes.flatMap((it) => it.legendes?.map((l) => l.label).filter(Boolean) ?? []);
                setPipelineResult((prev) => (prev ? { ...prev, legendItems: legendItemsWithLegendes } : prev));
                const applyVulgarization = (text: string) => {
                  setPipelineResult((prev) => (prev ? { ...prev, vulgarization: text } : prev));
                };
                if (allLabels.length > 0 && firstVulgarization) {
                  fetch(`${API_BASE}/api/report/adapt-vulgarization`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ vulgarization: firstVulgarization, legendLabels: allLabels }),
                  })
                    .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Adapt failed"))))
                    .then((data: { vulgarization: string }) => {
                      const adapted = data?.vulgarization?.trim();
                      applyVulgarization(adapted || firstVulgarization);
                    })
                    .catch(() => applyVulgarization(firstVulgarization));
                } else {
                  applyVulgarization(firstVulgarization);
                }
              });
            }
            return;
          }
          setPipelineResult((prev) => ({
            ...prev,
            ...data,
            ...(hasImagesForStream ? { vulgarization: undefined } : {}),
          }));
        });
      } catch (e) {
      if (e instanceof Error && e.name === "AbortError") {
        setError("Analysis took too long. Please try again.");
      } else {
        setError(e instanceof Error ? e.message : "Erreur lors du traitement.");
      }
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
    }
    },
    [pipelineResult?.extraction, patientContext, legendImageDataUrls, reportImageDataUrl]
  );

  const handlePatientContextChange = useCallback((id: string, value: string) => {
    setPatientContext((prev) => ({ ...prev, [id]: value }));
  }, []);
  const setPatientContextBulk = useCallback((ctx: PatientContext) => {
    setPatientContext(ctx);
  }, []);
  const clearPatientContext = useCallback(() => {
    setPatientContext({});
  }, []);

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="flex items-center justify-between px-5 py-3 bg-card border-b border-border/60 glass-white relative z-10">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-gm-gradient flex items-center justify-center text-primary-foreground shadow-gm animate-gradient">
            <GrandMaLogo className="w-9 h-9" />
          </div>
          <div>
            <h1 className="text-lg font-display font-bold text-foreground tracking-tight leading-tight">
              For <span className="text-gm-gradient">GrandMa</span>
            </h1>
            <p className="text-xs text-muted-foreground font-medium tracking-wide">Your medical report, explained simply</p>
          </div>
        </div>
      </header>

      {/* Main layout: 50% PDF + paste | 50% Explanation + Chat */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-2 min-h-0">
        <div className="overflow-hidden border-r border-border/40">
          <LeftPanel legendItems={pipelineResult?.legendItems}>
            <PdfViewer
              onUnderstandReport={handleUnderstandReport}
              onLegendImages={setLegendImageDataUrls}
              onReportImageSource={setReportImageDataUrl}
              isSubmitting={loading}
            />
          </LeftPanel>
        </div>
        <div className="overflow-hidden flex flex-col min-h-0">
          {error && (
            <div className="px-4 py-2 bg-destructive/10 text-destructive text-sm border-b border-border/60 flex-shrink-0">
              {error}
            </div>
          )}
          <div className="flex-1 min-h-0 overflow-hidden">
            <ChatPanel
            pipelineResult={pipelineResult}
            reportLoading={loading}
            contextQuestions={contextQuestions}
            patientContext={patientContext}
            onPatientContextChange={handlePatientContextChange}
            onLaunchAnalysisWithContext={handleLaunchAnalysisWithContext}
            setPatientContextBulk={setPatientContextBulk}
            clearPatientContext={clearPatientContext}
          />
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;
