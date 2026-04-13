/**
 * DownloadReportButton — Round A4.
 *
 * Renders a button that, when clicked, calls the
 * `wealthEngine.generateReport` tRPC mutation with the supplied
 * payload, then triggers a browser download of the resulting PDF.
 *
 * Reusable across every wealth-engine page (StrategyComparison,
 * Retirement, PracticeToWealth, QuickQuote). Caller passes the
 * pre-built `payload` matching the templates.ts shape — this
 * component handles the network call, the base64 → Blob conversion,
 * and the download trigger.
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";

export type WealthReportTemplate =
  | "executive_summary"
  | "complete_plan"
  | "practice_growth"
  | "prospect_preview";

export interface DownloadReportButtonProps {
  template: WealthReportTemplate;
  clientName: string;
  advisorName?: string;
  firmName?: string;
  /** Pre-built payload matching templates.ts ExecutiveSummaryInput / etc. */
  payload: { kind: string; input: unknown };
  /** Disable when the underlying engine output isn't ready yet */
  disabled?: boolean;
  /** Optional label override (default: "Download Report") */
  label?: string;
  /** Show as compact icon button (default: full button with text) */
  compact?: boolean;
}

export function DownloadReportButton({
  template,
  clientName,
  advisorName,
  firmName,
  payload,
  disabled,
  label = "Download Report",
  compact,
}: DownloadReportButtonProps) {
  const [isPending, setIsPending] = useState(false);
  const generateReport = trpc.wealthEngine.generateReport.useMutation();

  const onClick = async () => {
    if (isPending || disabled) return;
    setIsPending(true);
    try {
      const result = await generateReport.mutateAsync({
        template,
        clientName,
        advisorName,
        firmName,
        // Cast through unknown to satisfy the tRPC zod schema for `payload.input`
        payload: payload as never,
      });

      // Decode base64 → Blob → trigger download
      const binary = atob(result.base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = result.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("Report downloaded", {
        description: `${result.filename} (${(result.sizeBytes / 1024).toFixed(0)} KB)`,
      });
    } catch (err) {
      toast.error("The report couldn't be generated right now", {
        description:
          err instanceof Error ? err.message : "Please try again in a moment",
      });
    } finally {
      setIsPending(false);
    }
  };

  if (compact) {
    return (
      <Button
        variant="outline"
        size="icon"
        onClick={onClick}
        disabled={disabled || isPending}
        title={label}
        aria-label={label}
      >
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Download className="h-4 w-4" />
        )}
      </Button>
    );
  }

  return (
    <Button
      onClick={onClick}
      disabled={disabled || isPending}
      variant="outline"
      className="gap-2"
    >
      {isPending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Download className="h-4 w-4" />
      )}
      {label}
    </Button>
  );
}
