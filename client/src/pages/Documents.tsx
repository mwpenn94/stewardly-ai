import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useLocation } from "wouter";
import {
  ArrowLeft, Upload, FileText, Trash2, Loader2, Sparkles,
  CheckCircle, AlertCircle, Clock, BookOpen, Briefcase,
  GraduationCap, FileCode, ScrollText, FolderOpen,
  Eye, EyeOff, Shield, Users, Lock,
} from "lucide-react";
import { useState, useRef } from "react";

const STATUS_MAP: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  uploading: { icon: <Clock className="w-3 h-3" />, color: "text-amber-400", label: "Uploading" },
  processing: { icon: <Loader2 className="w-3 h-3 animate-spin" />, color: "text-blue-400", label: "Processing" },
  ready: { icon: <CheckCircle className="w-3 h-3" />, color: "text-emerald-400", label: "Ready" },
  error: { icon: <AlertCircle className="w-3 h-3" />, color: "text-red-400", label: "Error" },
};

const VISIBILITY_OPTIONS = [
  { value: "private", label: "Private", icon: <Lock className="w-3 h-3" />, desc: "Only you can see" },
  { value: "professional", label: "My Advisor", icon: <Users className="w-3 h-3" />, desc: "You + your financial professional" },
  { value: "management", label: "Management", icon: <Shield className="w-3 h-3" />, desc: "You + professional + their management" },
  { value: "admin", label: "Organization", icon: <Eye className="w-3 h-3" />, desc: "Visible to all authorized staff" },
];

const CATEGORIES = [
  { value: "personal_docs", label: "Personal Documents", icon: <FolderOpen className="w-3.5 h-3.5" />, desc: "Your personal files and notes" },
  { value: "financial_products", label: "Financial Products", icon: <Briefcase className="w-3.5 h-3.5" />, desc: "Product guides, brochures, specs" },
  { value: "regulations", label: "Regulations & Compliance", icon: <ScrollText className="w-3.5 h-3.5" />, desc: "Regulatory docs and guidelines" },
  { value: "training_materials", label: "Training Materials", icon: <GraduationCap className="w-3.5 h-3.5" />, desc: "Courses, certifications, guides" },
  { value: "artifacts", label: "Artifacts & Deliverables", icon: <FileCode className="w-3.5 h-3.5" />, desc: "Reports, presentations, analyses" },
  { value: "skills", label: "Skills & Expertise", icon: <BookOpen className="w-3.5 h-3.5" />, desc: "Domain knowledge and how-tos" },
];

type CategoryValue = typeof CATEGORIES[number]["value"];

