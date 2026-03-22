import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { useLocation } from "wouter";
import {
  ArrowLeft, Upload, FileText, Trash2, Loader2, Sparkles,
  CheckCircle, AlertCircle, Clock, BookOpen, Briefcase,
  GraduationCap, FileCode, ScrollText, FolderOpen,
  Eye, Shield, Users, Lock, Search, X, MoreHorizontal,
  Pencil, FolderInput, ShieldCheck, CheckSquare, XSquare,
  CloudUpload, FileUp, Filter, GripVertical, Zap,
} from "lucide-react";
import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
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

type CategoryValue = typeof CATEGORIES[number]["value"];
type VisibilityValue = typeof VISIBILITY_OPTIONS[number]["value"];

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function isRecentlyAdded(createdAt: string | Date): boolean {
  const created = typeof createdAt === "string" ? new Date(createdAt) : createdAt;
  return Date.now() - created.getTime() < SEVEN_DAYS_MS;
}

// ─── Sortable Document Row ──────────────────────────────────────
function SortableDocRow({
  doc, selectMode, isSelected, isRenaming, renameValue, renameInputRef,
  onToggleSelect, onStartRename, onRenameChange, onSubmitRename, onCancelRename,
  onViewDetails, onUpdateVis, onUpdateCat, onDelete, visIcon, visLabel, catMeta,
}: any) {
  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
  } = useSortable({ id: doc.id, disabled: selectMode });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  const status = STATUS_MAP[doc.status] || STATUS_MAP.error;
  const recent = isRecentlyAdded(doc.createdAt);

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={`bg-card border transition-all ${
        isSelected ? "border-accent/50 bg-accent/5" : recent ? "border-emerald-500/20 bg-emerald-500/[0.02]" : "border-border hover:border-border/80"
      } ${isDragging ? "shadow-lg" : ""}`}
    >
      <CardContent className="flex items-center gap-2 py-2.5 px-3">
        {/* Drag handle */}
        {!selectMode && (
          <button
            className="shrink-0 cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground touch-none"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="w-4 h-4" />
          </button>
        )}

        {/* Checkbox (select mode) */}
        {selectMode && (
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => onToggleSelect(doc.id)}
            className="shrink-0"
          />
        )}

        {/* File icon */}
        <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center shrink-0">
          <FileText className="w-3.5 h-3.5 text-muted-foreground" />
        </div>

        {/* Name + metadata */}
        <div className="flex-1 min-w-0">
          {isRenaming ? (
            <div className="flex items-center gap-1.5">
              <Input
                ref={renameInputRef}
                value={renameValue}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => onRenameChange(e.target.value)}
                onKeyDown={(e: React.KeyboardEvent) => {
                  if (e.key === "Enter") onSubmitRename();
                  if (e.key === "Escape") onCancelRename();
                }}
                onBlur={onSubmitRename}
                className="h-7 text-sm py-0"
                autoFocus
              />
            </div>
          ) : (
            <p
              className="text-sm font-medium truncate cursor-default"
              onDoubleClick={() => onStartRename(doc)}
              title="Double-click to rename"
            >
              {doc.filename}
            </p>
          )}
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className={`inline-flex items-center gap-1 text-[10px] ${status.color}`}>
              {status.icon} {status.label}
            </span>
            {doc.chunkCount > 0 && (
              <span className="text-[10px] text-muted-foreground">
                {doc.chunkCount} chunks
              </span>
            )}
            <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
              {visIcon(doc.visibility || "professional")} {visLabel(doc.visibility || "professional")}
            </span>
            {recent && (
              <Badge variant="secondary" className="text-[9px] bg-emerald-500/10 text-emerald-400 border-emerald-500/20 gap-0.5 py-0">
                <Zap className="w-2.5 h-2.5" /> New
              </Badge>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-0.5 shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem onClick={() => onStartRename(doc)}>
                <Pencil className="w-3.5 h-3.5 mr-2" /> Rename
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onViewDetails(doc)}>
                <FileText className="w-3.5 h-3.5 mr-2" /> View Details
              </DropdownMenuItem>
              {doc.fileUrl && (
                <DropdownMenuItem onClick={() => window.open(doc.fileUrl, "_blank")}>
                  <FileUp className="w-3.5 h-3.5 mr-2" /> Download Original
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <ShieldCheck className="w-3.5 h-3.5 mr-2" /> Visibility
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  {VISIBILITY_OPTIONS.map(v => (
                    <DropdownMenuItem key={v.value} onClick={() => onUpdateVis(doc.id, v.value)}>
                      <span className="flex items-center gap-2 text-xs">
                        {v.icon} {v.label}
                        {doc.visibility === v.value && <CheckCircle className="w-3 h-3 text-accent ml-auto" />}
                      </span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <FolderInput className="w-3.5 h-3.5 mr-2" /> Move to
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  {CATEGORIES.map(c => (
                    <DropdownMenuItem key={c.value} onClick={() => onUpdateCat(doc.id, c.value)}>
                      <span className="flex items-center gap-2 text-xs">
                        {c.icon} {c.shortLabel}
                        {doc.category === c.value && <CheckCircle className="w-3 h-3 text-accent ml-auto" />}
                      </span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => onDelete(doc.id)}>
                <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Sortable Category Group ────────────────────────────────────
function SortableCategoryGroup({
  cat, catDocs, catMeta: catMetaFn, selectMode, selectedIds, renamingId, renameValue, renameInputRef,
  onToggleSelect, onStartRename, onRenameChange, onSubmitRename, onCancelRename,
  onViewDetails, onUpdateVis, onUpdateCat, onDelete, onDragEnd,
  visIcon: visIconFn, visLabel: visLabelFn,
}: any) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const cm = catMetaFn(cat);
  const sortedDocs = [...catDocs].sort((a: any, b: any) => (a.sortOrder || 0) - (b.sortOrder || 0));
  const ids = sortedDocs.map((d: any) => d.id);
  const recentCount = sortedDocs.filter((d: any) => isRecentlyAdded(d.createdAt)).length;

  return (
    <div>
      <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
        <span className="text-accent">{cm?.icon}</span>
        {cm?.label || cat.replace(/_/g, " ")}
        <Badge variant="secondary" className="text-[9px] ml-1">{catDocs.length}</Badge>
        {recentCount > 0 && (
          <Badge variant="secondary" className="text-[9px] bg-emerald-500/10 text-emerald-400 border-emerald-500/20 gap-0.5">
            <Zap className="w-2 h-2" /> {recentCount} new
          </Badge>
        )}
      </h3>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => onDragEnd(e, cat, sortedDocs)}>
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <div className="space-y-1.5">
            {sortedDocs.map((doc: any) => (
              <SortableDocRow
                key={doc.id}
                doc={doc}
                selectMode={selectMode}
                isSelected={selectedIds.has(doc.id)}
                isRenaming={renamingId === doc.id}
                renameValue={renameValue}
                renameInputRef={renameInputRef}
                onToggleSelect={onToggleSelect}
                onStartRename={onStartRename}
                onRenameChange={onRenameChange}
                onSubmitRename={onSubmitRename}
                onCancelRename={onCancelRename}
                onViewDetails={onViewDetails}
                onUpdateVis={onUpdateVis}
                onUpdateCat={onUpdateCat}
                onDelete={onDelete}
                visIcon={visIconFn}
                visLabel={visLabelFn}
                catMeta={catMetaFn}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────
export default function Documents() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();

  // Upload state
  const [uploading, setUploading] = useState(false);
  const [uploadCategory, setUploadCategory] = useState<CategoryValue>("personal_docs");
  const [uploadVisibility, setUploadVisibility] = useState<VisibilityValue>("professional");
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [selectMode, setSelectMode] = useState(false);

  // Filter/search state
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterRecent, setFilterRecent] = useState(false);

  // Inline rename state
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Detail dialog
  const [selectedDoc, setSelectedDoc] = useState<any>(null);

  // Confirm bulk delete dialog
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);

  // ─── Queries & Mutations ─────────────────────────────────────
  const docs = trpc.documents.list.useQuery();
  const uploadDoc = trpc.documents.upload.useMutation({
    onSuccess: () => { utils.documents.list.invalidate(); toast.success("Document uploaded — AI is learning from it"); },
    onError: (e) => toast.error(e.message),
  });
  const deleteDoc = trpc.documents.delete.useMutation({
    onSuccess: () => { utils.documents.list.invalidate(); toast.success("Document removed"); },
  });
  const updateVis = trpc.documents.updateVisibility.useMutation({
    onSuccess: () => { utils.documents.list.invalidate(); toast.success("Visibility updated"); },
  });
  const renameMut = trpc.documents.rename.useMutation({
    onSuccess: () => { utils.documents.list.invalidate(); toast.success("Renamed"); setRenamingId(null); },
    onError: (e) => toast.error(e.message),
  });
  const updateCat = trpc.documents.updateCategory.useMutation({
    onSuccess: () => { utils.documents.list.invalidate(); toast.success("Category updated"); },
  });
  const reorderMut = trpc.documents.reorder.useMutation({
    onSuccess: () => { utils.documents.list.invalidate(); },
    onError: () => toast.error("Failed to save order"),
  });
  const bulkDeleteMut = trpc.documents.bulkDelete.useMutation({
    onSuccess: (r) => {
      utils.documents.list.invalidate();
      toast.success(`${r.deleted} document(s) deleted`);
      setSelectedIds(new Set());
      setSelectMode(false);
      setShowBulkDeleteConfirm(false);
    },
  });
  const bulkVisMut = trpc.documents.bulkUpdateVisibility.useMutation({
    onSuccess: (r) => {
      utils.documents.list.invalidate();
      toast.success(`${r.updated} document(s) updated`);
      setSelectedIds(new Set());
      setSelectMode(false);
    },
  });
  const bulkCatMut = trpc.documents.bulkUpdateCategory.useMutation({
    onSuccess: (r) => {
      utils.documents.list.invalidate();
      toast.success(`${r.updated} document(s) moved`);
      setSelectedIds(new Set());
      setSelectMode(false);
    },
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
    if (filterCategory !== "all") {
      result = result.filter((d: any) => d.category === filterCategory);
    }
    if (filterStatus !== "all") {
      result = result.filter((d: any) => d.status === filterStatus);
    }
    if (filterRecent) {
      result = result.filter((d: any) => isRecentlyAdded(d.createdAt));
    }
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
  const hasSelection = selectedIds.size > 0;
  const allFilteredSelected = filteredDocs.length > 0 && filteredDocs.every((d: any) => selectedIds.has(d.id));

  // ─── Handlers ────────────────────────────────────────────────
  const processFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;
    setUploading(true);
    let completed = 0;
    for (const file of fileArray) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`${file.name} exceeds 10MB limit`);
        continue;
      }
      try {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve((reader.result as string).split(",")[1]);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        await uploadDoc.mutateAsync({
          filename: file.name,
          content: base64,
          mimeType: file.type,
          category: uploadCategory as any,
          visibility: uploadVisibility as any,
        });
        completed++;
      } catch (e) {
        toast.error(`Failed to upload ${file.name}`);
      }
    }
    setUploading(false);
    if (completed > 0 && fileArray.length > 1) {
      toast.success(`${completed}/${fileArray.length} files uploaded`);
    }
    setShowUploadDialog(false);
  }, [uploadDoc, uploadCategory, uploadVisibility]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) processFiles(e.target.files);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      setShowUploadDialog(true);
      setTimeout(() => processFiles(e.dataTransfer.files), 100);
    }
  }, [processFiles]);

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredDocs.map((d: any) => d.id)));
    }
  };

  const startRename = (doc: any) => {
    setRenamingId(doc.id);
    setRenameValue(doc.filename);
    setTimeout(() => renameInputRef.current?.focus(), 50);
  };

  const submitRename = () => {
    if (renamingId && renameValue.trim()) {
      renameMut.mutate({ id: renamingId, filename: renameValue.trim() });
    } else {
      setRenamingId(null);
    }
  };

  useEffect(() => {
    if (renamingId) renameInputRef.current?.select();
  }, [renamingId]);

  const handleDragEnd = useCallback((event: DragEndEvent, _cat: string, sortedDocs: any[]) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = sortedDocs.findIndex((d: any) => d.id === active.id);
    const newIndex = sortedDocs.findIndex((d: any) => d.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(sortedDocs, oldIndex, newIndex);
    const updates = reordered.map((doc: any, idx: number) => ({ id: doc.id, sortOrder: idx }));
    reorderMut.mutate({ updates });
    toast.success("Order saved — AI will prioritize higher-ranked documents");
  }, [reorderMut]);

  const visIconFn = (v: string) => {
    if (v === "private") return <Lock className="w-3 h-3 text-muted-foreground" />;
    if (v === "professional") return <Users className="w-3 h-3 text-blue-400" />;
    if (v === "management") return <Shield className="w-3 h-3 text-amber-400" />;
    return <Eye className="w-3 h-3 text-emerald-400" />;
  };

  const visLabelFn = (v: string) => VISIBILITY_OPTIONS.find(o => o.value === v)?.label || v;
  const catMetaFn = (v: string) => CATEGORIES.find(c => c.value === v);

  const isBulkLoading = bulkDeleteMut.isPending || bulkVisMut.isPending || bulkCatMut.isPending;
  const hasActiveFilters = searchQuery || filterCategory !== "all" || filterStatus !== "all" || filterRecent;

  // ─── Render ──────────────────────────────────────────────────
  return (
    <div
      className="min-h-screen bg-background"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {dragOver && (
        <div className="fixed inset-0 z-[100] bg-accent/10 backdrop-blur-sm flex items-center justify-center pointer-events-none">
          <div className="bg-card border-2 border-dashed border-accent rounded-2xl p-12 text-center shadow-2xl">
            <CloudUpload className="w-16 h-16 text-accent mx-auto mb-4" />
            <p className="text-lg font-semibold">Drop files to upload</p>
            <p className="text-sm text-muted-foreground mt-1">They'll be added to your knowledge base</p>
          </div>
        </div>
      )}

      {/* Sticky header */}
      <div className="border-b border-border bg-card/30 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
          <Button variant="ghost" size="icon-sm" onClick={() => navigate("/")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <Sparkles className="w-4 h-4 text-accent" />
          <span className="font-semibold text-sm">Knowledge Base</span>
          {totalDocs > 0 && (
            <Badge variant="secondary" className="text-[10px]">
              {readyDocs}/{totalDocs} ready
            </Badge>
          )}
          <div className="ml-auto flex items-center gap-2">
            {totalDocs > 0 && (
              <Button
                variant={selectMode ? "default" : "outline"}
                size="sm"
                className="text-xs gap-1.5 h-8"
                onClick={() => { setSelectMode(!selectMode); setSelectedIds(new Set()); }}
              >
                <CheckSquare className="w-3.5 h-3.5" />
                {selectMode ? "Done" : "Select"}
              </Button>
            )}
            <Button
              size="sm"
              className="bg-accent text-accent-foreground hover:bg-accent/90 text-xs gap-1.5 h-8"
              onClick={() => setShowUploadDialog(true)}
            >
              <Upload className="w-3.5 h-3.5" />
              Upload
            </Button>
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
                  <Button variant="outline" size="sm" className="text-xs h-8 gap-1" disabled={isBulkLoading}>
                    <ShieldCheck className="w-3.5 h-3.5" /> Visibility
                  </Button>
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
                  <Button variant="outline" size="sm" className="text-xs h-8 gap-1" disabled={isBulkLoading}>
                    <FolderInput className="w-3.5 h-3.5" /> Move
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {CATEGORIES.map(c => (
                    <DropdownMenuItem key={c.value} onClick={() => bulkCatMut.mutate({ ids: Array.from(selectedIds), category: c.value as any })}>
                      <span className="flex items-center gap-2 text-xs">{c.icon} {c.shortLabel}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                variant="outline" size="sm"
                className="text-xs h-8 gap-1 text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/10"
                disabled={isBulkLoading}
                onClick={() => setShowBulkDeleteConfirm(true)}
              >
                {bulkDeleteMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                Delete
              </Button>
              <Button variant="ghost" size="sm" className="text-xs h-8 gap-1" onClick={() => setSelectedIds(new Set())}>
                <XSquare className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Search & filter bar */}
      {totalDocs > 0 && (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-4">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="Search files..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-xs bg-card"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2">
                  <X className="w-3 h-3 text-muted-foreground hover:text-foreground" />
                </button>
              )}
            </div>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-[140px] h-9 text-xs bg-card">
                <Filter className="w-3 h-3 mr-1 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {CATEGORIES.map(c => (
                  <SelectItem key={c.value} value={c.value}>
                    <span className="flex items-center gap-1.5">{c.icon} {c.shortLabel}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[120px] h-9 text-xs bg-card">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="ready">Ready</SelectItem>
                <SelectItem value="processing">Processing</SelectItem>
                <SelectItem value="error">Error</SelectItem>
              </SelectContent>
            </Select>
            {/* Recently Added toggle */}
            <Button
              variant={filterRecent ? "default" : "outline"}
              size="sm"
              className={`text-xs h-9 gap-1.5 ${filterRecent ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""}`}
              onClick={() => setFilterRecent(!filterRecent)}
            >
              <Zap className="w-3 h-3" />
              Recent
              {recentCount > 0 && (
                <Badge variant="secondary" className={`text-[9px] ml-0.5 ${filterRecent ? "bg-white/20 text-white" : "bg-emerald-500/10 text-emerald-400"}`}>
                  {recentCount}
                </Badge>
              )}
            </Button>
            {hasActiveFilters && (
              <Button
                variant="ghost" size="sm" className="text-xs h-9"
                onClick={() => { setSearchQuery(""); setFilterCategory("all"); setFilterStatus("all"); setFilterRecent(false); }}
              >
                Clear filters
              </Button>
            )}
          </div>
          {filteredDocs.length !== totalDocs && (
            <p className="text-[10px] text-muted-foreground mt-1.5">
              Showing {filteredDocs.length} of {totalDocs} files
              {filterRecent && " (last 7 days)"}
            </p>
          )}
        </div>
      )}

      {/* Document list */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 space-y-5">
        {filteredDocs.length > 0 ? (
          Object.entries(docsByCategory).map(([cat, catDocs]) => (
            <SortableCategoryGroup
              key={cat}
              cat={cat}
              catDocs={catDocs}
              catMeta={catMetaFn}
              selectMode={selectMode}
              selectedIds={selectedIds}
              renamingId={renamingId}
              renameValue={renameValue}
              renameInputRef={renameInputRef}
              onToggleSelect={toggleSelect}
              onStartRename={startRename}
              onRenameChange={setRenameValue}
              onSubmitRename={submitRename}
              onCancelRename={() => setRenamingId(null)}
              onViewDetails={setSelectedDoc}
              onUpdateVis={(id: number, v: string) => updateVis.mutate({ id, visibility: v as any })}
              onUpdateCat={(id: number, c: string) => updateCat.mutate({ id, category: c as any })}
              onDelete={(id: number) => deleteDoc.mutate({ id })}
              onDragEnd={handleDragEnd}
              visIcon={visIconFn}
              visLabel={visLabelFn}
            />
          ))
        ) : totalDocs > 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Search className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No files match your filters</p>
            <Button variant="link" size="sm" className="text-xs mt-1" onClick={() => { setSearchQuery(""); setFilterCategory("all"); setFilterStatus("all"); setFilterRecent(false); }}>
              Clear all filters
            </Button>
          </div>
        ) : (
          <div
            className="text-center py-20 text-muted-foreground border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-accent/30 transition-colors"
            onClick={() => setShowUploadDialog(true)}
          >
            <CloudUpload className="w-14 h-14 mx-auto mb-4 opacity-30" />
            <p className="text-base font-medium">Drop files here or click to upload</p>
            <p className="text-xs mt-1.5 max-w-md mx-auto">
              Upload documents, artifacts, and skills to train your AI. Supports PDF, DOC, DOCX, TXT, CSV, JSON, XLSX, PPTX, and more.
            </p>
            <Button
              className="mt-4 bg-accent text-accent-foreground hover:bg-accent/90 text-sm gap-1.5"
              onClick={(e) => { e.stopPropagation(); setShowUploadDialog(true); }}
            >
              <Upload className="w-4 h-4" /> Upload Files
            </Button>
          </div>
        )}
      </div>

      {/* Upload Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base">Upload to Knowledge Base</DialogTitle>
            <DialogDescription className="text-xs">
              Choose category and visibility, then select files. Max 10MB each.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Category</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                {CATEGORIES.map(c => (
                  <button
                    key={c.value}
                    onClick={() => setUploadCategory(c.value)}
                    className={`text-left p-2.5 rounded-lg border transition-all text-xs ${
                      uploadCategory === c.value ? "border-accent/50 bg-accent/5" : "border-border hover:border-accent/20"
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="text-accent">{c.icon}</span>
                      <span className="font-medium">{c.shortLabel}</span>
                    </div>
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">Leave on any category — AI will auto-classify if unsure</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Visibility</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {VISIBILITY_OPTIONS.map(v => (
                  <button
                    key={v.value}
                    onClick={() => setUploadVisibility(v.value as VisibilityValue)}
                    className={`text-left p-2 rounded-lg border transition-all text-xs ${
                      uploadVisibility === v.value ? "border-accent/50 bg-accent/5" : "border-border hover:border-accent/20"
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      {v.icon}
                      <span className="font-medium">{v.label}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleFileSelect}
              accept=".txt,.md,.pdf,.doc,.docx,.csv,.json,.xlsx,.pptx,.rtf,.html,.xml,.yaml,.yml"
              multiple
            />
            <Button variant="outline" onClick={() => setShowUploadDialog(false)} disabled={uploading}>Cancel</Button>
            <Button
              className="bg-accent text-accent-foreground hover:bg-accent/90 gap-1.5"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {uploading ? "Uploading..." : "Choose Files"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Confirmation */}
      <Dialog open={showBulkDeleteConfirm} onOpenChange={setShowBulkDeleteConfirm}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">Delete {selectedIds.size} file(s)?</DialogTitle>
            <DialogDescription className="text-xs">
              This will permanently remove the selected files and their AI training data. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowBulkDeleteConfirm(false)} disabled={bulkDeleteMut.isPending}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => bulkDeleteMut.mutate({ ids: Array.from(selectedIds) })}
              disabled={bulkDeleteMut.isPending}
              className="gap-1.5"
            >
              {bulkDeleteMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              Delete {selectedIds.size} file(s)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Document Details Dialog */}
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
                <p className="text-xs font-medium">{catMetaFn(selectedDoc?.category)?.label || selectedDoc?.category}</p>
              </div>
              <div className="p-3 rounded-lg bg-secondary/50">
                <p className="text-[10px] text-muted-foreground">Visibility</p>
                <p className="text-xs font-medium flex items-center gap-1">
                  {visIconFn(selectedDoc?.visibility || "professional")} {visLabelFn(selectedDoc?.visibility || "professional")}
                </p>
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
              <a href={selectedDoc.fileUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs text-accent hover:underline">
                <FileUp className="w-3 h-3" /> Download original file
              </a>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
