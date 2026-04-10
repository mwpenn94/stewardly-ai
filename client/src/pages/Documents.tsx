import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent } from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { useLocation } from "wouter";
import {
  ArrowLeft, Upload, FileText, Trash2, Loader2, Sparkles,
  CheckCircle, AlertCircle, Clock, BookOpen, Briefcase,
  GraduationCap, FileCode, ScrollText, FolderOpen,
  Eye, Shield, Users, Lock, Search, X, MoreHorizontal,
  Pencil, FolderInput, ShieldCheck, CheckSquare, XSquare,
  CloudUpload, FileUp, Filter, GripVertical, Zap,
  BarChart3, RefreshCw, History, RotateCcw, ChevronDown,
  Database, PieChart, Activity, TrendingUp,
  Tag, Tags, Brain, Globe, Archive, Link2, MessageSquare,
  ThumbsUp, ThumbsDown, XCircle, CheckCircle2, Plus, Minus,
} from "lucide-react";
import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor,
  useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates,
  useSortable, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// ─── Constants ───────────────────────────────────────────────────
const STATUS_MAP: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  uploading: { icon: <Clock className="w-3 h-3" />, color: "text-amber-400", label: "Uploading" },
  processing: { icon: <Loader2 className="w-3 h-3 animate-spin" />, color: "text-blue-400", label: "Processing" },
  ready: { icon: <CheckCircle className="w-3 h-3" />, color: "text-emerald-400", label: "Ready" },
  error: { icon: <AlertCircle className="w-3 h-3" />, color: "text-red-400", label: "Error" },
};

const VISIBILITY_OPTIONS = [
  { value: "private", label: "Private", icon: <Lock className="w-3 h-3" />, desc: "Only you" },
  { value: "professional", label: "My Advisor", icon: <Users className="w-3 h-3" />, desc: "You + advisor" },
  { value: "management", label: "Management", icon: <Shield className="w-3 h-3" />, desc: "You + management" },
  { value: "admin", label: "Organization", icon: <Eye className="w-3 h-3" />, desc: "All staff" },
];

const CATEGORIES = [
  { value: "personal_docs", label: "Personal Documents", shortLabel: "Personal", icon: <FolderOpen className="w-3.5 h-3.5" /> },
  { value: "financial_products", label: "Financial Products", shortLabel: "Products", icon: <Briefcase className="w-3.5 h-3.5" /> },
  { value: "regulations", label: "Regulations & Compliance", shortLabel: "Regulations", icon: <ScrollText className="w-3.5 h-3.5" /> },
  { value: "training_materials", label: "Training Materials", shortLabel: "Training", icon: <GraduationCap className="w-3.5 h-3.5" /> },
  { value: "artifacts", label: "Artifacts & Deliverables", shortLabel: "Artifacts", icon: <FileCode className="w-3.5 h-3.5" /> },
  { value: "skills", label: "Skills & Expertise", shortLabel: "Skills", icon: <BookOpen className="w-3.5 h-3.5" /> },
];

const SUPPORTED_FILE_ACCEPT = ".pdf,.doc,.docx,.odt,.txt,.md,.csv,.tsv,.json,.jsonl,.xml,.html,.htm,.rtf,.xlsx,.xls,.ods,.pptx,.ppt,.odp,.yaml,.yml,.toml,.ini,.cfg,.conf,.log,.sql,.py,.js,.ts,.jsx,.tsx,.css,.java,.c,.cpp,.h,.cs,.go,.rs,.rb,.swift,.sh,.tex,.epub,.ics,.vcf,.zip";

