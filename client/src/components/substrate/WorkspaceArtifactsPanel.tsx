/**
 * WorkspaceArtifactsPanel — Collapsible workspace panel for chat view.
 *
 * Absorbed from manus-next-app ArtifactStreamViewer pattern.
 * Shows generated artifacts (reports, calculations, documents) alongside chat.
 * Implements the three-panel layout pattern when artifacts are present.
 */
import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText,
  X,
  ChevronRight,
  Download,
  Copy,
  Check,
  BarChart3,
  Shield,
  Calculator,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export interface Artifact {
  id: string;
  title: string;
  type: "report" | "calculation" | "document" | "analysis" | "compliance" | "code";
  content: string;
  status: "generating" | "complete" | "error";
  createdAt: number;
  metadata?: Record<string, unknown>;
}

interface WorkspaceArtifactsPanelProps {
  artifacts: Artifact[];
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  className?: string;
}

const TYPE_ICONS: Record<Artifact["type"], typeof FileText> = {
  report: FileText,
  calculation: Calculator,
  document: FileText,
  analysis: BarChart3,
  compliance: Shield,
  code: FileText,
};

export function WorkspaceArtifactsPanel({
  artifacts,
  isOpen,
  onToggle,
  onClose,
  className,
}: WorkspaceArtifactsPanelProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const selected = artifacts.find((a) => a.id === selectedId) ?? artifacts[0] ?? null;

  const handleCopy = useCallback(async () => {
    if (!selected) return;
    await navigator.clipboard.writeText(selected.content);
    setCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  }, [selected]);

  if (artifacts.length === 0 && !isOpen) return null;

  return (
    <>
      {/* Collapsed toggle button */}
      {!isOpen && artifacts.length > 0 && (
        <motion.button
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          onClick={onToggle}
          className="fixed right-4 top-1/2 -translate-y-1/2 z-30 flex items-center gap-2 rounded-l-lg border border-border bg-card px-3 py-2 text-sm text-muted-foreground shadow-lg hover:text-foreground hover:bg-accent transition-colors"
          title="Open workspace panel"
        >
          <ChevronRight className="w-4 h-4" />
          <span className="hidden sm:inline">{artifacts.length} artifact{artifacts.length !== 1 ? "s" : ""}</span>
        </motion.button>
      )}

      {/* Expanded panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 380, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className={cn(
              "flex flex-col border-l border-border bg-card/95 backdrop-blur-sm overflow-hidden",
              className
            )}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" />
                Workspace
                <span className="text-xs text-muted-foreground">({artifacts.length})</span>
              </h3>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Artifact list */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Tabs */}
              <ScrollArea className="border-b border-border">
                <div className="flex gap-1 p-2">
                  {artifacts.map((artifact) => {
                    const Icon = TYPE_ICONS[artifact.type] || FileText;
                    const isActive = artifact.id === (selected?.id ?? "");
                    return (
                      <button
                        key={artifact.id}
                        onClick={() => setSelectedId(artifact.id)}
                        className={cn(
                          "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs whitespace-nowrap transition-colors",
                          isActive
                            ? "bg-primary/10 text-primary border border-primary/20"
                            : "text-muted-foreground hover:text-foreground hover:bg-accent"
                        )}
                      >
                        <Icon className="w-3 h-3" />
                        <span className="max-w-[100px] truncate">{artifact.title}</span>
                        {artifact.status === "generating" && (
                          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>

              {/* Content */}
              {selected ? (
                <div className="flex-1 flex flex-col overflow-hidden">
                  {/* Toolbar */}
                  <div className="flex items-center justify-between px-3 py-2 border-b border-border/50">
                    <span className="text-xs text-muted-foreground capitalize">
                      {selected.type} • {new Date(selected.createdAt).toLocaleTimeString()}
                    </span>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleCopy}>
                        {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6" title="Open in new tab">
                        <ExternalLink className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                  {/* Body */}
                  <ScrollArea className="flex-1 p-4">
                    <div className="prose prose-sm dark:prose-invert max-w-none text-xs leading-relaxed whitespace-pre-wrap">
                      {selected.content}
                    </div>
                  </ScrollArea>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
                  No artifacts yet
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
