import { useState, useMemo, lazy, Suspense } from "react";
import { Streamdown } from "streamdown";
import { ChevronDown, ChevronUp, Copy, Check, BarChart3 } from "lucide-react";
import { parseChartBlocks } from "./InlineChart";

const InlineChart = lazy(() => import("./InlineChart"));

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

/**
 * Render message content with inline chart support.
 * Splits content on [CHART:N] placeholders and interleaves
 * Streamdown markdown with InlineChart components.
 */
function RichContent({ text, charts }: { text: string; charts: ReturnType<typeof parseChartBlocks>["charts"] }) {
  if (charts.length === 0) {
    return <Streamdown>{text}</Streamdown>;
  }

  // Split on [CHART:N] placeholders
  const parts = text.split(/\[CHART:(\d+)\]/);
  return (
    <>
      {parts.map((part, i) => {
        if (i % 2 === 1) {
          // This is a chart index
          const chartIdx = parseInt(part, 10);
          const chartData = charts[chartIdx];
          if (chartData) {
            return (
              <Suspense key={`chart-${i}`} fallback={
                <div className="flex items-center gap-2 py-4 text-xs text-muted-foreground">
                  <BarChart3 className="w-4 h-4 animate-pulse" /> Loading chart...
                </div>
              }>
                <InlineChart data={chartData} className="my-3" />
              </Suspense>
            );
          }
          return null;
        }
        // Regular text part
        if (!part.trim()) return null;
        return <Streamdown key={`text-${i}`}>{part}</Streamdown>;
      })}
    </>
  );
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

  // Parse chart blocks from content
  const { text: cleanedText, charts } = useMemo(() => parseChartBlocks(content), [content]);

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
            {charts.length > 0 && (
              <span className="inline-flex items-center gap-1 text-[10px] text-primary/70 ml-1">
                <BarChart3 className="w-3 h-3" /> {charts.length} chart{charts.length > 1 ? "s" : ""}
              </span>
            )}
          </div>
          <button type="button"
            onClick={() => setExpanded(true)}
            className="flex items-center gap-1 mt-2 text-xs text-primary hover:text-primary/80 transition-colors"
          >
            <ChevronDown className="w-3.5 h-3.5" />
            <span>Show full response ({words} words)</span>
          </button>
        </div>
      ) : (
        <div>
          <div className="prose-chat text-sm">
            <RichContent text={cleanedText} charts={charts} />
          </div>
          {isLong && !isLatest && (
            <button type="button"
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
      <button type="button"
        onClick={handleCopy}
        className="absolute top-0 right-0 p-2 rounded-md opacity-0 group-hover:opacity-100 transition-opacity bg-secondary/80 hover:bg-secondary text-muted-foreground hover:text-foreground"
        title="Copy response"
      >
        {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
      </button>
    </div>
  );
}