type CategoryValue = typeof CATEGORIES[number]["value"];
type VisibilityValue = typeof VISIBILITY_OPTIONS[number]["value"];

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
function isRecentlyAdded(createdAt: string | Date): boolean {
  const created = typeof createdAt === "string" ? new Date(createdAt) : createdAt;
  return Date.now() - created.getTime() < SEVEN_DAYS_MS;
}
function formatDate(d: string | Date): string {
  return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

const PRIORITY_COLORS: Record<string, string> = {
  high: "bg-red-500/10 text-red-400 border-red-500/20",
  medium: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  low: "bg-blue-500/10 text-blue-400 border-blue-500/20",
};

// ─── Processing Dashboard ────────────────────────────────────────
function ProcessingDashboard() {
  const stats = trpc.documents.processingStats.useQuery();
  const s = stats.data as any;
  if (!s) return <div className="text-center py-8 text-muted-foreground text-sm">Loading stats...</div>;
  const health = s.total > 0 ? Math.round((s.ready / s.total) * 100) : 100;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Files", value: s.total, icon: <Database className="w-4 h-4 text-accent" /> },
          { label: "Ready", value: s.ready, icon: <CheckCircle className="w-4 h-4 text-emerald-400" /> },
          { label: "Processing", value: s.processing, icon: <Loader2 className="w-4 h-4 text-blue-400 animate-spin" /> },
          { label: "Failed", value: s.error, icon: <AlertCircle className="w-4 h-4 text-red-400" /> },
        ].map(item => (
          <Card key={item.label} className="bg-card/50 border-border">
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-1">{item.icon}<span className="text-[10px] text-muted-foreground">{item.label}</span></div>
              <p className="text-xl font-bold">{item.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="bg-card/50 border-border">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium">Knowledge Base Health</span>
            <span className="text-xs text-muted-foreground">{health}%</span>
          </div>
          <Progress value={health} className="h-2" />
          <div className="flex items-center justify-between mt-3 text-[10px] text-muted-foreground">
            <span>Total chunks: {s.totalChunks?.toLocaleString() || 0}</span>
            <span>Uploaded this week: {s.recentUploads || 0}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Version History Panel ───────────────────────────────────────
function VersionHistoryPanel({ doc, onUploadNewVersion }: { doc: any; onUploadNewVersion: (doc: any) => void }) {
  const versions = trpc.documents.versions.useQuery({ documentId: doc.id });
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-semibold flex items-center gap-1.5"><History className="w-3.5 h-3.5 text-accent" /> Version History</h4>
        <Button variant="outline" size="sm" className="text-[10px] h-6 gap-1" onClick={() => onUploadNewVersion(doc)}>
          <Upload className="w-3 h-3" /> New Version
        </Button>
      </div>
      {versions.data && (versions.data as any[]).length > 0 ? (
        <div className="space-y-1.5">
          {(versions.data as any[]).map((v: any) => (
            <div key={v.id} className="flex items-center gap-2 p-2 rounded-lg bg-secondary/30 text-xs">
              <Badge variant="secondary" className="text-[9px]">v{v.versionNumber}</Badge>
              <span className="truncate flex-1 text-muted-foreground">{v.filename}</span>
              <span className="text-[10px] text-muted-foreground">{formatDate(v.createdAt)}</span>
              {v.fileUrl && <a href={v.fileUrl} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline text-[10px]">Download</a>}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[10px] text-muted-foreground">No previous versions</p>
      )}
    </div>
  );
}

// ─── Tag Pills Component ─────────────────────────────────────────
function DocTagPills({ docId, compact }: { docId: number; compact?: boolean }) {
  const tags = trpc.documents.getDocTags.useQuery({ documentId: docId });
  const tagList = (tags.data || []) as any[];
  if (tagList.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-0.5">
      {tagList.slice(0, compact ? 3 : 10).map((t: any) => (
        <span key={t.id} className="inline-flex items-center gap-0.5 px-1.5 py-0 rounded-full text-[9px] bg-accent/10 text-accent border border-accent/20">
          <Tag className="w-2 h-2" />{t.name}
        </span>
      ))}
      {compact && tagList.length > 3 && (
        <span className="text-[9px] text-muted-foreground">+{tagList.length - 3}</span>
      )}
    </div>
  );
}

// ─── Gap Analysis Panel ──────────────────────────────────────────
function GapAnalysisPanel() {
  const utils = trpc.useUtils();
  const analyzeMut = trpc.documents.analyzeGaps.useMutation({
    onSuccess: () => toast.success("Gap analysis complete"),
    onError: (e) => toast.error(e.message),
  });
  const feedbackMut = trpc.documents.submitGapFeedback.useMutation({
    onSuccess: () => { toast.success("Feedback recorded — future analyses will improve"); },
  });
  const [gaps, setGaps] = useState<any[]>([]);
  const [summary, setSummary] = useState("");
  const [feedbackNote, setFeedbackNote] = useState<Record<string, string>>({});
  const [showNoteFor, setShowNoteFor] = useState<string | null>(null);

  const runAnalysis = async () => {
    const result = await analyzeMut.mutateAsync();
    setGaps(result.gaps);
    setSummary(result.summary);
  };

  const submitFeedback = (gap: any, action: string) => {
    feedbackMut.mutate({
      gapId: gap.id,
      gapTitle: gap.title,
      gapCategory: gap.category,
      action: action as any,
      userNote: feedbackNote[gap.id] || undefined,
    });
    setGaps(prev => prev.filter(g => g.id !== gap.id));
    setShowNoteFor(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-1.5"><Brain className="w-4 h-4 text-accent" /> Knowledge Gap Analysis</h3>
          <p className="text-[10px] text-muted-foreground mt-0.5">AI scans your knowledge base and identifies missing document types. Your feedback improves future analyses.</p>
        </div>
        <Button
          size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90 text-xs gap-1.5 h-8"
          onClick={runAnalysis} disabled={analyzeMut.isPending}
        >
          {analyzeMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Brain className="w-3.5 h-3.5" />}
          {analyzeMut.isPending ? "Analyzing..." : "Run Analysis"}
        </Button>
      </div>

      {summary && (
        <Card className="bg-accent/5 border-accent/20">
          <CardContent className="p-3">
            <p className="text-xs text-accent font-medium mb-1">Summary</p>
            <p className="text-xs text-muted-foreground">{summary}</p>
          </CardContent>
        </Card>
      )}

      {gaps.length > 0 ? (
        <div className="space-y-2">
          {gaps.map(gap => (
            <Card key={gap.id} className="bg-card/50 border-border">
              <CardContent className="p-3">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold">{gap.title}</span>
                      <Badge variant="outline" className={`text-[9px] ${PRIORITY_COLORS[gap.priority] || ""}`}>
                        {gap.priority}
                      </Badge>
                      <Badge variant="secondary" className="text-[9px]">{gap.category}</Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground mb-1.5">{gap.description}</p>
                    <p className="text-[10px] text-accent">Suggested: {gap.suggestedAction}</p>
                  </div>
                </div>

                {showNoteFor === gap.id && (
                  <div className="mt-2 space-y-1.5">
                    <Textarea
                      placeholder="Add a note to help the AI improve (optional)..."
                      value={feedbackNote[gap.id] || ""}
                      onChange={(e) => setFeedbackNote(prev => ({ ...prev, [gap.id]: e.target.value }))}
                      className="text-xs h-16 resize-none"
                    />
                    <div className="flex gap-1.5">
                      <Button size="sm" className="text-[10px] h-6 gap-1 bg-accent text-accent-foreground" onClick={() => submitFeedback(gap, "acknowledge")}>
                        <ThumbsUp className="w-2.5 h-2.5" /> Important — I'll address this
                      </Button>
                      <Button size="sm" variant="outline" className="text-[10px] h-6" onClick={() => setShowNoteFor(null)}>Cancel</Button>
                    </div>
                  </div>
                )}

                {showNoteFor !== gap.id && (
                  <div className="flex items-center gap-1.5 mt-2">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="outline" size="sm" className="text-[10px] h-6 gap-1" onClick={() => setShowNoteFor(gap.id)}>
                            <MessageSquare className="w-2.5 h-2.5" /> Feedback
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent className="text-[10px]">Acknowledge with a note to improve future analyses</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <Button variant="outline" size="sm" className="text-[10px] h-6 gap-1 text-emerald-400" onClick={() => submitFeedback(gap, "resolved")}>
                      <CheckCircle2 className="w-2.5 h-2.5" /> Resolved
                    </Button>
                    <Button variant="outline" size="sm" className="text-[10px] h-6 gap-1 text-muted-foreground" onClick={() => submitFeedback(gap, "not_applicable")}>
                      <XCircle className="w-2.5 h-2.5" /> N/A
                    </Button>
                    <Button variant="ghost" size="sm" className="text-[10px] h-6 gap-1 text-muted-foreground" onClick={() => submitFeedback(gap, "dismiss")}>
                      Dismiss
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : !analyzeMut.isPending && !summary ? (
        <div className="text-center py-12 text-muted-foreground">
          <Brain className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Click "Run Analysis" to scan your knowledge base</p>
          <p className="text-[10px] mt-1">The AI will identify missing document types and suggest improvements</p>
        </div>
      ) : !analyzeMut.isPending && gaps.length === 0 ? (
        <Card className="bg-emerald-500/5 border-emerald-500/20">
          <CardContent className="p-6 text-center">
            <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
            <p className="text-sm font-medium text-emerald-400">No gaps found</p>
            <p className="text-[10px] text-muted-foreground mt-1">Your knowledge base looks comprehensive</p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

// ─── Tag Management Panel ────────────────────────────────────────
function TagManagementPanel() {
  const utils = trpc.useUtils();
  const tags = trpc.documents.listTags.useQuery();
  const tagList = (tags.data || []) as any[];
  const [filterTag, setFilterTag] = useState<number | null>(null);
  const docsForTag = trpc.documents.docsForTag.useQuery({ tagId: filterTag! }, { enabled: !!filterTag });

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold flex items-center gap-1.5 mb-2"><Tags className="w-4 h-4 text-accent" /> All Tags</h3>
        <p className="text-[10px] text-muted-foreground mb-3">Tags are created by AI auto-tagging or manually. Click a tag to see which documents use it.</p>
        {tagList.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {tagList.map((t: any) => (
              <button
                key={t.id}
                onClick={() => setFilterTag(filterTag === t.id ? null : t.id)}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs border transition-all ${
                  filterTag === t.id
                    ? "bg-accent text-accent-foreground border-accent"
                    : "bg-card border-border hover:border-accent/30"
                }`}
              >
                <Tag className="w-3 h-3" />
                {t.name}
                {t.isAiGenerated && <Sparkles className="w-2.5 h-2.5 text-amber-400" />}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No tags yet. Upload documents and use AI auto-tagging to get started.</p>
        )}
      </div>

      {filterTag && (
        <Card className="bg-card/50 border-border">
          <CardContent className="p-3">
            <h4 className="text-xs font-medium mb-2">Documents with this tag</h4>
            {docsForTag.data && (docsForTag.data as any[]).length > 0 ? (
              <div className="space-y-1">
                {(docsForTag.data as any[]).map((d: any) => (
                  <div key={d.id} className="flex items-center gap-2 p-1.5 rounded bg-secondary/30 text-xs">
                    <FileText className="w-3 h-3 text-muted-foreground" />
                    <span className="truncate">{d.filename}</span>
                    <Badge variant="secondary" className="text-[9px] ml-auto">{d.category}</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[10px] text-muted-foreground">No documents found</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Sortable Document Row ───────────────────────────────────────
function SortableDocRow({
  doc, selectMode, isSelected, renamingId, renameValue, renameInputRef,
  onToggleSelect, onStartRename, onRenameChange, onSubmitRename, onCancelRename,
  onViewDetails, onUpdateVis, onUpdateCat, onDelete, onReprocess,
  onUploadNewVersion, onAutoTag, visIcon, visLabel,
}: any) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: doc.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  const status = STATUS_MAP[doc.status] || STATUS_MAP.processing;
  const isRenaming = renamingId === doc.id;
  const isRecent = isRecentlyAdded(doc.createdAt);

  return (
    <div ref={setNodeRef} style={style} className="group flex items-center gap-2 p-2.5 rounded-lg border border-border bg-card/50 hover:bg-card/80 transition-all">
      <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none">
        <GripVertical className="w-3.5 h-3.5" />
      </button>

      {selectMode && (
        <Checkbox checked={isSelected} onCheckedChange={() => onToggleSelect(doc.id)} className="mr-0.5" />
      )}

      <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${status.color.replace("text-", "bg-")}`} />

      <div className="flex-1 min-w-0">
        {isRenaming ? (
          <input
            ref={renameInputRef}
            value={renameValue}
            onChange={(e: any) => onRenameChange(e.target.value)}
            onBlur={onSubmitRename}
            onKeyDown={(e: any) => { if (e.key === "Enter") onSubmitRename(); if (e.key === "Escape") onCancelRename(); }}
            className="text-xs font-medium bg-transparent border-b border-accent outline-none w-full"
          />
        ) : (
          <div>
            <div className="flex items-center gap-1.5">
              <p className="text-xs font-medium truncate cursor-pointer hover:text-accent" onDoubleClick={() => onStartRename(doc)}>
                {doc.filename}
              </p>
              {isRecent && <Badge variant="secondary" className="text-[8px] bg-emerald-500/10 text-emerald-400 border-emerald-500/20 px-1">New</Badge>}
            </div>
            <DocTagPills docId={doc.id} compact />
          </div>
        )}
      </div>

      <div className="flex items-center gap-1.5">
        <span className="flex items-center gap-0.5" title={`Visible to: ${visLabel(doc.visibility)}`}>{visIcon(doc.visibility)}<span className="text-[9px] text-muted-foreground/60 hidden sm:inline">{visLabel(doc.visibility)}</span></span>
        <span className="text-[10px] text-muted-foreground hidden sm:inline">{formatDate(doc.createdAt)}</span>
        {doc.chunkCount > 0 && <Badge variant="secondary" className="text-[9px]">{doc.chunkCount} chunks</Badge>}
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
            <MoreHorizontal className="w-3.5 h-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={() => onViewDetails(doc)} className="text-xs gap-2"><Eye className="w-3 h-3" /> View Details</DropdownMenuItem>
          <DropdownMenuItem onClick={() => onStartRename(doc)} className="text-xs gap-2"><Pencil className="w-3 h-3" /> Rename</DropdownMenuItem>
          <DropdownMenuItem onClick={() => onAutoTag(doc.id)} className="text-xs gap-2"><Sparkles className="w-3 h-3" /> AI Auto-Tag</DropdownMenuItem>
          <DropdownMenuItem onClick={() => onUploadNewVersion(doc)} className="text-xs gap-2"><History className="w-3 h-3" /> Upload New Version</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="text-xs gap-2"><ShieldCheck className="w-3 h-3" /> Visibility</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {VISIBILITY_OPTIONS.map(v => (
                <DropdownMenuItem key={v.value} onClick={() => onUpdateVis(doc.id, v.value)} className="text-xs gap-2">{v.icon} {v.label}</DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="text-xs gap-2"><FolderInput className="w-3 h-3" /> Category</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {CATEGORIES.map(c => (
                <DropdownMenuItem key={c.value} onClick={() => onUpdateCat(doc.id, c.value)} className="text-xs gap-2">{c.icon} {c.shortLabel}</DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          {doc.status === "error" && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onReprocess(doc.id)} className="text-xs gap-2 text-amber-400"><RefreshCw className="w-3 h-3" /> Retry Processing</DropdownMenuItem>
            </>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => onDelete(doc.id)} className="text-xs gap-2 text-destructive"><Trash2 className="w-3 h-3" /> Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

// ─── Sortable Category Group ─────────────────────────────────────
function SortableCategoryGroup({ cat, catDocs, catMeta, selectMode, selectedIds, renamingId, renameValue, renameInputRef, onToggleSelect, onStartRename, onRenameChange, onSubmitRename, onCancelRename, onViewDetails, onUpdateVis, onUpdateCat, onDelete, onReprocess, onUploadNewVersion, onAutoTag, onDragEnd, visIcon, visLabel }: any) {
  const meta = catMeta(cat);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const sortedDocs = [...catDocs].sort((a: any, b: any) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999));
  const recentInCat = catDocs.filter((d: any) => isRecentlyAdded(d.createdAt)).length;

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-accent">{meta?.icon}</span>
        <h3 className="text-xs font-semibold">{meta?.label || cat}</h3>
        <Badge variant="secondary" className="text-[9px]">{catDocs.length}</Badge>
        {recentInCat > 0 && <Badge variant="secondary" className="text-[9px] bg-emerald-500/10 text-emerald-400 border-emerald-500/20">{recentInCat} new</Badge>}
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => onDragEnd(e, cat, sortedDocs)}>
        <SortableContext items={sortedDocs.map((d: any) => d.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-1">
            {sortedDocs.map((doc: any) => (
              <SortableDocRow
                key={doc.id} doc={doc} selectMode={selectMode} isSelected={selectedIds.has(doc.id)}
                renamingId={renamingId} renameValue={renameValue} renameInputRef={renameInputRef}
                onToggleSelect={onToggleSelect} onStartRename={onStartRename} onRenameChange={onRenameChange}
                onSubmitRename={onSubmitRename} onCancelRename={onCancelRename} onViewDetails={onViewDetails}
                onUpdateVis={onUpdateVis} onUpdateCat={onUpdateCat} onDelete={onDelete} onReprocess={onReprocess}
                onUploadNewVersion={onUploadNewVersion} onAutoTag={onAutoTag} visIcon={visIcon} visLabel={visLabel}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}

// ─── URL Import Dialog ───────────────────────────────────────────
function UrlImportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const utils = trpc.useUtils();
  const [urls, setUrls] = useState("");
  const importMut = trpc.documents.importFromUrls.useMutation({
    onSuccess: (r) => {
      utils.documents.list.invalidate();
      utils.documents.processingStats.invalidate();
      toast.success(`Imported ${r.imported} of ${r.imported + r.failed} URLs`);
      if (r.failed > 0) {
        const failures = r.results.filter((x: any) => !x.success);
        failures.forEach((f: any) => toast.error(`${f.url}: ${f.error}`));
      }
      setUrls("");
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  const handleImport = () => {
    const urlList = urls.split("\n").map(u => u.trim()).filter(u => u.length > 0);
    if (urlList.length === 0) { toast.error("Enter at least one URL"); return; }
    if (urlList.length > 20) { toast.error("Maximum 20 URLs at once"); return; }
    importMut.mutate({ urls: urlList });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-2"><Globe className="w-4 h-4 text-accent" /> Import from URLs</DialogTitle>
          <DialogDescription className="text-xs">Paste URLs (one per line) to fetch web pages and PDFs directly into your knowledge base. Max 20 URLs.</DialogDescription>
        </DialogHeader>
        <Textarea
          placeholder={"https://example.com/document.pdf\nhttps://example.com/article\nhttps://example.com/guide.html"}
          value={urls}
          onChange={(e) => setUrls(e.target.value)}
          className="text-xs h-32 font-mono resize-none"
        />
        <div className="text-[10px] text-muted-foreground">
          {urls.split("\n").filter(u => u.trim()).length} URL(s) entered
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} disabled={importMut.isPending}>Cancel</Button>
          <Button className="bg-accent text-accent-foreground hover:bg-accent/90 gap-1.5" onClick={handleImport} disabled={importMut.isPending}>
            {importMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
            {importMut.isPending ? "Importing..." : "Import"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ═════════════════════════════════════════════════════════════════
// MAIN DOCUMENTS COMPONENT
// ═════════════════════════════════════════════════════════════════
export default function Documents() {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();

  // ─── State ──────────────────────────────────────────────────────
  const [uploading, setUploading] = useState(false);
  const [uploadCategory, setUploadCategory] = useState<string>("personal_docs");
  const [uploadVisibility, setUploadVisibility] = useState<VisibilityValue>("professional");
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [showUrlImport, setShowUrlImport] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [selectMode, setSelectMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterRecent, setFilterRecent] = useState(false);
  const [filterTag, setFilterTag] = useState<string>("all");
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [selectedDoc, setSelectedDoc] = useState<any>(null);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [versionUploadDoc, setVersionUploadDoc] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("files");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const archiveInputRef = useRef<HTMLInputElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const versionFileRef = useRef<HTMLInputElement>(null);

  // ─── Queries ────────────────────────────────────────────────────
  const docs = trpc.documents.list.useQuery();
  const allTags = trpc.documents.listTags.useQuery();
  const tagList = (allTags.data || []) as any[];

  // ─── Mutations ──────────────────────────────────────────────────
  const uploadDoc = trpc.documents.upload.useMutation({
    onSuccess: (r) => {
      utils.documents.list.invalidate();
      utils.documents.processingStats.invalidate();
      if (r.wasAutoClassified) {
        const catLabel = CATEGORIES.find(c => c.value === r.category)?.label || r.category;
        toast.success(`Uploaded — AI classified as "${catLabel}"`);
      } else {
        toast.success("Document uploaded");
      }
    },
    onError: (e) => toast.error(e.message),
  });
  const deleteDoc = trpc.documents.delete.useMutation({
    onSuccess: () => { utils.documents.list.invalidate(); utils.documents.processingStats.invalidate(); toast.success("Document deleted"); },
  });
  const updateVis = trpc.documents.updateVisibility.useMutation({
    onSuccess: () => { utils.documents.list.invalidate(); toast.success("Visibility updated"); },
  });
  const updateCat = trpc.documents.updateCategory.useMutation({
    onSuccess: () => { utils.documents.list.invalidate(); toast.success("Category updated"); },
  });
  const renameMut = trpc.documents.rename.useMutation({
    onSuccess: () => { utils.documents.list.invalidate(); setRenamingId(null); toast.success("Renamed"); },
  });
  const reorderMut = trpc.documents.reorder.useMutation({
    onSuccess: () => utils.documents.list.invalidate(),
  });
  const bulkDeleteMut = trpc.documents.bulkDelete.useMutation({
    onSuccess: (r) => { utils.documents.list.invalidate(); utils.documents.processingStats.invalidate(); toast.success(`${r.deleted} document(s) deleted`); setSelectedIds(new Set()); setSelectMode(false); setShowBulkDeleteConfirm(false); },
  });
  const bulkVisMut = trpc.documents.bulkUpdateVisibility.useMutation({
    onSuccess: (r) => { utils.documents.list.invalidate(); toast.success(`${r.updated} document(s) updated`); setSelectedIds(new Set()); setSelectMode(false); },
  });
  const bulkCatMut = trpc.documents.bulkUpdateCategory.useMutation({
    onSuccess: (r) => { utils.documents.list.invalidate(); toast.success(`${r.updated} document(s) moved`); setSelectedIds(new Set()); setSelectMode(false); },
  });
  const reprocessMut = trpc.documents.reprocess.useMutation({
    onSuccess: () => { utils.documents.list.invalidate(); utils.documents.processingStats.invalidate(); toast.success("Document reprocessing started"); },
    onError: (e) => toast.error(e.message),
  });
  const uploadVersionMut = trpc.documents.uploadNewVersion.useMutation({
    onSuccess: (r) => { utils.documents.list.invalidate(); utils.documents.processingStats.invalidate(); toast.success(`New version (v${r.version}) uploaded`); setVersionUploadDoc(null); },
    onError: (e) => toast.error(e.message),
  });
  const autoTagMut = trpc.documents.autoTag.useMutation({
    onSuccess: (r) => {
      utils.documents.listTags.invalidate();
      toast.success(`AI suggested ${r.suggestedTags.length} tag(s): ${r.suggestedTags.join(", ")}`);
    },
    onError: (e) => toast.error(e.message),
  });
  const uploadArchiveMut = trpc.documents.uploadArchive.useMutation({
    onSuccess: (r) => {
      utils.documents.list.invalidate();
      utils.documents.processingStats.invalidate();
      toast.success(`Archive: ${r.imported} imported, ${r.failed} failed of ${r.extracted} files`);
    },
    onError: (e) => toast.error(e.message),
  });

  // ─── Filtered documents ──────────────────────────────────────
  const recentCount = useMemo(() => {
    return (docs.data || []).filter((d: any) => isRecentlyAdded(d.createdAt)).length;
  }, [docs.data]);

  const filteredDocs = useMemo(() => {
    let result = docs.data || [];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((d: any) => d.filename.toLowerCase().includes(q));
    }
    if (filterCategory !== "all") result = result.filter((d: any) => d.category === filterCategory);
    if (filterStatus !== "all") result = result.filter((d: any) => d.status === filterStatus);
    if (filterRecent) result = result.filter((d: any) => isRecentlyAdded(d.createdAt));
    return result;
  }, [docs.data, searchQuery, filterCategory, filterStatus, filterRecent]);

  const docsByCategory = useMemo(() => {
    return filteredDocs.reduce((acc: Record<string, any[]>, doc: any) => {
      const cat = doc.category || "personal_docs";
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(doc);
      return acc;
    }, {});
  }, [filteredDocs]);

  const totalDocs = docs.data?.length || 0;
  const readyDocs = docs.data?.filter((d: any) => d.status === "ready").length || 0;
  const errorDocs = docs.data?.filter((d: any) => d.status === "error").length || 0;
  const hasSelection = selectedIds.size > 0;
  const allFilteredSelected = filteredDocs.length > 0 && filteredDocs.every((d: any) => selectedIds.has(d.id));

  // ─── Handlers ────────────────────────────────────────────────
  const processFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;
    setUploading(true);
    let completed = 0;
    for (const file of fileArray) {
      // Check if it's an archive
      if (/\.(zip)$/i.test(file.name)) {
        if (file.size > 100 * 1024 * 1024) { toast.error(`${file.name} exceeds 100MB archive limit`); continue; }
        try {
          const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve((reader.result as string).split(",")[1]);
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });
          await uploadArchiveMut.mutateAsync({ filename: file.name, content: base64, mimeType: file.type, category: uploadCategory });
          completed++;
        } catch { toast.error(`Failed to process archive ${file.name}`); }
        continue;
      }
      if (file.size > 31 * 1024 * 1024) { toast.error(`${file.name} exceeds 31MB limit`); continue; }
      try {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve((reader.result as string).split(",")[1]);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        await uploadDoc.mutateAsync({
          filename: file.name, content: base64, mimeType: file.type,
          category: uploadCategory as any, visibility: uploadVisibility as any,
        });
        completed++;
      } catch { toast.error(`Failed to upload ${file.name}`); }
    }
    setUploading(false);
    if (completed > 0 && fileArray.length > 1) toast.success(`${completed}/${fileArray.length} files uploaded`);
    setShowUploadDialog(false);
  }, [uploadDoc, uploadArchiveMut, uploadCategory, uploadVisibility]);

  const handleVersionUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !versionUploadDoc) return;
    if (file.size > 31 * 1024 * 1024) { toast.error("File exceeds 31MB limit"); return; }
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve((reader.result as string).split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    uploadVersionMut.mutate({ documentId: versionUploadDoc.id, filename: file.name, content: base64, mimeType: file.type });
    if (versionFileRef.current) versionFileRef.current.value = "";
  }, [versionUploadDoc, uploadVersionMut]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) processFiles(e.target.files);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setDragOver(true); }, []);
  const handleDragLeave = useCallback((e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setDragOver(false); }, []);
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setDragOver(false);
    if (e.dataTransfer.files.length > 0) { setShowUploadDialog(true); setTimeout(() => processFiles(e.dataTransfer.files), 100); }
  }, [processFiles]);

  const toggleSelect = (id: number) => { setSelectedIds(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; }); };
  const toggleSelectAll = () => { if (allFilteredSelected) setSelectedIds(new Set()); else setSelectedIds(new Set(filteredDocs.map((d: any) => d.id))); };

  const startRename = (doc: any) => { setRenamingId(doc.id); setRenameValue(doc.filename); setTimeout(() => renameInputRef.current?.focus(), 50); };
  const submitRename = () => { if (renamingId && renameValue.trim()) renameMut.mutate({ id: renamingId, filename: renameValue.trim() }); else setRenamingId(null); };

  useEffect(() => { if (renamingId) renameInputRef.current?.select(); }, [renamingId]);

  const handleDragEnd = useCallback((event: DragEndEvent, _cat: string, sortedDocs: any[]) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = sortedDocs.findIndex((d: any) => d.id === active.id);
    const newIndex = sortedDocs.findIndex((d: any) => d.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(sortedDocs, oldIndex, newIndex);
    reorderMut.mutate({ updates: reordered.map((doc: any, idx: number) => ({ id: doc.id, sortOrder: idx })) });
    toast.success("Order saved — AI will prioritize higher-ranked documents");
  }, [reorderMut]);

  const handleAutoTag = (docId: number) => { autoTagMut.mutate({ documentId: docId }); };

  const visIconFn = (v: string) => {
    if (v === "private") return <Lock className="w-3 h-3 text-muted-foreground" />;
    if (v === "professional") return <Users className="w-3 h-3 text-blue-400" />;
    if (v === "management") return <Shield className="w-3 h-3 text-amber-400" />;
    return <Eye className="w-3 h-3 text-emerald-400" />;
  };
  const visLabelFn = (v: string) => VISIBILITY_OPTIONS.find(o => o.value === v)?.label || v;
  const catMetaFn = (v: string) => CATEGORIES.find(c => c.value === v);
  const isBulkLoading = bulkDeleteMut.isPending || bulkVisMut.isPending || bulkCatMut.isPending;
  const hasActiveFilters = searchQuery || filterCategory !== "all" || filterStatus !== "all" || filterRecent || filterTag !== "all";

  // ─── Render ──────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background" onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
      {/* Drag overlay */}
      {dragOver && (
        <div className="fixed inset-0 z-[100] bg-accent/10 backdrop-blur-sm flex items-center justify-center pointer-events-none">
          <div className="bg-card border-2 border-dashed border-accent rounded-2xl p-12 text-center shadow-2xl">
            <CloudUpload className="w-16 h-16 text-accent mx-auto mb-4" />
            <p className="text-lg font-semibold">Drop files to upload</p>
            <p className="text-sm text-muted-foreground mt-1">Supports 30+ file types including ZIP archives</p>
          </div>
        </div>
      )}

      {/* Sticky header */}
      <div className="border-b border-border bg-card/30 backdrop-blur-sm sticky top-0 z-50 relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(ellipse at 20% 50%, oklch(0.76 0.14 80 / 0.15) 0%, transparent 70%)' }} />
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3 relative">
          <Button variant="ghost" size="icon-sm" onClick={() => navigate("/")}><ArrowLeft className="w-4 h-4" /></Button>
          <Sparkles className="w-4 h-4 text-accent" />
          <span className="font-semibold text-sm">Knowledge Base</span>
          {totalDocs > 0 && <Badge variant="secondary" className="text-[10px]">{readyDocs}/{totalDocs} ready</Badge>}
          {errorDocs > 0 && <Badge variant="secondary" className="text-[10px] bg-red-500/10 text-red-400 border-red-500/20">{errorDocs} failed</Badge>}
          <div className="ml-auto flex items-center gap-2">
            {totalDocs > 0 && (
              <Button variant={selectMode ? "default" : "outline"} size="sm" className="text-xs gap-1.5 h-8"
                onClick={() => { setSelectMode(!selectMode); setSelectedIds(new Set()); }}>
                <CheckSquare className="w-3.5 h-3.5" />{selectMode ? "Done" : "Select"}
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90 text-xs gap-1.5 h-8">
                  <Upload className="w-3.5 h-3.5" /> Upload <ChevronDown className="w-3 h-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setShowUploadDialog(true)} className="text-xs gap-2"><Upload className="w-3 h-3" /> Upload Files</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowUrlImport(true)} className="text-xs gap-2"><Globe className="w-3 h-3" /> Import from URLs</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setShowUploadDialog(true)} className="text-xs gap-2"><Archive className="w-3 h-3" /> Upload ZIP Archive</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Bulk actions toolbar */}
      {selectMode && hasSelection && (
        <div className="sticky top-14 z-40 border-b border-accent/20 bg-accent/5 backdrop-blur-sm">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 h-12 flex items-center gap-3">
            <Checkbox checked={allFilteredSelected} onCheckedChange={toggleSelectAll} className="mr-1" />
            <span className="text-xs font-medium text-accent">{selectedIds.size} selected</span>
            <div className="flex items-center gap-1.5 ml-auto">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="text-xs h-8 gap-1" disabled={isBulkLoading}><ShieldCheck className="w-3.5 h-3.5" /> Visibility</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {VISIBILITY_OPTIONS.map(v => (
                    <DropdownMenuItem key={v.value} onClick={() => bulkVisMut.mutate({ ids: Array.from(selectedIds), visibility: v.value as any })}>
                      <span className="flex items-center gap-2 text-xs">{v.icon} {v.label} <span className="text-muted-foreground">— {v.desc}</span></span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="text-xs h-8 gap-1" disabled={isBulkLoading}><FolderInput className="w-3.5 h-3.5" /> Move</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {CATEGORIES.map(c => (
                    <DropdownMenuItem key={c.value} onClick={() => bulkCatMut.mutate({ ids: Array.from(selectedIds), category: c.value as any })}>
                      <span className="flex items-center gap-2 text-xs">{c.icon} {c.shortLabel}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <Button variant="outline" size="sm" className="text-xs h-8 gap-1 text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/10"
                disabled={isBulkLoading} onClick={() => setShowBulkDeleteConfirm(true)}>
                {bulkDeleteMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />} Delete
              </Button>
              <Button variant="ghost" size="sm" className="text-xs h-8 gap-1" onClick={() => setSelectedIds(new Set())}><XSquare className="w-3.5 h-3.5" /></Button>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-4">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="h-9">
            <TabsTrigger value="files" className="text-xs gap-1.5">
              <FileText className="w-3.5 h-3.5" /> Files
              {totalDocs > 0 && <Badge variant="secondary" className="text-[9px] ml-0.5">{totalDocs}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="dashboard" className="text-xs gap-1.5"><BarChart3 className="w-3.5 h-3.5" /> Dashboard</TabsTrigger>
            <TabsTrigger value="tags" className="text-xs gap-1.5"><Tags className="w-3.5 h-3.5" /> Tags</TabsTrigger>
            <TabsTrigger value="gaps" className="text-xs gap-1.5"><Brain className="w-3.5 h-3.5" /> Gap Analysis</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="mt-4"><ProcessingDashboard /></TabsContent>
          <TabsContent value="tags" className="mt-4"><TagManagementPanel /></TabsContent>
          <TabsContent value="gaps" className="mt-4"><GapAnalysisPanel /></TabsContent>

          <TabsContent value="files" className="mt-0">
            {/* Search & filter bar */}
            {totalDocs > 0 && (
              <div className="pt-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <Input placeholder="Search files..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 h-9 text-xs bg-card" />
                    {searchQuery && <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2"><X className="w-3 h-3 text-muted-foreground hover:text-foreground" /></button>}
                  </div>
                  <Select value={filterCategory} onValueChange={setFilterCategory}>
                    <SelectTrigger className="w-[140px] h-9 text-xs bg-card"><Filter className="w-3 h-3 mr-1 text-muted-foreground" /><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}><span className="flex items-center gap-1.5">{c.icon} {c.shortLabel}</span></SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="w-[120px] h-9 text-xs bg-card"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="ready">Ready</SelectItem>
                      <SelectItem value="processing">Processing</SelectItem>
                      <SelectItem value="error">Error</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant={filterRecent ? "default" : "outline"} size="sm"
                    className={`text-xs h-9 gap-1.5 ${filterRecent ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""}`}
                    onClick={() => setFilterRecent(!filterRecent)}>
                    <Zap className="w-3 h-3" /> Recent
                    {recentCount > 0 && <Badge variant="secondary" className={`text-[9px] ml-0.5 ${filterRecent ? "bg-white/20 text-white" : "bg-emerald-500/10 text-emerald-400"}`}>{recentCount}</Badge>}
                  </Button>
                  {hasActiveFilters && (
                    <Button variant="ghost" size="sm" className="text-xs h-9"
                      onClick={() => { setSearchQuery(""); setFilterCategory("all"); setFilterStatus("all"); setFilterRecent(false); setFilterTag("all"); }}>
                      Clear filters
                    </Button>
                  )}
                </div>
                {filteredDocs.length !== totalDocs && (
                  <p className="text-[10px] text-muted-foreground mt-1.5">Showing {filteredDocs.length} of {totalDocs} files{filterRecent && " (last 7 days)"}</p>
                )}
              </div>
            )}

            {/* Document list */}
            <div className="py-4 space-y-5">
              {filteredDocs.length > 0 ? (
                Object.entries(docsByCategory).map(([cat, catDocs]) => (
                  <SortableCategoryGroup
                    key={cat} cat={cat} catDocs={catDocs} catMeta={catMetaFn}
                    selectMode={selectMode} selectedIds={selectedIds}
                    renamingId={renamingId} renameValue={renameValue} renameInputRef={renameInputRef}
                    onToggleSelect={toggleSelect} onStartRename={startRename} onRenameChange={setRenameValue}
                    onSubmitRename={submitRename} onCancelRename={() => setRenamingId(null)}
                    onViewDetails={setSelectedDoc}
                    onUpdateVis={(id: number, v: string) => updateVis.mutate({ id, visibility: v as any })}
                    onUpdateCat={(id: number, c: string) => updateCat.mutate({ id, category: c as any })}
                    onDelete={(id: number) => deleteDoc.mutate({ id })}
                    onReprocess={(id: number) => reprocessMut.mutate({ id })}
                    onUploadNewVersion={(doc: any) => setVersionUploadDoc(doc)}
                    onAutoTag={handleAutoTag}
                    onDragEnd={handleDragEnd} visIcon={visIconFn} visLabel={visLabelFn}
                  />
                ))
              ) : totalDocs > 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                  <Search className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No files match your filters</p>
                  <Button variant="link" size="sm" className="text-xs mt-1" onClick={() => { setSearchQuery(""); setFilterCategory("all"); setFilterStatus("all"); setFilterRecent(false); setFilterTag("all"); }}>Clear all filters</Button>
                </div>
              ) : (
                <div className="text-center py-20 text-muted-foreground border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-accent/30 transition-colors" onClick={() => setShowUploadDialog(true)}>
                  <CloudUpload className="w-14 h-14 mx-auto mb-4 opacity-30" />
                  <p className="text-base font-medium">Drop files here or click to upload</p>
                  <p className="text-xs mt-1.5 max-w-md mx-auto">Supports 30+ file types: PDF, DOCX, XLSX, PPTX, RTF, EPUB, CSV, JSON, code files, ZIP archives, and more.</p>
                  <p className="text-[10px] mt-2 flex items-center justify-center gap-1 text-muted-foreground/60"><Shield className="w-3 h-3" /> Encrypted at rest & in transit</p>
                  <div className="flex items-center justify-center gap-2 mt-4">
                    <Button className="bg-accent text-accent-foreground hover:bg-accent/90 text-sm gap-1.5" onClick={(e) => { e.stopPropagation(); setShowUploadDialog(true); }}>
                      <Upload className="w-4 h-4" /> Upload Files
                    </Button>
                    <Button variant="outline" className="text-sm gap-1.5" onClick={(e) => { e.stopPropagation(); setShowUrlImport(true); }}>
                      <Globe className="w-4 h-4" /> Import URLs
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Upload Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base">Upload to Knowledge Base</DialogTitle>
            <DialogDescription className="text-xs">
              Supports 30+ file types including PDF, DOCX, XLSX, PPTX, RTF, EPUB, CSV, JSON, code files, and ZIP archives. Max 31MB per file (100MB for ZIP). AI auto-classifies category if left as default.
            </DialogDescription>
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/70 mt-1"><Shield className="w-3 h-3 text-accent/50" /> Files are encrypted at rest and in transit</div>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Category <span className="text-accent">(AI auto-classifies if unsure)</span></p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                {CATEGORIES.map(c => (
                  <button key={c.value} onClick={() => setUploadCategory(c.value)}
                    className={`text-left p-2.5 rounded-lg border transition-all text-xs ${uploadCategory === c.value ? "border-accent/50 bg-accent/5" : "border-border hover:border-accent/20"}`}>
                    <div className="flex items-center gap-1.5"><span className="text-accent">{c.icon}</span><span className="font-medium">{c.shortLabel}</span></div>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Visibility</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {VISIBILITY_OPTIONS.map(v => (
                  <button key={v.value} onClick={() => setUploadVisibility(v.value as VisibilityValue)}
                    className={`text-left p-2 rounded-lg border transition-all text-xs ${uploadVisibility === v.value ? "border-accent/50 bg-accent/5" : "border-border hover:border-accent/20"}`}>
                    <div className="flex items-center gap-1.5">{v.icon}<span className="font-medium">{v.label}</span></div>
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelect} accept={SUPPORTED_FILE_ACCEPT} multiple />
            <Button variant="outline" onClick={() => setShowUploadDialog(false)} disabled={uploading}>Cancel</Button>
            <Button className="bg-accent text-accent-foreground hover:bg-accent/90 gap-1.5" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {uploading ? "Uploading..." : "Choose Files"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* URL Import Dialog */}
      <UrlImportDialog open={showUrlImport} onClose={() => setShowUrlImport(false)} />

      {/* Bulk Delete Confirmation */}
      <Dialog open={showBulkDeleteConfirm} onOpenChange={setShowBulkDeleteConfirm}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">Delete {selectedIds.size} file(s)?</DialogTitle>
            <DialogDescription className="text-xs">This will permanently remove the selected files and their AI training data. This cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowBulkDeleteConfirm(false)} disabled={bulkDeleteMut.isPending}>Cancel</Button>
            <Button variant="destructive" onClick={() => bulkDeleteMut.mutate({ ids: Array.from(selectedIds) })} disabled={bulkDeleteMut.isPending} className="gap-1.5">
              {bulkDeleteMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} Delete {selectedIds.size} file(s)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Version Upload Dialog */}
      <Dialog open={!!versionUploadDoc} onOpenChange={() => setVersionUploadDoc(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2"><History className="w-4 h-4 text-accent" /> Upload New Version</DialogTitle>
            <DialogDescription className="text-xs">Replace "{versionUploadDoc?.filename}" with an updated file. The current version will be saved in history.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Card className="bg-secondary/30 border-border">
              <CardContent className="p-3">
                <p className="text-xs font-medium">{versionUploadDoc?.filename}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Current: {versionUploadDoc?.chunkCount || 0} chunks · {versionUploadDoc?.status}</p>
              </CardContent>
            </Card>
            <input ref={versionFileRef} type="file" className="hidden" onChange={handleVersionUpload} accept={SUPPORTED_FILE_ACCEPT} />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setVersionUploadDoc(null)} disabled={uploadVersionMut.isPending}>Cancel</Button>
            <Button className="bg-accent text-accent-foreground hover:bg-accent/90 gap-1.5" onClick={() => versionFileRef.current?.click()} disabled={uploadVersionMut.isPending}>
              {uploadVersionMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {uploadVersionMut.isPending ? "Uploading..." : "Choose New File"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Document Details Dialog */}
      <Dialog open={!!selectedDoc} onOpenChange={() => setSelectedDoc(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-sm">{selectedDoc?.filename}</DialogTitle>
            <DialogDescription className="text-xs">Document insights, tags, content preview, and version history</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Status", value: <span className="flex items-center gap-1">{STATUS_MAP[selectedDoc?.status]?.icon}{STATUS_MAP[selectedDoc?.status]?.label || "Unknown"}</span> },
                { label: "Chunks", value: selectedDoc?.chunkCount || 0 },
                { label: "Category", value: catMetaFn(selectedDoc?.category)?.label || selectedDoc?.category },
                { label: "Visibility", value: <span className="flex items-center gap-1">{visIconFn(selectedDoc?.visibility || "professional")} {visLabelFn(selectedDoc?.visibility || "professional")}</span> },
              ].map(item => (
                <div key={item.label} className="p-3 rounded-lg bg-secondary/50">
                  <p className="text-[10px] text-muted-foreground">{item.label}</p>
                  <p className="text-xs font-medium">{item.value}</p>
                </div>
              ))}
            </div>

            {/* Tags section */}
            {selectedDoc && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-xs font-medium flex items-center gap-1"><Tag className="w-3 h-3 text-accent" /> Tags</p>
                  <Button variant="outline" size="sm" className="text-[10px] h-6 gap-1" onClick={() => handleAutoTag(selectedDoc.id)} disabled={autoTagMut.isPending}>
                    {autoTagMut.isPending ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Sparkles className="w-2.5 h-2.5" />} AI Auto-Tag
                  </Button>
                </div>
                <DocTagPills docId={selectedDoc.id} />
              </div>
            )}

            {selectedDoc?.status === "error" && (
              <Button variant="outline" size="sm" className="w-full text-xs gap-1.5 border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                onClick={() => { reprocessMut.mutate({ id: selectedDoc.id }); setSelectedDoc(null); }} disabled={reprocessMut.isPending}>
                <RefreshCw className="w-3.5 h-3.5" /> Retry Processing
              </Button>
            )}

            {/* Inline Document Preview */}
            {selectedDoc?.fileUrl && (() => {
              const mime = selectedDoc.mimeType || "";
              const isImage = mime.startsWith("image/");
              const isPdf = mime === "application/pdf" || selectedDoc.filename?.endsWith(".pdf");
              return (
                <div>
                  <p className="text-xs font-medium mb-1.5 flex items-center gap-1"><Eye className="w-3 h-3 text-accent" /> Document Preview</p>
                  {isImage ? (
                    <div className="rounded-lg border border-border overflow-hidden bg-black/20">
                      <img src={selectedDoc.fileUrl} alt={selectedDoc.filename} className="w-full max-h-72 object-contain" />
                    </div>
                  ) : isPdf ? (
                    <div className="rounded-lg border border-border overflow-hidden bg-muted/30">
                      <iframe src={`${selectedDoc.fileUrl}#toolbar=0&navpanes=0`} className="w-full h-72 border-0" title="PDF Preview" />
                    </div>
                  ) : null}
                </div>
              );
            })()}

            {selectedDoc?.extractedText && (
              <div>
                <p className="text-xs font-medium mb-1">Extracted Content</p>
                <div className="p-3 rounded-lg bg-secondary/30 text-xs text-muted-foreground max-h-48 overflow-y-auto whitespace-pre-wrap font-mono">
                  {selectedDoc.extractedText.substring(0, 2000)}
                  {selectedDoc.extractedText.length > 2000 && "..."}
                </div>
              </div>
            )}

            {selectedDoc?.fileUrl && (
              <a href={selectedDoc.fileUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs text-accent hover:underline">
                <FileUp className="w-3 h-3" /> Download original file
              </a>
            )}

            {selectedDoc && (
              <div className="border-t border-border pt-4">
                <VersionHistoryPanel doc={selectedDoc} onUploadNewVersion={(doc: any) => { setSelectedDoc(null); setVersionUploadDoc(doc); }} />
              </div>
            )}

            {/* Collaborative Annotations */}
            {selectedDoc && <AnnotationsPanel documentId={selectedDoc.id} />}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ─── Annotations Panel (collaborative) ─────────────────────────── */
function AnnotationsPanel({ documentId }: { documentId: number }) {
  const [newComment, setNewComment] = useState("");
  const [annotationType, setAnnotationType] = useState<"comment" | "question" | "action_item">("comment");
  const annotationsQ = trpc.documents.listAnnotations.useQuery({ documentId });
  const addMut = trpc.documents.addAnnotation.useMutation({
    onSuccess: () => { annotationsQ.refetch(); setNewComment(""); toast.success("Annotation added"); },
    onError: (e) => toast.error(e.message),
  });
  const resolveMut = trpc.documents.resolveAnnotation.useMutation({
    onSuccess: () => { annotationsQ.refetch(); toast.success("Resolved"); },
  });
  const deleteMut = trpc.documents.deleteAnnotation.useMutation({
    onSuccess: () => { annotationsQ.refetch(); toast.success("Deleted"); },
  });

  const typeIcon = (t: string) => {
    if (t === "question") return <MessageSquare className="w-3 h-3 text-blue-400" />;
    if (t === "action_item") return <CheckSquare className="w-3 h-3 text-amber-400" />;
    if (t === "ai_insight") return <Brain className="w-3 h-3 text-purple-400" />;
    if (t === "highlight") return <Sparkles className="w-3 h-3 text-yellow-400" />;
    return <MessageSquare className="w-3 h-3 text-muted-foreground" />;
  };

  return (
    <div className="border-t border-border pt-4 mt-2">
      <p className="text-xs font-medium mb-2 flex items-center gap-1">
        <MessageSquare className="w-3 h-3 text-accent" /> Annotations
        {annotationsQ.data && annotationsQ.data.length > 0 && (
          <Badge variant="secondary" className="text-[9px] ml-1">{annotationsQ.data.length}</Badge>
        )}
      </p>

      {/* Existing annotations */}
      <div className="space-y-2 mb-3 max-h-48 overflow-y-auto">
        {annotationsQ.data?.map((ann: any) => (
          <div key={ann.id} className={`p-2 rounded-lg text-xs ${ann.resolved ? "bg-green-500/5 border border-green-500/20" : "bg-secondary/30 border border-border"}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-1.5 flex-1 min-w-0">
                {typeIcon(ann.annotationType)}
                <div className="flex-1 min-w-0">
                  <p className={`${ann.resolved ? "line-through text-muted-foreground" : ""}`}>{ann.content}</p>
                  {ann.highlightText && (
                    <p className="text-[10px] text-accent/70 mt-0.5 italic">"{ann.highlightText}"</p>
                  )}
                  <p className="text-[9px] text-muted-foreground mt-0.5">
                    {new Date(ann.createdAt).toLocaleDateString()} · {ann.annotationType}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-0.5 shrink-0">
                {!ann.resolved && (
                  <Button variant="ghost" size="icon" className="w-5 h-5" aria-label="Resolve annotation" onClick={() => resolveMut.mutate({ id: ann.id })}>
                    <CheckCircle2 className="w-3 h-3 text-green-500" />
                  </Button>
                )}
                <Button variant="ghost" size="icon" className="w-5 h-5" aria-label="Delete annotation" onClick={() => deleteMut.mutate({ id: ann.id })}>
                  <Trash2 className="w-3 h-3 text-destructive" />
                </Button>
              </div>
            </div>
          </div>
        ))}
        {annotationsQ.data?.length === 0 && (
          <p className="text-[10px] text-muted-foreground text-center py-2">No annotations yet. Add the first one below.</p>
        )}
      </div>

      {/* Add new annotation */}
      <div className="flex gap-2">
        <Select value={annotationType} onValueChange={(v: any) => setAnnotationType(v)}>
          <SelectTrigger className="w-28 h-7 text-[10px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="comment">Comment</SelectItem>
            <SelectItem value="question">Question</SelectItem>
            <SelectItem value="action_item">Action Item</SelectItem>
          </SelectContent>
        </Select>
        <Input
          placeholder="Add annotation..."
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          className="h-7 text-xs flex-1"
          onKeyDown={(e) => {
            if (e.key === "Enter" && newComment.trim()) {
              addMut.mutate({ documentId, content: newComment, annotationType });
            }
          }}
        />
        <Button
          size="sm"
          className="h-7 text-[10px] px-2"
          disabled={!newComment.trim() || addMut.isPending}
          onClick={() => addMut.mutate({ documentId, content: newComment, annotationType })}
        >
          {addMut.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
        </Button>
      </div>
    </div>
  );
}
