/* ═══════════════════════════════════════════════════════════════
   SearchResults — Dedicated global search results page.
   Accessed via /search?q=<query>

   Searches across:
   - Conversations (chat history)
   - Documents (knowledge base)
   - Unified search (multi-modal: PDFs, images, transcripts)
   - Platform commands / pages

   Wired from CommandPalette "View all results" and direct navigation.
   ═══════════════════════════════════════════════════════════════ */
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useLocation, useSearch } from "wouter";
import AppShell from "@/components/AppShell";
import { SEOHead } from "@/components/SEOHead";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  Search, MessageSquare, FileText, Layers, ArrowRight,
  Clock, Loader2, X, Sparkles, Filter,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────
interface SearchResultItem {
  id: string | number;
  type: "conversation" | "document" | "unified" | "command";
  title: string;
  snippet: string;
  score?: number;
  meta?: string;
  href?: string;
}

// ── Type icon + badge mapping ────────────────────────────────────────
const TYPE_CONFIG: Record<string, { icon: React.ElementType; label: string; className: string }> = {
  conversation: { icon: MessageSquare, label: "Chat", className: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  document: { icon: FileText, label: "Document", className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  unified: { icon: Layers, label: "Knowledge", className: "bg-purple-500/15 text-purple-400 border-purple-500/30" },
  command: { icon: Sparkles, label: "Command", className: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
};

// ── Highlight matched text ───────────────────────────────────────────
function HighlightedText({ text, query }: { text: string; query: string }) {
  if (!query || query.length < 2) return <span>{text}</span>;
  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"));
  return (
    <span>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark key={i} className="bg-primary/20 text-foreground rounded-sm px-0.5">{part}</mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </span>
  );
}

// ── Empty state ──────────────────────────────────────────────────────
function EmptyState({ query }: { query: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 rounded-full bg-muted/30 flex items-center justify-center mb-4">
        <Search className="w-8 h-8 text-muted-foreground/50" />
      </div>
      <h3 className="text-lg font-medium mb-2">No results found</h3>
      <p className="text-sm text-muted-foreground max-w-md">
        {query
          ? `No matches for "${query}". Try different keywords or check your spelling.`
          : "Enter a search term to find conversations, documents, and more."}
      </p>
    </div>
  );
}

// ── Loading skeleton ─────────────────────────────────────────────────
function ResultSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} className="p-4 rounded-lg bg-muted/10 animate-pulse">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-muted/30" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-2/3 bg-muted/30 rounded" />
              <div className="h-3 w-full bg-muted/20 rounded" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Result card ──────────────────────────────────────────────────────
function ResultCard({ item, query, onClick }: { item: SearchResultItem; query: string; onClick: () => void }) {
  const config = TYPE_CONFIG[item.type] || TYPE_CONFIG.unified;
  const Icon = config.icon;

  return (
    <button
      onClick={onClick}
      className="w-full text-left p-4 rounded-lg bg-muted/10 hover:bg-muted/20 border border-transparent hover:border-border/50 transition-all group"
    >
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-muted/20 flex items-center justify-center shrink-0 mt-0.5">
          <Icon className="w-4 h-4 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium group-hover:text-primary transition-colors">
              <HighlightedText text={item.title} query={query} />
            </span>
            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-4 shrink-0 ${config.className}`}>
              {config.label}
            </Badge>
            {item.score != null && item.score > 0 && (
              <span className="text-[10px] text-muted-foreground/50">{Math.round(item.score * 100)}%</span>
            )}
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
            <HighlightedText text={item.snippet} query={query} />
          </p>
          {item.meta && (
            <p className="text-[10px] text-muted-foreground/50 flex items-center gap-1">
              <Clock className="w-3 h-3" /> {item.meta}
            </p>
          )}
        </div>
        <ArrowRight className="w-4 h-4 text-muted-foreground/30 group-hover:text-primary shrink-0 mt-1 transition-colors" />
      </div>
    </button>
  );
}

// ── Main component ───────────────────────────────────────────────────
export default function SearchResults() {
  const { user } = useAuth();
  const isAuthenticated = !!user && user.authTier !== "anonymous";
  const [, navigate] = useLocation();
  const searchStr = useSearch();
  const params = useMemo(() => new URLSearchParams(searchStr), [searchStr]);
  const initialQuery = params.get("q") || "";

  const [query, setQuery] = useState(initialQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery);
  const [activeTab, setActiveTab] = useState("all");
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounce the query
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  // Update URL when debounced query changes
  useEffect(() => {
    if (debouncedQuery) {
      window.history.replaceState({}, "", `/search?q=${encodeURIComponent(debouncedQuery)}`);
    }
  }, [debouncedQuery]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // ── tRPC queries ──
  const conversationSearch = trpc.conversations.search.useQuery(
    { query: debouncedQuery, limit: 15 },
    { enabled: isAuthenticated && debouncedQuery.length >= 2 },
  );

  const documentSearch = trpc.documents.search.useQuery(
    { query: debouncedQuery, limit: 10 },
    { enabled: isAuthenticated && debouncedQuery.length >= 2 },
  );

  const unifiedSearch = trpc.multiModalProcessing.unifiedSearch.useQuery(
    { query: debouncedQuery, limit: 10 },
    { enabled: isAuthenticated && debouncedQuery.length >= 2 },
  );

  const commandSearch = trpc.aiPlatform.commands.search.useQuery(
    { query: debouncedQuery, userRole: user?.role },
    { enabled: debouncedQuery.length >= 2 },
  );

  // ── Normalize results ──
  const allResults = useMemo<SearchResultItem[]>(() => {
    const items: SearchResultItem[] = [];

    // Conversations
    if (conversationSearch.data) {
      for (const conv of conversationSearch.data) {
        items.push({
          id: `conv-${conv.id}`,
          type: "conversation",
          title: conv.title || "Untitled conversation",
          snippet: conv.lastMessage || conv.title || "",
          meta: conv.updatedAt ? new Date(conv.updatedAt).toLocaleDateString() : undefined,
          href: `/chat/${conv.id}`,
        });
      }
    }

    // Documents
    if (documentSearch.data) {
      for (const doc of documentSearch.data) {
        items.push({
          id: `doc-${doc.id}`,
          type: "document",
          title: `Document #${doc.documentId}`,
          snippet: doc.content || "",
          score: doc.score,
          href: "/knowledge-base",
        });
      }
    }

    // Unified (multi-modal)
    if (unifiedSearch.data) {
      for (const item of unifiedSearch.data) {
        // Deduplicate with document results
        if (items.some(r => r.id === `doc-${item.documentId}`)) continue;
        items.push({
          id: `unified-${item.documentId}`,
          type: "unified",
          title: item.title || "Untitled",
          snippet: item.snippet || "",
          score: item.relevance,
          href: "/knowledge-base",
        });
      }
    }

    // Commands / pages
    if (commandSearch.data) {
      for (const cmd of commandSearch.data as any[]) {
        items.push({
          id: `cmd-${cmd.id || cmd.label}`,
          type: "command",
          title: cmd.label || cmd.name || "",
          snippet: cmd.description || cmd.keywords?.join(", ") || "",
          href: cmd.href || cmd.action,
        });
      }
    }

    return items;
  }, [conversationSearch.data, documentSearch.data, unifiedSearch.data, commandSearch.data]);

  // ── Filtered results by tab ──
  const filteredResults = useMemo(() => {
    if (activeTab === "all") return allResults;
    return allResults.filter(r => r.type === activeTab);
  }, [allResults, activeTab]);

  // ── Counts per type ──
  const counts = useMemo(() => ({
    all: allResults.length,
    conversation: allResults.filter(r => r.type === "conversation").length,
    document: allResults.filter(r => r.type === "document").length,
    unified: allResults.filter(r => r.type === "unified").length,
    command: allResults.filter(r => r.type === "command").length,
  }), [allResults]);

  const isLoading = conversationSearch.isLoading || documentSearch.isLoading || unifiedSearch.isLoading || commandSearch.isLoading;

  const handleResultClick = useCallback((item: SearchResultItem) => {
    if (item.href) {
      navigate(item.href);
    }
  }, [navigate]);

  const handleClear = useCallback(() => {
    setQuery("");
    setDebouncedQuery("");
    inputRef.current?.focus();
  }, []);

  return (
    <AppShell title="Search">
      <SEOHead title="Search — WealthBridge AI" description="Search across conversations, documents, and platform features." />

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Search input */}
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search conversations, documents, commands..."
              className="pl-10 pr-10 h-12 text-base bg-muted/10 border-border/50 focus-visible:ring-primary/30"
              autoFocus
            />
            {query && (
              <button
                onClick={handleClear}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-muted/30 transition-colors"
                aria-label="Clear search"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            )}
          </div>
          {debouncedQuery && !isLoading && (
            <p className="text-xs text-muted-foreground">
              {counts.all} result{counts.all !== 1 ? "s" : ""} for "{debouncedQuery}"
            </p>
          )}
        </div>

        {/* Tabs for filtering */}
        {debouncedQuery.length >= 2 && (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="bg-muted/20 h-9">
              <TabsTrigger value="all" className="text-xs gap-1.5 h-7">
                <Filter className="w-3 h-3" /> All
                {counts.all > 0 && <Badge variant="secondary" className="text-[9px] h-4 px-1">{counts.all}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="conversation" className="text-xs gap-1.5 h-7">
                <MessageSquare className="w-3 h-3" /> Chats
                {counts.conversation > 0 && <Badge variant="secondary" className="text-[9px] h-4 px-1">{counts.conversation}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="document" className="text-xs gap-1.5 h-7">
                <FileText className="w-3 h-3" /> Docs
                {counts.document > 0 && <Badge variant="secondary" className="text-[9px] h-4 px-1">{counts.document}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="unified" className="text-xs gap-1.5 h-7">
                <Layers className="w-3 h-3" /> Knowledge
                {counts.unified > 0 && <Badge variant="secondary" className="text-[9px] h-4 px-1">{counts.unified}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="command" className="text-xs gap-1.5 h-7">
                <Sparkles className="w-3 h-3" /> Commands
                {counts.command > 0 && <Badge variant="secondary" className="text-[9px] h-4 px-1">{counts.command}</Badge>}
              </TabsTrigger>
            </TabsList>

            {/* Results */}
            <div className="mt-4">
              {isLoading ? (
                <ResultSkeleton />
              ) : filteredResults.length === 0 ? (
                <EmptyState query={debouncedQuery} />
              ) : (
                <div className="space-y-2">
                  {filteredResults.map((item) => (
                    <ResultCard
                      key={item.id}
                      item={item}
                      query={debouncedQuery}
                      onClick={() => handleResultClick(item)}
                    />
                  ))}
                </div>
              )}
            </div>
          </Tabs>
        )}

        {/* Initial state (no query) */}
        {debouncedQuery.length < 2 && (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-full bg-primary/5 flex items-center justify-center mx-auto mb-4">
              <Search className="w-8 h-8 text-primary/30" />
            </div>
            <h3 className="text-lg font-medium mb-2">Global Search</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Search across your conversations, documents, knowledge base, and platform features.
              Type at least 2 characters to begin.
            </p>
            <div className="flex items-center justify-center gap-2 mt-4 text-xs text-muted-foreground">
              <kbd className="px-1.5 py-0.5 rounded bg-muted text-[10px] font-mono">⌘K</kbd>
              <span>Quick search from anywhere</span>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
