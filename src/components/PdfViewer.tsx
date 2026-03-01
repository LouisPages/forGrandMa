import { useState, useRef } from "react";
import { FileText, Upload, Sparkles } from "lucide-react";
import { extractTextFromPdf } from "@/lib/pdfText";

interface PdfViewerProps {
  onUnderstandReport?: (reportText: string) => void;
  isSubmitting?: boolean;
}

const PdfViewer = ({ onUnderstandReport, isSubmitting = false }: PdfViewerProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    setExtractError(null);
    if (selected && selected.type === "application/pdf") {
      setFile(selected);
      setPdfUrl(URL.createObjectURL(selected));
    }
  };

  const handleUnderstandReport = async () => {
    if (!file || !onUnderstandReport) return;
    setExtractError(null);
    setExtracting(true);
    try {
      const text = await extractTextFromPdf(file);
      if (!text.trim()) {
        setExtractError("Aucun texte extrait de ce PDF (image scannée ?).");
        return;
      }
      onUnderstandReport(text);
    } catch (e) {
      setExtractError(
        e instanceof Error ? e.message : "Impossible d'extraire le texte du PDF."
      );
    } finally {
      setExtracting(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-card">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <FileText className="w-4 h-4" />
          <span className="font-medium truncate max-w-[200px]">
            {file ? file.name : "Aucun document"}
          </span>
        </div>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg bg-gm-gradient text-primary-foreground hover:opacity-90 transition-opacity shadow-gm"
        >
          <Upload className="w-3.5 h-3.5" />
          Charger un PDF
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      {/* PDF Content (scrollable) + bouton fixe en bas */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <div className="flex-1 min-h-0 overflow-auto bg-gm-gradient-soft">
          {pdfUrl ? (
            <iframe
              src={pdfUrl}
              className="w-full h-full min-h-[200px] border-0"
              title="PDF Viewer"
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground p-4">
              <div className="w-20 h-20 rounded-2xl bg-secondary flex items-center justify-center shadow-gm-soft">
                <FileText className="w-10 h-10 text-accent" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-foreground">Chargez votre rapport médical</p>
                <p className="text-xs mt-1">Format PDF accepté</p>
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="mt-2 px-5 py-2.5 text-sm font-medium rounded-xl bg-gm-gradient text-primary-foreground hover:opacity-90 transition-opacity shadow-gm animate-float-up"
              >
                <Upload className="w-4 h-4 inline mr-2" />
                Sélectionner un fichier
              </button>
            </div>
          )}
        </div>
        {/* Bouton fixe en bas à gauche, visible dès qu’un PDF est chargé */}
        {pdfUrl && (
          <div className="flex-shrink-0 border-t border-border/60 p-4 bg-card">
            {extractError && (
              <p className="text-sm text-destructive mb-3">{extractError}</p>
            )}
            <button
              onClick={handleUnderstandReport}
              disabled={isSubmitting || extracting}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gm-gradient text-primary-foreground font-semibold text-sm shadow-gm hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
            >
              <Sparkles className="w-4 h-4" />
              {extracting
                ? "Extraction du texte…"
                : isSubmitting
                  ? "Analyse en cours…"
                  : "Comprendre mon rapport"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default PdfViewer;
