/**
 * DiscoveryHistory.tsx — AI self-discovery follow-up questions log
 *
 * Pass 36. Shows the history of AI-generated follow-up questions
 * from the continuous self-discovery feature, with answers and timestamps.
 */
import { useState, useMemo } from "react";
import { Link } from "wouter";
import AppShell from "@/components/AppShell";
import { SEOHead } from "@/components/SEOHead";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Compass, ArrowLeft, Search, MessageCircle,
  Lightbulb, Clock, ChevronDown, ChevronUp,
} from "lucide-react";

export default function DiscoveryHistory() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // @ts-expect-error — property access on loosely typed object
  const historyQ = trpc.learningSocial.discoveryHistory.list.useQuery(
    { limit: 100 },
    { enabled: !!isAuthenticated }
  );

  const filteredHistory = useMemo(() => {
    const items = historyQ.data ?? [];
    if (!searchTerm) return items;
    const q = searchTerm.toLowerCase();
    return items.filter((h: any) =>
      (h.question ?? "").toLowerCase().includes(q) ||
      (h.answer ?? "").toLowerCase().includes(q) ||
      (h.topic ?? "").toLowerCase().includes(q)
    );
  }, [historyQ.data, searchTerm]);

  // Auth guard
  if (authLoading) {
    return <AppShell><div className="container py-8"><Skeleton className="h-64 w-full" /></div></AppShell>;
  }
  if (!isAuthenticated) {
    return (
      <AppShell>
        <SEOHead title="Discovery History" description="Your AI exploration journey" />
        <div className="container py-16 text-center space-y-4">
          <Compass className="mx-auto h-12 w-12 text-muted-foreground" />
          <h1 className="text-2xl font-bold">Discovery History</h1>
          <p className="text-muted-foreground">Sign in to view your discovery history.</p>
          <Button onClick={() => window.location.href = getLoginUrl("/learning/discovery")}>Sign In</Button>
        </div>
      </AppShell>
    );
  }

  const total = historyQ.data?.length ?? 0;

  return (
    <AppShell>
      <SEOHead title="Discovery History" description="Your AI exploration journey" />
      <div className="container max-w-3xl py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/learning"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Compass className="h-6 w-6 text-primary" />
              Discovery History
            </h1>
            <p className="text-sm text-muted-foreground">{total} explorations</p>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search discoveries..." className="pl-9" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>

        {/* List */}
        {historyQ.isLoading ? (
          <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
        ) : filteredHistory.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Compass className="mx-auto h-12 w-12 opacity-30 mb-3" />
            <p>{searchTerm ? "No discoveries match your search" : "No discovery history yet. Enable self-discovery in Settings to start exploring."}</p>
            {!searchTerm && (
              <Button variant="outline" className="mt-4" asChild>
                <Link href="/settings">Go to Settings</Link>
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredHistory.map((item: any) => {
              const isExpanded = expandedId === item.id;
              return (
                <Card key={item.id} className="hover:border-primary/30 transition-colors cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : item.id)}>
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Lightbulb className="h-4 w-4 text-yellow-500 flex-shrink-0" />
                          {item.topic && <Badge variant="secondary" className="text-xs">{item.topic}</Badge>}
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : ""}
                          </span>
                        </div>
                        <p className="font-medium text-sm">{item.question}</p>
                        {isExpanded && item.answer && (
                          <div className="mt-3 p-3 rounded-lg bg-muted/50 text-sm">
                            <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                              <MessageCircle className="h-3 w-3" /> AI Response
                            </div>
                            <p className="whitespace-pre-wrap">{item.answer}</p>
                          </div>
                        )}
                      </div>
                      <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
