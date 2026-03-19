import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { ArrowLeft, Upload, FileText, Trash2, Loader2, Sparkles, CheckCircle, AlertCircle, Clock } from "lucide-react";
import { useState, useRef } from "react";

const STATUS_MAP: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  uploading: { icon: <Clock className="w-3 h-3" />, color: "text-amber-400", label: "Uploading" },
  processing: { icon: <Loader2 className="w-3 h-3 animate-spin" />, color: "text-blue-400", label: "Processing" },
  ready: { icon: <CheckCircle className="w-3 h-3" />, color: "text-emerald-400", label: "Ready" },
  error: { icon: <AlertCircle className="w-3 h-3" />, color: "text-red-400", label: "Error" },
};

const CATEGORIES = [
  { value: "personal_docs", label: "Personal Documents" },
  { value: "financial_products", label: "Financial Products" },
  { value: "regulations", label: "Regulations" },
];

export default function Documents() {
  useAuth({ redirectOnUnauthenticated: true });
  const [, navigate] = useLocation();
  const [uploading, setUploading] = useState(false);
  const [category, setCategory] = useState<"personal_docs" | "financial_products" | "regulations">("personal_docs");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();

  const docs = trpc.documents.list.useQuery();
  const uploadDoc = trpc.documents.upload.useMutation({
    onSuccess: () => { utils.documents.list.invalidate(); toast.success("Document uploaded and processing"); setUploading(false); },
    onError: (e) => { toast.error(e.message); setUploading(false); },
  });
  const deleteDoc = trpc.documents.delete.useMutation({
    onSuccess: () => { utils.documents.list.invalidate(); toast.success("Document deleted"); },
  });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error("File too large (max 10MB)"); return; }
    setUploading(true);
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = (reader.result as string).split(",")[1];
      uploadDoc.mutate({ filename: file.name, content: base64, mimeType: file.type, category });
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-card/30 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => navigate("/")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <Sparkles className="w-4 h-4 text-accent" />
          <span className="font-semibold text-sm">Knowledge Base</span>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <Card className="bg-card border-border mb-6">
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Upload Documents</CardTitle>
            <CardDescription className="text-xs">Upload documents to build your AI's knowledge base. Supports text files, PDFs, and more.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3 flex-wrap">
              <Select value={category} onValueChange={(v) => setCategory(v as typeof category)}>
                <SelectTrigger className="w-48 bg-secondary border-border h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelect} accept=".txt,.md,.pdf,.doc,.docx,.csv,.json" />
              <Button className="bg-accent text-accent-foreground hover:bg-accent/90 text-sm gap-1.5" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {uploading ? "Uploading..." : "Upload File"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-3">
          {docs.data?.map(doc => {
            const status = STATUS_MAP[doc.status] || STATUS_MAP.error;
            return (
              <Card key={doc.id} className="bg-card border-border">
                <CardContent className="flex items-center gap-3 py-4">
                  <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                    <FileText className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{doc.filename}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`inline-flex items-center gap-1 text-xs ${status.color}`}>
                        {status.icon} {status.label}
                      </span>
                      <Badge variant="secondary" className="text-[10px]">{doc.category?.replace("_", " ")}</Badge>
                      {doc.chunkCount ? <span className="text-xs text-muted-foreground">{doc.chunkCount} chunks</span> : null}
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive" onClick={() => deleteDoc.mutate({ id: doc.id })}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </CardContent>
              </Card>
            );
          })}
          {(!docs.data || docs.data.length === 0) && (
            <div className="text-center py-16 text-muted-foreground">
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No documents uploaded yet</p>
              <p className="text-xs mt-1">Upload documents to enhance your AI's knowledge</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
