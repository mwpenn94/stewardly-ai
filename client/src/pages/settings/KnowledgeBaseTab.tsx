import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Upload, FileText, Trash2, Loader2,
  CheckCircle, AlertCircle, Clock, BookOpen, Briefcase,
  GraduationCap, FileCode, ScrollText, FolderOpen,
  Eye, EyeOff, Shield, Users, Lock, Sparkles,
} from "lucide-react";
import { useState, useRef } from "react";

const STATUS_MAP: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  uploading: { icon: <Clock className="w-3 h-3" />, color: "text-amber-400", label: "Uploading" },
  processing: { icon: <Loader2 className="w-3 h-3 animate-spin" />, color: "text-blue-400", label: "Processing" },
  ready: { icon: <CheckCircle className="w-3 h-3" />, color: "text-emerald-400", label: "Ready" },
  error: { icon: <AlertCircle className="w-3 h-3" />, color: "text-red-400", label: "Error" },
};

const VISIBILITY_OPTIONS = [
  { value: "private", label: "Private", icon: <Lock className="w-3 h-3" />, desc: "Only you" },
  { value: "professional", label: "My Advisor", icon: <Users className="w-3 h-3" />, desc: "You + advisor" },
  { value: "management", label: "Management", icon: <Shield className="w-3 h-3" />, desc: "You + advisor + mgmt" },
  { value: "admin", label: "Organization", icon: <Eye className="w-3 h-3" />, desc: "All authorized staff" },
];

const CATEGORIES = [
  { value: "personal_docs", label: "Personal Documents", icon: <FolderOpen className="w-3.5 h-3.5" /> },
  { value: "financial_products", label: "Financial Products", icon: <Briefcase className="w-3.5 h-3.5" /> },
  { value: "regulations", label: "Regulations", icon: <ScrollText className="w-3.5 h-3.5" /> },
  { value: "training_materials", label: "Training", icon: <GraduationCap className="w-3.5 h-3.5" /> },
  { value: "artifacts", label: "Artifacts", icon: <FileCode className="w-3.5 h-3.5" /> },
  { value: "skills", label: "Skills", icon: <BookOpen className="w-3.5 h-3.5" /> },
];

