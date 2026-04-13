import { useState, useMemo } from "react";
import { Streamdown } from "streamdown";
import { ChevronDown, ChevronUp, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ProgressiveMessageProps {
  content: string;
  /** Word threshold for progressive disclosure. Default 300 */
  threshold?: number;
  /** Whether this is the latest message (skip collapse for latest) */
  isLatest?: boolean;
}

/**
 * Extract a summary from the first 2-3 sentences of the content.
 * Strips markdown formatting for the summary display.
 */
function extractSummary(text: string, maxSentences = 3): { summary: string; hasMore: boolean } {
  // Remove code blocks first
  const cleaned = text.replace(/```[\s\S]*?```/g, "").trim();
  // Split on sentence boundaries
  const sentences = cleaned.match(/[^.!?\n]+[.!?]+|[^.!?\n]+$/g) || [cleaned];
  const summaryParts = sentences.slice(0, maxSentences);
  const summary = summaryParts.join(" ").trim();
  const hasMore = sentences.length > maxSentences;
  return { summary, hasMore };
}

/**
 * Count words in text (rough estimate).
 */
function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

export function ProgressiveMessage({
  content,
  threshold = 300,
  isLatest = false,
}: ProgressiveMessageProps) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const words = useMemo(() => wordCount(content), [content]);
  const isLong = words > threshold;
  const { summary } = useMemo(() => extractSummary(content), [content]);

  const shouldCollapse = isLong && !isLatest && !expanded;

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="group relative">
      {shouldCollapse ? (
        <div>
          <div className="prose-chat text-sm">
            <p className="text-foreground/90 leading-relaxed">{summary}</p>
          </div>
          <button
            onClick={() => setExpanded(true)}
            className="flex items-center gap-1 mt-2 text-xs text-accent hover:text-accent/80 transition-colors"
          >
            <ChevronDown className="w-3.5 h-3.5" />
            <span>Show full response ({words} words)</span>
          </button>
        </div>
      ) : (
        <div>
          <div className="prose-chat text-sm">
            <Streamdown>{content}</Streamdown>
          </div>
          {isLong && !isLatest && (
            <button
              onClick={() => setExpanded(false)}
              className="flex items-center gap-1 mt-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronUp className="w-3.5 h-3.5" />
              <span>Collapse</span>
            </button>
          )}
        </div>
      )}

      {/* Copy button — visible on hover */}
      <button
        onClick={handleCopy}
        className="absolute top-0 right-0 p-2 rounded-md opacity-0 group-hover:opacity-100 transition-opacity bg-secondary/80 hover:bg-secondary text-muted-foreground hover:text-foreground"
        title="Copy response"
      >
        {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
      </button>
    </div>
  );
}
