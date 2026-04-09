/**
 * PiiMaskedField — Displays PII data with masking, toggle to reveal.
 * Requires explicit user action to unmask sensitive data.
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff, Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface PiiMaskedFieldProps {
  value: string;
  label?: string;
  maskChar?: string;
  visibleChars?: number;
  className?: string;
  copyable?: boolean;
  /** If false, the reveal button is hidden */
  allowReveal?: boolean;
}

function maskValue(value: string, maskChar: string, visibleChars: number): string {
  if (value.length <= visibleChars) return maskChar.repeat(value.length);
  const visible = value.slice(-visibleChars);
  return maskChar.repeat(value.length - visibleChars) + visible;
}

export function PiiMaskedField({
  value,
  label,
  maskChar = "•",
  visibleChars = 4,
  className,
  copyable = false,
  allowReveal = true,
}: PiiMaskedFieldProps) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  const displayed = revealed ? value : maskValue(value, maskChar, visibleChars);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy to clipboard — try selecting and copying manually");
    }
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {label && <span className="text-xs text-muted-foreground shrink-0">{label}:</span>}
      <span className="font-mono text-sm tabular-nums tracking-wider">{displayed}</span>
      <div className="flex items-center gap-0.5">
        {allowReveal && (
          <Button
            variant="ghost" size="sm" className="h-6 w-6 p-0"
            onClick={() => setRevealed(!revealed)}
            aria-label={revealed ? "Hide" : "Reveal"}
          >
            {revealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </Button>
        )}
        {copyable && (
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={handleCopy} aria-label="Copy">
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
          </Button>
        )}
      </div>
    </div>
  );
}
