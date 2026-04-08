/**
 * ProductReferencePanel — Display cited product references, benchmarks, and methodology.
 * Supports due diligence by showing sources for all financial product data.
 */
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, BookOpen, Scale, Info, ChevronDown, ChevronUp } from "lucide-react";

interface ProductReference {
  key: string;
  src: string;
  url: string;
  benchmark: string;
}

interface Benchmark {
  [key: string]: { value?: number; pct?: number; gap?: number; national?: number; sp500?: number; bonds?: number; balanced?: number; source: string; url: string };
}

interface Methodology {
  uwe: string;
  bie: string;
  he: string;
  mc: string;
  pf: string;
  disclaimer: string;
}

interface Props {
  references?: ProductReference[];
  benchmarks?: Benchmark;
  methodology?: Methodology;
  title?: string;
}

export default function ProductReferencePanel({ references, benchmarks, methodology, title = "References & Methodology" }: Props) {
  const [showRefs, setShowRefs] = useState(false);
  const [showMethodology, setShowMethodology] = useState(false);
  const [showBenchmarks, setShowBenchmarks] = useState(false);

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-blue-400" />
          <CardTitle className="text-base">{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Product References */}
        {references && references.length > 0 && (
          <div>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-between text-xs h-8"
              onClick={() => setShowRefs(!showRefs)}
            >
              <span className="flex items-center gap-1.5">
                <Scale className="w-3 h-3" />
                Product References ({references.length})
              </span>
              {showRefs ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </Button>
            {showRefs && (
              <div className="space-y-2 mt-2 pl-2">
                {references.map((ref) => (
                  <div key={ref.key} className="bg-secondary/30 rounded-lg p-2.5 text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <Badge variant="outline" className="text-[9px] uppercase">{ref.key}</Badge>
                      <a href={ref.url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline flex items-center gap-1">
                        Source <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    </div>
                    <p className="text-muted-foreground text-[10px] mb-1">{ref.src}</p>
                    <p className="text-foreground/80">{ref.benchmark}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Industry Benchmarks */}
        {benchmarks && (
          <div>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-between text-xs h-8"
              onClick={() => setShowBenchmarks(!showBenchmarks)}
            >
              <span className="flex items-center gap-1.5">
                <Info className="w-3 h-3" />
                Industry Benchmarks
              </span>
              {showBenchmarks ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </Button>
            {showBenchmarks && (
              <div className="space-y-1.5 mt-2 pl-2">
                {Object.entries(benchmarks).map(([key, b]) => (
                  <div key={key} className="flex items-center justify-between bg-secondary/30 rounded p-2 text-xs">
                    <span className="text-muted-foreground capitalize">{key.replace(/([A-Z])/g, " $1").trim()}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono tabular-nums">
                        {(b as any).value !== undefined ? `${((b as any).value * 100).toFixed(1)}%` :
                         (b as any).pct !== undefined ? `${((b as any).pct * 100).toFixed(0)}%` :
                         (b as any).national !== undefined ? `${((b as any).national * 100).toFixed(1)}%` :
                         (b as any).gap !== undefined ? `${((b as any).gap * 100).toFixed(1)}%` : "—"}
                      </span>
                      <a href={(b as any).url} target="_blank" rel="noopener noreferrer" className="text-blue-400">
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Methodology */}
        {methodology && (
          <div>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-between text-xs h-8"
              onClick={() => setShowMethodology(!showMethodology)}
            >
              <span className="flex items-center gap-1.5">
                <BookOpen className="w-3 h-3" />
                Methodology Disclosures
              </span>
              {showMethodology ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </Button>
            {showMethodology && (
              <div className="space-y-2 mt-2 pl-2">
                {Object.entries(methodology).map(([key, text]) => (
                  <div key={key} className="bg-secondary/30 rounded-lg p-2.5">
                    <Badge variant="outline" className="text-[9px] uppercase mb-1">{key}</Badge>
                    <p className="text-[10px] text-muted-foreground leading-relaxed">{text}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