export default function Documents() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [uploading, setUploading] = useState(false);
  const [category, setCategory] = useState<CategoryValue>("personal_docs");
  const [visibility, setVisibility] = useState("professional");
  const [selectedDoc, setSelectedDoc] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();

  // TODO: Update to check org-specific roles from user_organization_roles table
  // For now, check if user is global_admin or has elevated org roles
  const isElevated = false; // TODO: Implement role-based access control

  const docs = trpc.documents.list.useQuery();
  const uploadDoc = trpc.documents.upload.useMutation({
    onSuccess: () => { utils.documents.list.invalidate(); toast.success("Document uploaded — your AI is learning from it"); setUploading(false); },
    onError: (e) => { toast.error(e.message); setUploading(false); },
  });
  const deleteDoc = trpc.documents.delete.useMutation({
    onSuccess: () => { utils.documents.list.invalidate(); toast.success("Document removed"); },
  });
  const updateVis = trpc.documents.updateVisibility.useMutation({
    onSuccess: () => { utils.documents.list.invalidate(); toast.success("Visibility updated"); },
  });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.size > 10 * 1024 * 1024) { toast.error(`${file.name} is too large (max 10MB)`); continue; }
      setUploading(true);
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(",")[1];
        uploadDoc.mutate({
          filename: file.name, content: base64, mimeType: file.type,
          category: category as any,
          visibility: visibility as any,
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
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-card/30 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
          <Button variant="ghost" size="icon-sm" onClick={() => navigate("/")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <Sparkles className="w-4 h-4 text-accent" />
          <span className="font-semibold text-sm">Knowledge Base</span>
          {totalDocs > 0 && (
            <Badge variant="secondary" className="ml-auto text-[10px]">
              {readyDocs}/{totalDocs} ready
            </Badge>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Upload section */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Upload Files to Train Your AI</CardTitle>
            <CardDescription className="text-xs">
              Upload documents, artifacts, skills, and other files to personalize your AI.
              Choose who can view each document using the visibility setting.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Category selector */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Category</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {CATEGORIES.map(c => (
                  <button
                    key={c.value}
                    onClick={() => setCategory(c.value)}
                    className={`text-left p-3 rounded-lg border transition-all text-xs ${
                      category === c.value
                        ? "border-accent/50 bg-accent/5"
                        : "border-border hover:border-accent/20"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-accent">{c.icon}</span>
                      <span className="font-medium">{c.label}</span>
                    </div>
                    <p className="text-muted-foreground text-[10px]">{c.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Visibility selector */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Visibility — Who can see this document?</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {VISIBILITY_OPTIONS.map(v => (
                  <button
                    key={v.value}
                    onClick={() => setVisibility(v.value)}
                    className={`text-left p-2.5 rounded-lg border transition-all text-xs ${
                      visibility === v.value
                        ? "border-accent/50 bg-accent/5"
                        : "border-border hover:border-accent/20"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-0.5">
                      {v.icon}
                      <span className="font-medium">{v.label}</span>
                    </div>
                    <p className="text-muted-foreground text-[10px]">{v.desc}</p>
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
                className="bg-accent text-accent-foreground hover:bg-accent/90 text-sm gap-1.5"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {uploading ? "Uploading..." : "Upload Files"}
              </Button>
              <p className="text-[10px] text-muted-foreground">
                Max 10MB each. Supports TXT, MD, PDF, DOC, DOCX, CSV, JSON, XLSX, PPTX, and more.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Documents list by category */}
        {totalDocs > 0 ? (
          Object.entries(docsByCategory).map(([cat, catDocs]) => {
            const catMeta = CATEGORIES.find(c => c.value === cat);
            return (
              <div key={cat}>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  {catMeta?.icon} {catMeta?.label || cat.replace(/_/g, " ")}
                </h3>
                <div className="space-y-2">
                  {catDocs.map((doc: any) => {
                    const status = STATUS_MAP[doc.status] || STATUS_MAP.error;
                    return (
                      <Card key={doc.id} className="bg-card border-border">
                        <CardContent className="flex items-center gap-3 py-3 px-4">
                          <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                            <FileText className="w-4 h-4 text-muted-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{doc.filename}</p>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              <span className={`inline-flex items-center gap-1 text-[10px] ${status.color}`}>
                                {status.icon} {status.label}
                              </span>
                              {doc.chunkCount ? <span className="text-[10px] text-muted-foreground">{doc.chunkCount} chunks</span> : null}
                              <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                                {visIcon(doc.visibility || "professional")} {visLabel(doc.visibility || "professional")}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {/* Visibility toggle */}
                            <Select
                              value={doc.visibility || "professional"}
                              onValueChange={(v) => updateVis.mutate({ id: doc.id, visibility: v as any })}
                            >
                              <SelectTrigger className="h-9 w-9 p-0 border-0 bg-transparent [&>svg]:hidden">
                                {doc.visibility === "private" ? <EyeOff className="w-3.5 h-3.5 text-muted-foreground" /> : <Eye className="w-3.5 h-3.5 text-muted-foreground" />}
                              </SelectTrigger>
                              <SelectContent>
                                {VISIBILITY_OPTIONS.map(v => (
                                  <SelectItem key={v.value} value={v.value}>
                                    <span className="flex items-center gap-1.5 text-xs">
                                      {v.icon} {v.label}
                                    </span>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {/* Insights */}
                            <Button
                              variant="ghost" size="sm"
                              className="h-9 w-9 p-0 text-muted-foreground hover:text-foreground"
                              onClick={() => setSelectedDoc(doc)}
                            >
                              <FileText className="w-3.5 h-3.5" />
                            </Button>
                            {/* Delete */}
                            <Button
                              variant="ghost" size="sm"
                              className="h-9 w-9 p-0 text-muted-foreground hover:text-destructive"
                              onClick={() => deleteDoc.mutate({ id: doc.id })}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
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
          <div className="text-center py-16 text-muted-foreground">
            <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No files uploaded yet</p>
            <p className="text-xs mt-1">Upload documents, artifacts, and skills to enhance your AI experience</p>
          </div>
        )}
      </div>

      {/* Document Insights Dialog */}
      <Dialog open={!!selectedDoc} onOpenChange={() => setSelectedDoc(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-sm">{selectedDoc?.filename}</DialogTitle>
            <DialogDescription className="text-xs">Document insights and extracted content</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-secondary/50">
                <p className="text-[10px] text-muted-foreground">Status</p>
                <p className="text-xs font-medium">{STATUS_MAP[selectedDoc?.status]?.label || "Unknown"}</p>
              </div>
              <div className="p-3 rounded-lg bg-secondary/50">
                <p className="text-[10px] text-muted-foreground">Chunks</p>
                <p className="text-xs font-medium">{selectedDoc?.chunkCount || 0}</p>
              </div>
              <div className="p-3 rounded-lg bg-secondary/50">
                <p className="text-[10px] text-muted-foreground">Category</p>
                <p className="text-xs font-medium">{CATEGORIES.find(c => c.value === selectedDoc?.category)?.label || selectedDoc?.category}</p>
              </div>
              <div className="p-3 rounded-lg bg-secondary/50">
                <p className="text-[10px] text-muted-foreground">Visibility</p>
                <p className="text-xs font-medium flex items-center gap-1">{visIcon(selectedDoc?.visibility || "professional")} {visLabel(selectedDoc?.visibility || "professional")}</p>
              </div>
            </div>
            {selectedDoc?.extractedText && (
              <div>
                <p className="text-xs font-medium mb-1">Extracted Content Preview</p>
                <div className="p-3 rounded-lg bg-secondary/30 text-xs text-muted-foreground max-h-48 overflow-y-auto whitespace-pre-wrap font-mono">
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
