/**
 * Changelog — Dedicated page showing the full release history.
 *
 * Imports the CHANGELOG array from WhatsNewModal so there's a single
 * source of truth. Renders all releases with expandable/collapsible
 * sections, category badges, and a timeline-style layout.
 */
import AppShell from "@/components/AppShell";
import { SEOHead } from "@/components/SEOHead";
import { CHANGELOG, CURRENT_VERSION } from "@/components/WhatsNewModal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useState } from "react";
import {
  History, ChevronDown, ChevronUp, Sparkles, ArrowLeft,
} from "lucide-react";
import { useLocation } from "wouter";

const CATEGORY_STYLES: Record<string, { label: string; className: string }> = {
  feature:     { label: "New",         className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  fix:         { label: "Fix",         className: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  improvement: { label: "Improved",    className: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  security:    { label: "Security",    className: "bg-purple-500/15 text-purple-400 border-purple-500/30" },
};

export default function Changelog() {
  const [, navigate] = useLocation();
  // First release is expanded by default, rest collapsed
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(CHANGELOG.length > 0 ? [CHANGELOG[0].version] : [])
  );

  const toggle = (version: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(version)) next.delete(version);
      else next.add(version);
      return next;
    });
  };

  const expandAll = () => setExpanded(new Set(CHANGELOG.map(r => r.version)));
  const collapseAll = () => setExpanded(new Set());

  return (
    <AppShell title="Changelog">
      <SEOHead title="Changelog" description="Latest updates and release notes" />
      <div className="min-h-screen">
        {/* Header */}
        <div className="border-b border-border/50 bg-card/30 backdrop-blur-sm sticky top-0 z-30 relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(ellipse at 20% 50%, oklch(0.76 0.14 80 / 0.15) 0%, transparent 70%)' }} />
          <div className="max-w-3xl mx-auto px-4 h-14 flex items-center gap-3">
            <Button variant="ghost" size="sm" className="gap-1.5 shrink-0" onClick={() => navigate("/chat")}>
              <ArrowLeft className="w-4 h-4" /> <span className="hidden sm:inline">Back</span>
            </Button>
            <Separator orientation="vertical" className="h-5" />
            <div className="flex items-center gap-2 min-w-0">
              <History className="w-4 h-4 text-accent shrink-0" />
              <h1 className="text-sm font-semibold truncate">Changelog</h1>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Button variant="ghost" size="sm" className="text-xs h-7" onClick={expandAll}>
                Expand all
              </Button>
              <Button variant="ghost" size="sm" className="text-xs h-7" onClick={collapseAll}>
                Collapse all
              </Button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-3xl mx-auto px-4 py-8">
          {/* Intro */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-5 h-5 text-accent" />
              <h2 className="text-xl font-bold">Release History</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              A complete log of every update, improvement, and fix shipped to Stewardly.
              Current version: <code className="px-1.5 py-0.5 rounded bg-secondary text-xs font-mono">{CURRENT_VERSION}</code>
            </p>
          </div>

          {/* Timeline */}
          <div className="relative">
            {/* Vertical timeline line */}
            <div className="absolute left-[11px] top-2 bottom-2 w-px bg-border/50" />

            <div className="space-y-6">
              {CHANGELOG.map((release, ri) => {
                const isExpanded = expanded.has(release.version);
                const isLatest = ri === 0;

                return (
                  <div key={release.version} className="relative pl-8">
                    {/* Timeline dot */}
                    <div className={`absolute left-0 top-3 w-[23px] h-[23px] rounded-full border-2 flex items-center justify-center ${
                      isLatest
                        ? "bg-accent/20 border-accent"
                        : "bg-card border-border"
                    }`}>
                      <div className={`w-2 h-2 rounded-full ${isLatest ? "bg-accent" : "bg-muted-foreground/40"}`} />
                    </div>

                    <Card className={`overflow-hidden transition-all ${isLatest ? "border-accent/30" : ""}`}>
                      {/* Release header — clickable */}
                      <button
                        onClick={() => toggle(release.version)}
                        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-secondary/20 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold">v{release.version}</span>
                            {isLatest && (
                              <Badge variant="default" className="text-[9px] px-1.5 py-0 h-4">
                                Latest
                              </Badge>
                            )}
                            <span className="text-xs text-muted-foreground">{release.date}</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{release.headline}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 text-muted-foreground/70">
                            {release.entries.length} change{release.entries.length !== 1 ? "s" : ""}
                          </Badge>
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-muted-foreground" />
                          )}
                        </div>
                      </button>

                      {/* Entries — expandable */}
                      {isExpanded && (
                        <CardContent className="px-5 pb-5 pt-0">
                          <Separator className="mb-4" />
                          <div className="space-y-4">
                            {release.entries.map((entry, ei) => (
                              <div key={ei} className="flex gap-3">
                                <div className="shrink-0 mt-0.5">{entry.icon}</div>
                                <div className="space-y-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-sm font-medium">{entry.title}</span>
                                    <Badge
                                      variant="outline"
                                      className={`text-[10px] px-1.5 py-0 ${CATEGORY_STYLES[entry.category]?.className || ""}`}
                                    >
                                      {CATEGORY_STYLES[entry.category]?.label || entry.category}
                                    </Badge>
                                  </div>
                                  <p className="text-xs text-muted-foreground leading-relaxed">
                                    {entry.description}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      )}
                    </Card>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Footer */}
          <div className="mt-12 text-center">
            <p className="text-xs text-muted-foreground/50">
              End of release history. Older changes are archived.
            </p>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
