/**
 * FileUploader — Drag-and-drop file upload with progress and validation.
 * Supports CSV, XLSX, PDF, and image files with size limits.
 */
import { useState, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Upload, CheckCircle2, AlertTriangle, Loader2, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface FileUploaderProps {
  accept?: string[];
  maxSizeMB?: number;
  multiple?: boolean;
  onUpload: (files: File[]) => Promise<void>;
  className?: string;
}

type UploadState = "idle" | "dragging" | "uploading" | "done" | "error";

export function FileUploader({
  accept = [".csv", ".xlsx", ".xls", ".pdf"],
  maxSizeMB = 16,
  multiple = false,
  onUpload,
  className,
}: FileUploaderProps) {
  const [state, setState] = useState<UploadState>("idle");
  const [progress, setProgress] = useState(0);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const validateFiles = useCallback((files: File[]): File[] => {
    const maxBytes = maxSizeMB * 1024 * 1024;
    const valid: File[] = [];
    for (const f of files) {
      if (f.size > maxBytes) {
        toast.error(`${f.name} exceeds ${maxSizeMB}MB limit`);
        continue;
      }
      const ext = "." + f.name.split(".").pop()?.toLowerCase();
      if (accept.length > 0 && !accept.includes(ext)) {
        toast.error(`${f.name}: unsupported file type`);
        continue;
      }
      valid.push(f);
    }
    return multiple ? valid : valid.slice(0, 1);
  }, [accept, maxSizeMB, multiple]);

  const handleFiles = useCallback(async (fileList: FileList | null) => {
    if (!fileList) return;
    const files = validateFiles(Array.from(fileList));
    if (files.length === 0) return;
    setSelectedFiles(files);
    setState("uploading");
    setProgress(10);
    try {
      const interval = setInterval(() => setProgress(p => Math.min(p + 15, 90)), 300);
      await onUpload(files);
      clearInterval(interval);
      setProgress(100);
      setState("done");
      toast.success(`${files.length} file(s) uploaded successfully`);
    } catch {
      setState("error");
      toast.error("The upload didn't go through — please check your file and try again.");
    }
  }, [onUpload, validateFiles]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setState("idle");
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const reset = () => { setState("idle"); setProgress(0); setSelectedFiles([]); };

  return (
    <Card className={cn("transition-colors", state === "dragging" && "border-primary", className)}>
      <CardContent className="p-6">
        <div
          className="flex flex-col items-center justify-center gap-3 py-8 border-2 border-dashed rounded-lg cursor-pointer hover:border-primary/50 transition-colors"
          onDragOver={e => { e.preventDefault(); setState("dragging"); }}
          onDragLeave={() => setState("idle")}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
        >
          <input
            ref={inputRef} type="file" className="hidden"
            accept={accept.join(",")} multiple={multiple}
            onChange={e => handleFiles(e.target.files)}
          />
          {state === "idle" || state === "dragging" ? (
            <>
              <Upload className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Drag & drop or <span className="text-primary font-medium">browse</span>
              </p>
              <p className="text-xs text-muted-foreground/70">
                {accept.join(", ")} • Max {maxSizeMB}MB
              </p>
              <p className="text-[10px] text-muted-foreground/50 flex items-center gap-1 mt-1"><Shield className="w-3 h-3" /> Encrypted at rest & in transit</p>
            </>
          ) : state === "uploading" ? (
            <>
              <Loader2 className="h-8 w-8 text-primary animate-spin" />
              <p className="text-sm">Uploading {selectedFiles.map(f => f.name).join(", ")}...</p>
              <Progress value={progress} className="w-48 h-1.5" />
            </>
          ) : state === "done" ? (
            <>
              <CheckCircle2 className="h-8 w-8 text-emerald-400" />
              <p className="text-sm text-emerald-400">Upload complete</p>
              <Button variant="ghost" size="sm" onClick={e => { e.stopPropagation(); reset(); }}>Upload another</Button>
            </>
          ) : (
            <>
              <AlertTriangle className="h-8 w-8 text-red-400" />
              <p className="text-sm text-red-400">Upload failed</p>
              <Button variant="ghost" size="sm" onClick={e => { e.stopPropagation(); reset(); }}>Try again</Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
