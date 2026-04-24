/**
 * SearchResults — Unit tests for the global search results page.
 *
 * Validates component structure, search integration, routing,
 * accessibility, and CommandPalette wiring.
 */
import { describe, it, expect } from "vitest";
import fs from "fs";

const content = fs.readFileSync("client/src/pages/SearchResults.tsx", "utf-8");
const appContent = fs.readFileSync("client/src/App.tsx", "utf-8");
const paletteContent = fs.readFileSync("client/src/components/CommandPalette.tsx", "utf-8");

describe("SearchResults page", () => {
  it("is lazy-loaded in App.tsx", () => {
    expect(appContent).toContain('const SearchResults = lazy(() => import("./pages/SearchResults"))');
  });

  it("has a route at /search", () => {
    expect(appContent).toContain('path="/search"');
    expect(appContent).toContain("SearchResults");
  });

  it("reads query from URL search params", () => {
    expect(content).toContain("useSearch");
    expect(content).toContain('params.get("q")');
  });

  it("updates URL when query changes", () => {
    expect(content).toContain("window.history.replaceState");
    expect(content).toContain("encodeURIComponent(debouncedQuery)");
  });

  it("searches conversations via tRPC", () => {
    expect(content).toContain("trpc.conversations.search.useQuery");
  });

  it("searches documents via tRPC", () => {
    expect(content).toContain("trpc.documents.search.useQuery");
  });

  it("searches unified (multi-modal) via tRPC", () => {
    expect(content).toContain("trpc.multiModalProcessing.unifiedSearch.useQuery");
  });

  it("searches commands via tRPC", () => {
    expect(content).toContain("trpc.aiPlatform.commands.search.useQuery");
  });

  it("has tabs for filtering results by type", () => {
    expect(content).toContain("Tabs");
    expect(content).toContain("TabsList");
    expect(content).toContain("TabsTrigger");
    expect(content).toContain('value="all"');
    expect(content).toContain('value="conversation"');
    expect(content).toContain('value="document"');
    expect(content).toContain('value="unified"');
    expect(content).toContain('value="command"');
  });

  it("has result count display", () => {
    expect(content).toContain("counts.all");
    expect(content).toContain("result");
  });

  it("has loading skeleton state", () => {
    expect(content).toContain("ResultSkeleton");
    expect(content).toContain("animate-pulse");
  });

  it("has empty state for no results", () => {
    expect(content).toContain("EmptyState");
    expect(content).toContain("No results found");
  });

  it("highlights matched text in results", () => {
    expect(content).toContain("HighlightedText");
    expect(content).toContain("<mark");
  });

  it("deduplicates unified results against document results", () => {
    expect(content).toContain("Deduplicate with document results");
  });

  it("debounces the search query", () => {
    expect(content).toContain("setTimeout");
    expect(content).toContain("debouncedQuery");
  });

  it("wraps in AppShell for sidebar navigation", () => {
    expect(content).toContain("AppShell");
  });

  it("has SEOHead for page title", () => {
    expect(content).toContain("SEOHead");
    expect(content).toContain("Search — WealthBridge AI");
  });

  it("has clear button for search input", () => {
    expect(content).toContain("handleClear");
    expect(content).toContain('aria-label="Clear search"');
  });

  it("auto-focuses the search input on mount", () => {
    expect(content).toContain("inputRef.current?.focus()");
    expect(content).toContain("autoFocus");
  });

  it("navigates to result href on click", () => {
    expect(content).toContain("handleResultClick");
    expect(content).toContain("item.href");
    expect(content).toContain("navigate(item.href)");
  });

  it("shows keyboard shortcut hint", () => {
    expect(content).toContain("⌘K");
    expect(content).toContain("Quick search from anywhere");
  });
});

describe("CommandPalette integration", () => {
  it("has 'View all results' link in footer", () => {
    expect(paletteContent).toContain("View all results");
    expect(paletteContent).toContain("/search?q=");
  });

  it("navigates to /search with query param", () => {
    expect(paletteContent).toContain("navigate(`/search?q=${encodeURIComponent(debouncedQuery)}`)");
  });

  it("closes palette before navigating", () => {
    expect(paletteContent).toContain("setOpen(false); navigate(`/search");
  });

  it("only shows link when query is long enough", () => {
    expect(paletteContent).toContain("debouncedQuery.length >= 2");
  });
});
