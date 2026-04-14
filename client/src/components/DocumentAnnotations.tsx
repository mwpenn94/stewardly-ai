import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  MessageSquare, CheckCircle, AlertCircle, HelpCircle,
  ListTodo, Sparkles, Send, Trash2, Check, Loader2,
} from "lucide-react";

const TYPE_META: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  comment:     { icon: <MessageSquare className="w-3 h-3" />, color: "text-blue-400",    label: "Comment" },
  highlight:   { icon: <AlertCircle className="w-3 h-3" />,  color: "text-amber-400",   label: "Highlight" },
  question:    { icon: <HelpCircle className="w-3 h-3" />,   color: "text-purple-400",  label: "Question" },
  action_item: { icon: <ListTodo className="w-3 h-3" />,     color: "text-emerald-400", label: "Action Item" },
  ai_insight:  { icon: <Sparkles className="w-3 h-3" />,     color: "text-accent",      label: "AI Insight" },
};

interface Props {
  documentId: number;
}

export default function DocumentAnnotations({ documentId }: Props) {
  const [newContent, setNewContent] = useState("");
  const [newType, setNewType] = useState<string>("comment");
  const utils = trpc.useUtils();

  const { data: annotations = [], isLoading } = trpc.documents.listAnnotations.useQuery(
    { documentId },
    { enabled: !!documentId }
  );

  const addMut = trpc.documents.addAnnotation.useMutation({
    onSuccess: () => {
      utils.documents.listAnnotations.invalidate({ documentId });
      setNewContent("");
      toast.success("Annotation added");
    },
    onError: () => toast.error("Failed to add annotation"),
  });

  const resolveMut = trpc.documents.resolveAnnotation.useMutation({
    onSuccess: () => {
      utils.documents.listAnnotations.invalidate({ documentId });
      toast.success("Marked as resolved");
    },
  });

  const deleteMut = trpc.documents.deleteAnnotation.useMutation({
    onSuccess: () => {
      utils.documents.listAnnotations.invalidate({ documentId });
      toast.success("Annotation removed");
    },
  });

  const handleSubmit = () => {
    const trimmed = newContent.trim();
    if (!trimmed) return;
    addMut.mutate({
      documentId,
      content: trimmed,
      annotationType: newType as any,
    });
  };

  const unresolvedCount = annotations.filter((a: any) => !a.resolvedAt).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold flex items-center gap-1.5">
          <MessageSquare className="w-3.5 h-3.5 text-accent" />
          Annotations
          {unresolvedCount > 0 && (
            <Badge variant="secondary" className="text-[8px] ml-1">{unresolvedCount} open</Badge>
          )}
        </h4>
      </div>

      {/* Add annotation form */}
      <div className="space-y-2">
        <div className="flex gap-1 flex-wrap">
          {Object.entries(TYPE_META).filter(([k]) => k !== "ai_insight").map(([key, meta]) => (
            <button
              key={key}
              onClick={() => setNewType(key)}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[9px] font-medium transition-all ${
                newType === key
                  ? `${meta.color} bg-secondary/80 ring-1 ring-accent/30`
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
              }`}
            >
              {meta.icon} {meta.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSubmit()}
            placeholder={`Add a ${TYPE_META[newType]?.label.toLowerCase() || "comment"}...`}
            className="flex-1 bg-secondary/40 border border-border/50 rounded-lg px-3 py-2 text-xs placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-accent/40"
          />
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={!newContent.trim() || addMut.isPending}
            className="h-9 px-3"
          >
            {addMut.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
          </Button>
        </div>
      </div>

      {/* Annotations list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        </div>
      ) : annotations.length === 0 ? (
        <p className="text-[10px] text-muted-foreground text-center py-3">
          No annotations yet. Add a comment, question, or action item.
        </p>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto pr-1 scrollbar-thin">
          {annotations.map((ann: any) => {
            const meta = TYPE_META[ann.annotationType] || TYPE_META.comment;
            return (
              <div
                key={ann.id}
                className={`p-2.5 rounded-lg border transition-all ${
                  ann.resolvedAt
                    ? "bg-secondary/20 border-border/20 opacity-60"
                    : "bg-secondary/40 border-border/40"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className={meta.color}>{meta.icon}</span>
                      <span className="text-[9px] font-medium">{meta.label}</span>
                      {ann.resolvedAt && (
                        <Badge variant="outline" className="text-[7px] text-emerald-400 border-emerald-400/30">
                          <CheckCircle className="w-2 h-2 mr-0.5" /> Resolved
                        </Badge>
                      )}
                      <span className="text-[8px] text-muted-foreground ml-auto">
                        {ann.createdAt ? new Date(ann.createdAt).toLocaleDateString() : ""}
                      </span>
                    </div>
                    <p className="text-[11px] text-foreground/90 leading-relaxed">{ann.content}</p>
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    {!ann.resolvedAt && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-emerald-400"
                        onClick={() => resolveMut.mutate({ id: ann.id })}
                        title="Mark as resolved"
                      >
                        <Check className="w-3 h-3" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                      onClick={() => deleteMut.mutate({ id: ann.id })}
                      title="Delete annotation"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
