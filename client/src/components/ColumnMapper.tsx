/**
 * ColumnMapper — Maps CSV/XLSX columns to system fields during data import.
 * Shows source columns on the left and target fields on the right with dropdowns.
 */
import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Check, AlertTriangle, Sparkles } from "lucide-react";


interface TargetField {
  key: string;
  label: string;
  required?: boolean;
}

interface ColumnMapperProps {
  sourceColumns: string[];
  targetFields: TargetField[];
  initialMapping?: Record<string, string>;
  onConfirm: (mapping: Record<string, string>) => void;
  className?: string;
}

function autoMap(sources: string[], targets: TargetField[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  for (const src of sources) {
    const normalized = src.toLowerCase().replace(/[^a-z0-9]/g, "");
    const match = targets.find(t => {
      const tNorm = t.key.toLowerCase().replace(/[^a-z0-9]/g, "");
      const tLabel = t.label.toLowerCase().replace(/[^a-z0-9]/g, "");
      return normalized === tNorm || normalized === tLabel || normalized.includes(tNorm) || tNorm.includes(normalized);
    });
    if (match) mapping[src] = match.key;
  }
  return mapping;
}

export function ColumnMapper({ sourceColumns, targetFields, initialMapping, onConfirm, className }: ColumnMapperProps) {
  const autoMapped = useMemo(() => autoMap(sourceColumns, targetFields), [sourceColumns, targetFields]);
  const [mapping, setMapping] = useState<Record<string, string>>(initialMapping ?? autoMapped);

  const usedTargets = new Set(Object.values(mapping));
  const requiredMet = targetFields.filter(f => f.required).every(f => usedTargets.has(f.key));
  const mappedCount = Object.keys(mapping).length;

  const updateMapping = (source: string, target: string) => {
    setMapping(prev => {
      const next = { ...prev };
      if (target === "__none__") {
        delete next[source];
      } else {
        next[source] = target;
      }
      return next;
    });
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Map Columns</CardTitle>
          <Badge variant="outline" className="text-xs">
            {mappedCount}/{sourceColumns.length} mapped
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {sourceColumns.map(src => (
          <div key={src} className="flex items-center gap-2">
            <span className="text-xs font-mono bg-muted/50 rounded px-2 py-1 w-40 truncate shrink-0">{src}</span>
            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <Select value={mapping[src] ?? "__none__"} onValueChange={v => updateMapping(src, v)}>
              <SelectTrigger className="h-8 text-xs flex-1">
                <SelectValue placeholder="Skip column" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— Skip —</SelectItem>
                {targetFields.map(f => (
                  <SelectItem key={f.key} value={f.key} disabled={usedTargets.has(f.key) && mapping[src] !== f.key}>
                    {f.label} {f.required ? "*" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {mapping[src] && mapping[src] === autoMapped[src] && (
              <Sparkles className="h-3.5 w-3.5 text-amber-400 shrink-0" />
            )}
          </div>
        ))}

        {!requiredMet && (
          <div className="flex items-center gap-2 text-xs text-amber-400 pt-2">
            <AlertTriangle className="h-3.5 w-3.5" />
            Required fields not fully mapped
          </div>
        )}

        <Button className="w-full mt-3" disabled={!requiredMet} onClick={() => onConfirm(mapping)}>
          <Check className="h-4 w-4 mr-2" /> Confirm Mapping
        </Button>
      </CardContent>
    </Card>
  );
}
