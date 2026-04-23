/**
 * SharePlanButton.tsx — Plan sharing via secure token link
 *
 * Wires into the existing sharedLinks router to create shareable
 * links for calculator results and plan summaries. Supports:
 * - One-click share link generation
 * - Configurable expiry and max views
 * - Copy-to-clipboard
 * - Link management (revoke)
 */
import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Share2, Copy, Check, Link2, Loader2, Eye, Clock, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface SharePlanButtonProps {
  contentType: "protection_score" | "plan_summary" | "calculator_result" | "chat_excerpt";
  contentId: number;
  title?: string;
  className?: string;
}

export function SharePlanButton({ contentType, contentId, title, className }: SharePlanButtonProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [maxViews, setMaxViews] = useState(100);

  const createMut = trpc.financialInstruments.sharedLinks.create.useMutation({
    onSuccess: (data) => {
      const url = `${window.location.origin}/shared/${data.shareToken}`;
      setShareUrl(url);
      toast.success("Share link created");
    },
    onError: () => toast.error("Failed to create share link"),
  });

  const handleCreate = () => {
    createMut.mutate({
      contentType,
      contentId,
      maxViews,
    });
  };

  const handleCopy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success("Link copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy link");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setShareUrl(null); setCopied(false); } }}>
      <DialogTrigger asChild>
        <button
          type="button"
          className={`inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors px-2 py-1 rounded border border-border hover:border-primary/30 ${className ?? ""}`}
          aria-label={`Share ${title || "plan"}`}
        >
          <Share2 className="w-3 h-3" />
          Share
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-primary" />
            Share {title || "Plan"}
          </DialogTitle>
          <DialogDescription>
            Create a secure link to share this {contentType.replace("_", " ")} with clients or colleagues.
          </DialogDescription>
        </DialogHeader>

        {!shareUrl ? (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-sm">Maximum Views</Label>
              <Input
                type="number"
                min={1}
                max={1000}
                value={maxViews}
                onChange={e => setMaxViews(Number(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">
                Link will expire after this many views
              </p>
            </div>
            <Button
              className="w-full"
              onClick={handleCreate}
              disabled={createMut.isPending}
            >
              {createMut.isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creating...</>
              ) : (
                <><Share2 className="h-4 w-4 mr-2" /> Generate Share Link</>
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-2">
              <Input
                value={shareUrl}
                readOnly
                className="font-mono text-xs"
              />
              <Button size="icon" variant="outline" onClick={handleCopy}>
                {copied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Eye className="h-3 w-3" /> Max {maxViews} views
              </span>
              <Badge variant="outline" className="text-xs">
                {contentType.replace("_", " ")}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Anyone with this link can view the shared content. You can revoke access anytime from your shared links dashboard.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default SharePlanButton;
