import {
  FileText,
  CheckCircle2,
  HelpCircle,
  Sparkles,
  AlertCircle,
  ChevronRight,
  ImageIcon,
} from "lucide-react";
import { Loader2 } from "lucide-react";
import ImageWithLegends from "@/components/ImageWithLegends";
import type { ReportPipelineResultPartial } from "@/types/report";

interface ReportExplanationPanelProps {
  result: ReportPipelineResultPartial;
  isComplete?: boolean;
  /** Intégré dans le chat : pas de scroll propre, padding réduit */
  embedded?: boolean;
}

/** Affiche les 4 blocs du pipeline : extraction résumée, vulgarisation, validation, questions pour le médecin (en direct si stream) */
const ReportExplanationPanel = ({ result, isComplete = true, embedded = false }: ReportExplanationPanelProps) => {
  const { extraction, vulgarization, validationOk, questions, legendItems } = result;
  const hasVulgarization = vulgarization != null && vulgarization !== "";
  const hasQuestions = questions != null && questions.length > 0;
  const hasLegendItems = Array.isArray(legendItems) && legendItems.length > 0;
  const firstLegendItem = hasLegendItems ? legendItems[0] : null;

  const blocks = hasVulgarization ? vulgarization.split(/\s*---\s*/).filter(Boolean) : [];
  const blockLabels = [
    "Ce que montrent les images",
    "Ce que le médecin en conclut",
    "Ce que vous pouvez faire",
  ];

  /** Enlève en début de bloc un éventuel doublon du titre (ex. "Ce que le médecin en conclut :") pour éviter la répétition avec le libellé affiché au-dessus. */
  const stripLabelFromBlock = (text: string, label: string) => {
    let t = text.trim();
    if (!label) return t;
    const prefixes = [label + " :", label + ":", label + " : ", label + "\n", label];
    for (const p of prefixes) {
      if (t.startsWith(p)) return t.slice(p.length).trim();
    }
    // Première ligne = libellé seul (avec ou sans deux-points)
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

      {/* Les images légendées ne sont affichées qu’à gauche (onglet Images). */}
      {hasLegendItems && firstLegendItem && (
        <div className="rounded-xl border border-border/60 bg-card shadow-gm-soft overflow-hidden">
          <div className="px-4 py-3 border-b border-border/40 flex items-center gap-2">
            <ImageIcon className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Graphique légendé
            </span>
          </div>
          <div className="p-4">
            {firstLegendItem.legendes && firstLegendItem.legendes.length > 0 ? (
              <ImageWithLegends
                imageUrl={firstLegendItem.imageUrl}
                legendes={firstLegendItem.legendes}
                alt="Image d'imagerie légendée"
                className="max-h-[min(50vh,400px)]"
              />
            ) : (
              <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                Légendes en cours de génération…
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2) Vulgarisation (3 blocs) — affichée uniquement après réponses au contexte et analyse */}
      {hasVulgarization && (
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
        </div>
        <div className="p-4 space-y-4">
          {blocks.length > 0 ? (
            blocks.map((block, i) => (
              <div key={i}>
                <p className="text-xs font-semibold text-muted-foreground mb-1">
                  {blockLabels[i] || `Bloc ${i + 1}`}
                </p>
                <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                  {stripLabelFromBlock(block, blockLabels[i] ?? "")}
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
      )}

      {/* 3) Questions pour le médecin — affichées après analyse (ou "en cours" pendant le stream) */}
      {(hasQuestions || (hasVulgarization && !isComplete)) && (
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
