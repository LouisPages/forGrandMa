import { useState, useRef } from "react";
import { FileText, Upload, Sparkles, Camera, ImagePlus, X } from "lucide-react";
import { extractTextFromPdf } from "@/lib/pdfText";

interface PdfViewerProps {
  onUnderstandReport?: (reportText: string) => void;
  /** Images d'imagerie (radio/IRM) ajoutées en plus du rapport — pour les légendes. Appelé avec les data URLs. */
  onLegendImages?: (dataUrls: string[]) => void;
  /** Source image du rapport quand le document est une photo (pas un PDF). Permet au parent d’appeler l’API légendes. */
  onReportImageSource?: (dataUrl: string | null) => void;
  isSubmitting?: boolean;
}

const API_BASE = import.meta.env.VITE_API_URL || "";

const PdfViewer = ({ onUnderstandReport, onLegendImages, onReportImageSource, isSubmitting = false }: PdfViewerProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [legendDataUrls, setLegendDataUrls] = useState<string[]>([]);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const legendInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    setExtractError(null);
    if (selected) {
      if (selected.type === "application/pdf") {
        setFile(selected);
        setPdfUrl(URL.createObjectURL(selected));
        setImageUrl(null);
        onReportImageSource?.(null);
      } else if (selected.type.startsWith("image/")) {
        setFile(selected);
        setImageUrl(URL.createObjectURL(selected));
        setPdfUrl(null);
        const reader = new FileReader();
        reader.onload = () => onReportImageSource?.(reader.result as string);
        reader.readAsDataURL(selected);
      }
    }
  };

  const readFilesAsDataUrls = (files: FileList | null): Promise<string[]> => {
    if (!files || files.length === 0) return Promise.resolve([]);
    return Promise.all(
      Array.from(files).map(
        (f) =>
          new Promise<string>((resolve, reject) => {
            const r = new FileReader();
            r.onload = () => resolve(r.result as string);
            r.onerror = () => reject(new Error("Lecture impossible"));
            r.readAsDataURL(f);
          })
      )
    );
  };

  const handleLegendImagesChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    e.target.value = "";
    if (!files?.length) return;
    const urls = await readFilesAsDataUrls(files);
    setLegendDataUrls((prev) => {
      const next = [...prev, ...urls];
      onLegendImages?.(next);
      return next;
    });
  };

  const removeLegendImage = (index: number) => {
    setLegendDataUrls((prev) => {
      const next = prev.filter((_, i) => i !== index);
      onLegendImages?.(next);
      return next;
    });
  };

  const handleUnderstandReport = async () => {
    if (!file || !onUnderstandReport) return;
    setExtractError(null);
    setExtracting(true);
    try {
      let text = "";
      if (file.type === "application/pdf") {
        text = await extractTextFromPdf(file);
      } else if (file.type.startsWith("image/")) {
        // OCR via Backend
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve) => {
          reader.onload = () => resolve(reader.result as string);
        });
        reader.readAsDataURL(file);
        const base64 = await base64Promise;

        const res = await fetch(`${API_BASE}/api/report/ocr`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: base64 }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Erreur lors de l'OCR.");
        }
        const data = await res.json();
        text = data.text;
      }

      if (!text || !text.trim()) {
        setExtractError("Aucun texte n'a pu être extrait de ce document.");
        return;
      }
      onUnderstandReport(text);
    } catch (e) {
      setExtractError(
        e instanceof Error ? e.message : "Impossible d'analyser le document."
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
          {imageUrl ? <Camera className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
          <span className="font-medium truncate max-w-[150px]">
            {file ? file.name : "Aucun document"}
          </span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => imageInputRef.current?.click()}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg bg-secondary text-secondary-foreground hover:opacity-90 transition-opacity border border-border"
          >
            <Camera className="w-3.5 h-3.5" />
            Photo rapport
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg bg-gm-gradient text-primary-foreground hover:opacity-90 transition-opacity shadow-gm"
          >
            <Upload className="w-3.5 h-3.5" />
            PDF rapport
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          onChange={handleFileChange}
          className="hidden"
        />
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      {/* Content (scrollable) + bouton fixe en bas */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <div className="flex-1 min-h-0 overflow-auto bg-gm-gradient-soft">
          {pdfUrl ? (
            <iframe
              src={pdfUrl}
              className="w-full h-full min-h-[200px] border-0"
              title="PDF Viewer"
            />
          ) : imageUrl ? (
            <div className="w-full h-full flex items-center justify-center p-4">
              <img src={imageUrl} alt="Rapport" className="max-w-full max-h-full object-contain rounded-lg shadow-lg" />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground p-4">
              <div className="w-20 h-20 rounded-2xl bg-secondary flex items-center justify-center shadow-gm-soft">
                <FileText className="w-10 h-10 text-accent" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-foreground">Votre rapport (PDF ou photo du rapport)</p>
                <p className="text-xs mt-1">Puis ajoutez éventuellement des images radio/IRM</p>
              </div>
              <div className="flex flex-col gap-2 w-full max-w-[200px]">
                <button
                  onClick={() => imageInputRef.current?.click()}
                  className="px-5 py-2.5 text-sm font-medium rounded-xl bg-secondary text-secondary-foreground hover:opacity-90 transition-opacity border border-border"
                >
                  <Camera className="w-4 h-4 inline mr-2" />
                  Photo du rapport
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-5 py-2.5 text-sm font-medium rounded-xl bg-gm-gradient text-primary-foreground hover:opacity-90 transition-opacity shadow-gm"
                >
                  <Upload className="w-4 h-4 inline mr-2" />
                  PDF du rapport
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Images d'imagerie — fixe en bas, toujours visible */}
        <div className="flex-shrink-0 border-t border-border/60 p-3 bg-card/80">
          <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
            <ImagePlus className="w-3.5 h-3.5" />
            Images d'imagerie (radio, IRM…) — optionnel
          </p>
          <div className="flex flex-wrap gap-2 items-start">
            {legendDataUrls.map((url, i) => (
              <div key={i} className="relative group">
                <img src={url} alt={`Imagerie ${i + 1}`} className="w-16 h-16 object-cover rounded-lg border border-border" />
                <button type="button" onClick={() => removeLegendImage(i)} className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-80 group-hover:opacity-100" aria-label="Retirer">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => legendInputRef.current?.click()}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-border text-sm font-medium text-muted-foreground hover:bg-secondary/50 hover:text-foreground transition-colors"
              title="Ajouter des images radio/IRM à légender"
            >
              <ImagePlus className="w-4 h-4" />
              Ajouter des images (radio, IRM)
            </button>
          </div>
          <input ref={legendInputRef} type="file" accept="image/*" multiple onChange={handleLegendImagesChange} className="hidden" />
        </div>

        {file && (
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
                ? (imageUrl ? "Lecture du rapport (IA)…" : "Extraction du texte…")
                : isSubmitting
                  ? "Analyse en cours…"
                  : "Comprendre ce rapport"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default PdfViewer;