export default function KnowledgeBaseTab() {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [uploadCount, setUploadCount] = useState(0);
  const [visibility, setVisibility] = useState("professional");
  const [selectedDoc, setSelectedDoc] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();

  const docs = trpc.documents.list.useQuery();
  const uploadDoc = trpc.documents.upload.useMutation({
    onSuccess: (data) => {
      utils.documents.list.invalidate();
      const catLabel = CATEGORIES.find(c => c.value === data.category)?.label || data.category;
      toast.success(`Uploaded — AI categorized as "${catLabel}"`);
      setUploadCount(prev => {
        const next = prev - 1;
        if (next <= 0) setUploading(false);
        return Math.max(0, next);
      });
    },
    onError: (e) => {
      toast.error(e.message);
      setUploadCount(prev => {
        const next = prev - 1;
        if (next <= 0) setUploading(false);
        return Math.max(0, next);
      });
    },
  });
  const deleteDoc = trpc.documents.delete.useMutation({
    onSuccess: () => { utils.documents.list.invalidate(); toast.success("Document removed"); },
  });
  const updateVis = trpc.documents.updateVisibility.useMutation({
    onSuccess: () => { utils.documents.list.invalidate(); toast.success("Visibility updated"); },
  });

  const MAX_FILE_SIZE = 31 * 1024 * 1024; // 31MB

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const validFiles: File[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`${file.name} is too large (max 31MB)`);
        continue;
      }
      validFiles.push(file);
    }

    if (validFiles.length === 0) {
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setUploading(true);
    setUploadCount(validFiles.length);

    for (const file of validFiles) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(",")[1];
        // No category passed — AI will auto-categorize on the server
        uploadDoc.mutate({
          filename: file.name,
          content: base64,
          mimeType: file.type,
          visibility: visibility as any,
        });
      };
      reader.onerror = () => {
        toast.error(`Failed to read ${file.name}`);
        setUploadCount(prev => {
          const next = prev - 1;
          if (next <= 0) setUploading(false);
          return Math.max(0, next);
        });
      };
      reader.readAsDataURL(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const docsByCategory = (docs.data || []).reduce((acc: Record<string, any[]>, doc: any) => {
    const cat = doc.category || "personal_docs";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(doc);
    return acc;
  }, {});

  const totalDocs = docs.data?.length || 0;
  const readyDocs = docs.data?.filter((d: any) => d.status === "ready").length || 0;

  const visIcon = (v: string) => {
    if (v === "private") return <Lock className="w-3 h-3 text-muted-foreground" />;
    if (v === "professional") return <Users className="w-3 h-3 text-blue-400" />;
    if (v === "management") return <Shield className="w-3 h-3 text-amber-400" />;
    return <Eye className="w-3 h-3 text-emerald-400" />;
  };

  const visLabel = (v: string) => VISIBILITY_OPTIONS.find(o => o.value === v)?.label || v;

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold mb-1">Knowledge Base</h2>
          <p className="text-sm text-muted-foreground">Upload documents to personalize your AI. Categories are assigned automatically.</p>
        </div>
        {totalDocs > 0 && (
          <Badge variant="secondary" className="text-[10px] shrink-0">
            {readyDocs}/{totalDocs} ready
          </Badge>
        )}
      </div>

      {/* Upload section */}
      <Card className="bg-card/50 border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-1.5">
            <Upload className="w-3.5 h-3.5" /> Upload Files
          </CardTitle>
          <CardDescription className="text-xs flex items-center gap-1.5">
            <Sparkles className="w-3 h-3 text-accent" />
            AI automatically categorizes your uploads — just drop files and go.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Visibility selector */}
          <div>
            <p className="text-[10px] font-medium text-muted-foreground mb-1.5 uppercase tracking-wider">Visibility</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {VISIBILITY_OPTIONS.map(v => (
                <button
                  key={v.value}
                  onClick={() => setVisibility(v.value)}
                  className={`text-left p-2 rounded-lg border transition-all text-xs ${
                    visibility === v.value
                      ? "border-accent/50 bg-accent/5"
                      : "border-border/50 hover:border-accent/20"
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    {v.icon}
                    <span className="font-medium text-[11px]">{v.label}</span>
                  </div>
                  <p className="text-muted-foreground text-[9px] mt-0.5">{v.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleFileSelect}
              accept=".txt,.md,.pdf,.doc,.docx,.csv,.json,.xlsx,.pptx,.rtf,.html,.xml,.yaml,.yml"
              multiple
            />
            <Button
              size="sm"
              className="bg-accent text-accent-foreground hover:bg-accent/90 text-xs gap-1.5"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
              {uploading ? `Uploading (${uploadCount} remaining)...` : "Upload Files"}
            </Button>
            <p className="text-[9px] text-muted-foreground">
              Max 31MB each. TXT, MD, PDF, DOC, DOCX, CSV, JSON, XLSX, PPTX, and more.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Documents list */}
      {totalDocs > 0 ? (
        Object.entries(docsByCategory).map(([cat, catDocs]) => {
          const catMeta = CATEGORIES.find(c => c.value === cat);
          return (
            <div key={cat}>
              <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                {catMeta?.icon} {catMeta?.label || cat.replace(/_/g, " ")}
                <Badge variant="outline" className="text-[8px] ml-1">{catDocs.length}</Badge>
              </h3>
              <div className="space-y-1.5">
                {catDocs.map((doc: any) => {
                  const status = STATUS_MAP[doc.status] || STATUS_MAP.error;
                  return (
                    <Card key={doc.id} className="bg-card/30 border-border/30">
                      <CardContent className="flex items-center gap-3 py-2.5 px-3">
                        <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                          <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{doc.filename}</p>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className={`inline-flex items-center gap-1 text-[9px] ${status.color}`}>
                              {status.icon} {status.label}
                            </span>
                            {doc.chunkCount ? <span className="text-[9px] text-muted-foreground">{doc.chunkCount} chunks</span> : null}
                            <span className="inline-flex items-center gap-1 text-[9px] text-muted-foreground">
                              {visIcon(doc.visibility || "professional")} {visLabel(doc.visibility || "professional")}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-0.5 shrink-0">
                          <Select
                            value={doc.visibility || "professional"}
                            onValueChange={(v) => updateVis.mutate({ id: doc.id, visibility: v as any })}
                          >
                            <SelectTrigger className="h-9 w-9 p-0 border-0 bg-transparent [&>svg]:hidden">
                              {doc.visibility === "private" ? <EyeOff className="w-3 h-3 text-muted-foreground" /> : <Eye className="w-3 h-3 text-muted-foreground" />}
                            </SelectTrigger>
                            <SelectContent>
                              {VISIBILITY_OPTIONS.map(v => (
                                <SelectItem key={v.value} value={v.value}>
                                  <span className="flex items-center gap-1.5 text-xs">{v.icon} {v.label}</span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            variant="ghost" size="sm"
                            className="h-9 w-9 p-0 text-muted-foreground hover:text-foreground"
                            onClick={() => setSelectedDoc(doc)}
                          >
                            <FileText className="w-3 h-3" />
                          </Button>
                          <Button
                            variant="ghost" size="sm"
                            className="h-9 w-9 p-0 text-muted-foreground hover:text-destructive"
                            onClick={() => deleteDoc.mutate({ id: doc.id })}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          );
        })
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          <FileText className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No files uploaded yet</p>
          <p className="text-xs mt-1">Upload documents to enhance your AI experience</p>
        </div>
      )}

      {/* Document Insights Dialog */}
      <Dialog open={!!selectedDoc} onOpenChange={() => setSelectedDoc(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-sm">{selectedDoc?.filename}</DialogTitle>
            <DialogDescription className="text-xs">Document insights and extracted content</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2.5 rounded-lg bg-secondary/50">
                <p className="text-[9px] text-muted-foreground">Status</p>
                <p className="text-xs font-medium">{STATUS_MAP[selectedDoc?.status]?.label || "Unknown"}</p>
              </div>
              <div className="p-2.5 rounded-lg bg-secondary/50">
                <p className="text-[9px] text-muted-foreground">Chunks</p>
                <p className="text-xs font-medium">{selectedDoc?.chunkCount || 0}</p>
              </div>
              <div className="p-2.5 rounded-lg bg-secondary/50">
                <p className="text-[9px] text-muted-foreground">Category</p>
                <p className="text-xs font-medium flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-accent" />
                  {CATEGORIES.find(c => c.value === selectedDoc?.category)?.label || selectedDoc?.category}
                </p>
              </div>
              <div className="p-2.5 rounded-lg bg-secondary/50">
                <p className="text-[9px] text-muted-foreground">Visibility</p>
                <p className="text-xs font-medium flex items-center gap-1">{visIcon(selectedDoc?.visibility || "professional")} {visLabel(selectedDoc?.visibility || "professional")}</p>
              </div>
            </div>
            {selectedDoc?.extractedText && (
              <div>
                <p className="text-xs font-medium mb-1">Extracted Content Preview</p>
                <div className="p-2.5 rounded-lg bg-secondary/30 text-[11px] text-muted-foreground max-h-48 overflow-y-auto whitespace-pre-wrap font-mono">
                  {selectedDoc.extractedText.substring(0, 2000)}
                  {selectedDoc.extractedText.length > 2000 && "..."}
                </div>
              </div>
            )}
            {selectedDoc?.fileUrl && (
              <a
                href={selectedDoc.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-accent hover:underline"
              >
                <FileText className="w-3 h-3" /> View original file
              </a>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
