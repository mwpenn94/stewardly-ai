/**
 * MarkdownMessage — renders a chat assistant response as markdown
 * with copy-able code blocks (Pass 204).
 *
 * Why: the previous Code Chat UI wrapped the entire assistant reply in
 * a monospace `<pre>` which rendered markdown as raw text. Claude Code
 * and the Anthropic console both render rich markdown (headings, lists,
 * fenced code, inline code) with per-block copy buttons. This closes
 * that gap.
 *
 * Uses `react-markdown` + `remark-gfm` for parsing. Syntax highlighting
 * is intentionally left as CSS classes (`language-ts`, etc.) so that
 * Shiki or Prism can be layered on later without touching this
 * component.
 */

import { useState, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Check, Copy } from "lucide-react";

export default function MarkdownMessage({ content }: { content: string }) {
  return (
    <div className="prose prose-sm max-w-none text-foreground dark:prose-invert prose-headings:font-heading prose-headings:mt-4 prose-headings:mb-2 prose-p:my-2 prose-code:bg-muted prose-code:rounded prose-code:px-1 prose-code:text-[0.85em] prose-code:before:content-none prose-code:after:content-none prose-pre:bg-transparent prose-pre:p-0 prose-pre:m-0 prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code: ({ inline, className, children, ...props }: any) => {
            if (inline) {
              return (
                <code className={className} {...props}>
                  {children}
                </code>
              );
            }
            const match = /language-(\w+)/.exec(className ?? "");
            const lang = match?.[1];
            return (
              <CodeBlock language={lang}>
                {String(children).replace(/\n$/, "")}
              </CodeBlock>
            );
          },
          // Make links open in a new tab safely
          a: ({ children, ...props }: any) => (
            <a {...props} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

// ─── Code block with Copy ────────────────────────────────────────────

function CodeBlock({
  language,
  children,
}: {
  language?: string;
  children: ReactNode;
}) {
  const [copied, setCopied] = useState(false);
  const raw = typeof children === "string" ? children : String(children);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(raw);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard may be unavailable in secure context */
    }
  };

  return (
    <div className="not-prose my-3 rounded-lg border border-border/40 bg-muted/30 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1 border-b border-border/30 bg-muted/40">
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-mono">
          {language ?? "code"}
        </span>
        <button
          type="button"
          onClick={onCopy}
          className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Copy code"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 text-emerald-400" /> Copied
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" /> Copy
            </>
          )}
        </button>
      </div>
      <pre
        className={`overflow-x-auto text-xs font-mono p-3 leading-relaxed ${language ? `language-${language}` : ""}`}
      >
        <code className={language ? `language-${language}` : ""}>{raw}</code>
      </pre>
    </div>
  );
}
