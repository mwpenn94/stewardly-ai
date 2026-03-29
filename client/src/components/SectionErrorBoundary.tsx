import { Component, type ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  /** Friendly name shown in the error card, e.g. "Client Account Connections" */
  sectionName?: string;
  /**
   * Optional callback invoked when the user clicks "Retry".
   * Use this to invalidate tRPC queries for the section's data so the
   * re-render fetches fresh data instead of replaying stale cache.
   *
   * Example:
   * ```tsx
   * const utils = trpc.useUtils();
   * <SectionErrorBoundary
   *   sectionName="Account Connections"
   *   onRetry={() => {
   *     utils.integrations.listProviders.invalidate();
   *     utils.integrations.listConnections.invalidate();
   *   }}
   * >
   * ```
   */
  onRetry?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  retryCount: number;
}

/**
 * Section-level error boundary that catches render errors in a sub-component
 * and displays a recovery card instead of crashing the entire page.
 *
 * When the user clicks "Retry":
 * 1. The optional `onRetry` callback fires (invalidate queries, clear caches, etc.)
 * 2. The error state resets so the children re-render with fresh data
 */
export class SectionErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, retryCount: 0 };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(
      `[SectionErrorBoundary] ${this.props.sectionName || "Section"} crashed (retry #${this.state.retryCount}):`,
      error,
      info.componentStack
    );
  }

  handleRetry = () => {
    // Fire the callback first so queries are invalidated before re-render
    try {
      this.props.onRetry?.();
    } catch (e) {
      console.warn("[SectionErrorBoundary] onRetry callback threw:", e);
    }
    this.setState((prev) => ({
      hasError: false,
      error: null,
      retryCount: prev.retryCount + 1,
    }));
  };

  render() {
    if (this.state.hasError) {
      const maxRetriesReached = this.state.retryCount >= 3;

      return (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base text-destructive">
              <AlertTriangle className="h-5 w-5" />
              {this.props.sectionName || "Section"} — Error
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {maxRetriesReached
                ? "This section failed to load after multiple attempts. Try refreshing the page."
                : "Something went wrong loading this section. This won't affect other parts of the page."}
            </p>
            {this.state.error && (
              <pre className="text-xs text-destructive/80 bg-destructive/5 border border-destructive/20 rounded-md p-2 overflow-x-auto max-h-20">
                {this.state.error.message}
              </pre>
            )}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={this.handleRetry}
                disabled={maxRetriesReached}
                className="gap-1.5"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                {maxRetriesReached ? "Retry limit reached" : `Retry${this.state.retryCount > 0 ? ` (${this.state.retryCount}/3)` : ""}`}
              </Button>
              {maxRetriesReached && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.location.reload()}
                  className="gap-1.5"
                >
                  Refresh page
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
}

export default SectionErrorBoundary;
