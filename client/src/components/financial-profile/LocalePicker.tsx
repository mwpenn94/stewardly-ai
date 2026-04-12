/**
 * LocalePicker — compact locale + currency picker that any
 * calculator header can mount to let users switch formatting
 * without leaving the page.
 *
 * The picker shows the current locale + currency pair, opens a
 * small modal on click with 2 Select inputs, and calls setPrefs
 * on save. Uses useLocalePreferences so every other calculator
 * picks up the change automatically.
 *
 * Pass 18 history: ships the UI layer for G18.
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Globe, X } from "lucide-react";
import { useLocalePreferences } from "@/hooks/useLocalePreferences";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import {
  SUPPORTED_CURRENCIES,
  SUPPORTED_LOCALES,
} from "@/stores/localePreferences";

export function LocalePicker() {
  const { prefs, setPrefs, resetPrefs } = useLocalePreferences();
  const [open, setOpen] = useState(false);
  const dialogRef = useFocusTrap<HTMLDivElement>(open);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-md border border-border/60 px-2.5 py-1 text-xs hover:border-accent/40 hover:text-accent transition-colors"
        aria-label={`Change locale (currently ${prefs.locale} / ${prefs.currency})`}
      >
        <Globe className="w-3 h-3" />
        <span>{prefs.currency}</span>
        <Badge variant="outline" className="h-3.5 px-1 text-[9px] font-mono">
          {prefs.locale}
        </Badge>
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="locale-picker-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            ref={dialogRef}
            className="w-full max-w-md bg-card border border-border rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-3 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-accent" />
                <h2 id="locale-picker-title" className="text-base font-semibold">
                  Regional format
                </h2>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setOpen(false)}
                aria-label="Close locale picker"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="p-5 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="locale-select" className="text-xs">
                  Locale
                </Label>
                <Select
                  value={prefs.locale}
                  onValueChange={(v) => setPrefs({ locale: v })}
                >
                  <SelectTrigger id="locale-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SUPPORTED_LOCALES.map((l) => (
                      <SelectItem key={l.code} value={l.code}>
                        {l.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground">
                  Controls number grouping (1,234 vs 1.234) + month/day order.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="currency-select" className="text-xs">
                  Currency
                </Label>
                <Select
                  value={prefs.currency}
                  onValueChange={(v) => setPrefs({ currency: v })}
                >
                  <SelectTrigger id="currency-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SUPPORTED_CURRENCIES.map((c) => (
                      <SelectItem key={c.code} value={c.code}>
                        <span className="font-mono mr-2">{c.symbol}</span>
                        {c.code} — {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground">
                  Used for every money amount across the calculators.
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Preview</Label>
                <div className="rounded-md border bg-muted/30 p-3 font-mono text-sm">
                  <div>
                    <LocalePreview
                      value={1_234_567}
                      label="large"
                      prefs={prefs}
                      compact
                    />
                  </div>
                  <div>
                    <LocalePreview
                      value={1234}
                      label="small"
                      prefs={prefs}
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-border/60">
                <button
                  type="button"
                  onClick={resetPrefs}
                  className="text-xs text-muted-foreground hover:text-accent"
                >
                  Reset to en-US / USD
                </button>
                <Button onClick={() => setOpen(false)}>Done</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function LocalePreview({
  value,
  label,
  prefs,
  compact,
}: {
  value: number;
  label: string;
  prefs: { locale: string; currency: string; compactAbove: number };
  compact?: boolean;
}) {
  // Use Intl directly so the preview reflects the user's in-progress
  // selection without needing to save first.
  let text = "";
  try {
    text = new Intl.NumberFormat(prefs.locale, {
      style: "currency",
      currency: prefs.currency,
      maximumFractionDigits: 0,
      notation: compact ? "compact" : "standard",
      compactDisplay: "short",
    }).format(value);
  } catch {
    text = `${prefs.currency} ${value.toLocaleString("en-US")}`;
  }
  return (
    <div className="flex items-center justify-between">
      <span className="text-[10px] text-muted-foreground uppercase">{label}</span>
      <span>{text}</span>
    </div>
  );
}
