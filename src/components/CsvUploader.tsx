import { useCallback, useRef, useState } from "react";
import { Upload, FileText, X } from "lucide-react";
import { parseCSV } from "@/lib/npd-engine";

interface CsvUploaderProps {
  onDataLoaded: (rows: Record<string, string>[], fileName: string) => void;
}

export default function CsvUploader({ onDataLoaded }: CsvUploaderProps) {
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [preview, setPreview] = useState<Record<string, string>[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        const rows = parseCSV(text);
        setFileName(file.name);
        setPreview(rows.slice(0, 5));
        onDataLoaded(rows, file.name);
      };
      reader.readAsText(file);
    },
    [onDataLoaded]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file && file.name.endsWith(".csv")) processFile(file);
    },
    [processFile]
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const clear = () => {
    setFileName(null);
    setPreview([]);
    if (inputRef.current) inputRef.current.value = "";
  };

  if (fileName && preview.length > 0) {
    const headers = Object.keys(preview[0]);
    return (
      <div className="rounded-xl border border-border bg-card overflow-hidden animate-fade-in-up">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-muted/50">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">{fileName}</span>
            <span className="text-xs text-muted-foreground">({preview.length} rows shown)</span>
          </div>
          <button onClick={clear} className="p-1 rounded hover:bg-muted transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                {headers.slice(0, 6).map((h) => (
                  <th key={h} className="px-4 py-2 text-left font-medium text-muted-foreground whitespace-nowrap">
                    {h}
                  </th>
                ))}
                {headers.length > 6 && (
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">+{headers.length - 6} more</th>
                )}
              </tr>
            </thead>
            <tbody>
              {preview.map((row, i) => (
                <tr key={i} className="border-b border-border/50 last:border-0">
                  {headers.slice(0, 6).map((h) => (
                    <td key={h} className="px-4 py-2 text-foreground/80 max-w-[200px] truncate">
                      {row[h]}
                    </td>
                  ))}
                  {headers.length > 6 && <td className="px-4 py-2 text-muted-foreground">…</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={`cursor-pointer rounded-xl border-2 border-dashed p-10 text-center transition-all duration-200 ${
        dragOver ? "border-primary bg-primary/5 scale-[1.01]" : "border-border hover:border-muted-foreground/40 bg-card"
      }`}
    >
      <input ref={inputRef} type="file" accept=".csv" className="hidden" onChange={handleFileChange} />
      <Upload className="w-8 h-8 mx-auto mb-3 text-muted-foreground" />
      <p className="font-display font-semibold text-foreground">Drop your CSV here</p>
      <p className="text-sm text-muted-foreground mt-1">or click to browse · .csv files only</p>
    </div>
  );
}
