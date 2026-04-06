/**
 * BranchComparison — Side-by-side comparison of forked conversation branches
 * Shows the original message and two divergent AI responses for comparison
 */
import { useState } from "react";
import { GitBranch, ArrowLeft, Check, X, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Streamdown } from "streamdown";

export interface BranchData {
  id: string;
  label: string;
  prompt: string;
  response: string;
  model?: string;
  timestamp: string;
}

interface BranchComparisonProps {
  originalMessage: string;
  branches: BranchData[];
  onSelect: (branchId: string) => void;
  onClose: () => void;
  className?: string;
}

export default function BranchComparison({
  originalMessage,
  branches,
  onSelect,
  onClose,
  className = "",
}: BranchComparisonProps) {
  const [expandedBranch, setExpandedBranch] = useState<string | null>(null);

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GitBranch className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Branch Comparison</h3>
          <Badge variant="outline" className="text-[10px]">{branches.length} branches</Badge>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} className="h-7 px-2">
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Original message context */}
      <div className="px-3 py-2 rounded-lg bg-muted/30 border border-border/40">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">Original prompt</p>
        <p className="text-xs text-foreground/80 line-clamp-2">{originalMessage}</p>
      </div>

      {/* Branch cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {branches.map((branch) => {
          const isExpanded = expandedBranch === branch.id;
          return (
            <Card key={branch.id} className="border-border/40 bg-card/50">
              <CardHeader className="pb-2 px-3 pt-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xs font-medium">{branch.label}</CardTitle>
                  {branch.model && (
                    <Badge variant="secondary" className="text-[9px] px-1.5 py-0">{branch.model}</Badge>
                  )}
                </div>
                {branch.prompt !== originalMessage && (
                  <p className="text-[10px] text-muted-foreground italic mt-1">Modified: {branch.prompt}</p>
                )}
              </CardHeader>
              <CardContent className="px-3 pb-3">
                <div className={`text-xs text-foreground/80 leading-relaxed ${isExpanded ? "" : "line-clamp-6"}`}>
                  <Streamdown>{branch.response}</Streamdown>
                </div>
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/30">
                  <button
                    onClick={() => setExpandedBranch(isExpanded ? null : branch.id)}
                    className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
                  >
                    {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    {isExpanded ? "Collapse" : "Expand"}
                  </button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 text-[10px] px-2"
                    onClick={() => onSelect(branch.id)}
                  >
                    <Check className="w-3 h-3 mr-1" /> Use this
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="flex justify-center">
        <Button variant="ghost" size="sm" onClick={onClose} className="text-xs text-muted-foreground">
          <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back to conversation
        </Button>
      </div>
    </div>
  );
}
