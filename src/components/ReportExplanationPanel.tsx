import {
  FileText,
  CheckCircle2,
  HelpCircle,
  Sparkles,
  AlertCircle,
  ChevronRight,
} from "lucide-react";
import { Loader2 } from "lucide-react";
import type { ReportPipelineResultPartial } from "@/types/report";

interface ReportExplanationPanelProps {
  result: ReportPipelineResultPartial;
  isComplete?: boolean;
  /** Intégré dans le chat : pas de scroll propre, padding réduit */
  embedded?: boolean;
}

/** Affiche les 4 blocs du pipeline : extraction résumée, vulgarisation, validation, questions pour le médecin (en direct si stream) */
const ReportExplanationPanel = ({ result, isComplete = true, embedded = false }: ReportExplanationPanelProps) => {
  const { extraction, vulgarization, validationOk, questions } = result;
  const hasVulgarization = vulgarization != null && vulgarization !== "";
  const hasQuestions = questions != null && questions.length > 0;

  const blocks = hasVulgarization ? vulgarization.split(/\s*---\s*/).filter(Boolean) : [];
  const blockLabels = [
    "Ce que montrent les images",
    "Ce que le médecin en conclut",
    "Ce que vous pouvez faire",
  ];

  return (
    <div
      className={`flex flex-col gap-4 ${embedded ? "p-4 pt-2 pb-2 overflow-visible" : "p-4 pb-0 overflow-y-auto"}`}
    >
      {/* Ligne du temps parcours */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
        <span className="font-medium text-foreground">Rapport reçu</span>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="font-medium text-primary">Comprendre et préparer</span>
        <ChevronRight className="w-3.5 h-3.5" />
        <span>Prochain rendez-vous</span>
      </div>

      {/* 1) Extraction résumée */}
      {extraction && (extraction.localisation || extraction.type_examen || extraction.conclusion_rapport) && (
        <div className="rounded-xl border border-border/60 bg-card shadow-gm-soft overflow-hidden">
          <div className="px-4 py-3 border-b border-border/40 flex items-center gap-2">
            <FileText className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Résumé du rapport
            </span>
          </div>
          <div className="p-4 space-y-2 text-sm text-foreground">
            {extraction.type_examen && (
              <p>
                <span className="text-muted-foreground">Examen : </span>
                {extraction.type_examen}
              </p>
            )}
            {extraction.localisation && (
              <p>
                <span className="text-muted-foreground">Localisation : </span>
                {extraction.localisation}
              </p>
            )}
            {extraction.conclusion_rapport && (
              <p className="leading-relaxed">{extraction.conclusion_rapport}</p>
            )}
          </div>
        </div>
      )}

      {/* 2) Vulgarisation (3 blocs) — affichage en direct ou « en cours » */}
      <div className="rounded-xl border border-border/60 bg-card shadow-gm-soft overflow-hidden">
        <div className="px-4 py-3 border-b border-border/40 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Explication simple
            </span>
          </div>
          {isComplete && validationOk === true && (
            <span className="flex items-center gap-1.5 text-xs font-medium text-primary">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Explication vérifiée
            </span>
          )}
          {isComplete && validationOk === false && (
            <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <AlertCircle className="w-3.5 h-3.5" />
              À confirmer avec votre médecin
            </span>
          )}
          {!hasVulgarization && (
            <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              En cours…
            </span>
          )}
        </div>
        <div className="p-4 space-y-4">
          {!hasVulgarization ? (
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin shrink-0" />
              Explication en cours de rédaction…
            </p>
          ) : blocks.length > 0 ? (
            blocks.map((block, i) => (
              <div key={i}>
                <p className="text-xs font-semibold text-muted-foreground mb-1">
                  {blockLabels[i] || `Bloc ${i + 1}`}
                </p>
                <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                  {block.trim()}
                </p>
              </div>
            ))
          ) : (
            <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
              {vulgarization}
            </p>
          )}
        </div>
      </div>

      {/* 3) Questions pour le médecin */}
      {(hasQuestions || !isComplete) && (
        <div className="rounded-xl border border-primary/20 bg-secondary/30 shadow-gm-soft overflow-hidden">
          <div className="px-4 py-3 border-b border-border/40 flex items-center gap-2">
            <HelpCircle className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Questions à poser à votre médecin
            </span>
            {!hasQuestions && !isComplete && (
              <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground ml-auto">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                En cours…
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
