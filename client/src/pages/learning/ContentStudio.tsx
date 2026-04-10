/**
 * EMBA Learning — Content Studio hub (Task 6D-E + Task 7).
 *
 * Advisor/Admin landing page for authoring learning content. Provides
 * entry points to:
 *   - Definition editor (create custom definitions, flashcards)
 *   - Track builder (custom learning tracks)
 *   - Review queue (admin-only pending regulatory updates)
 *   - Seed / bulk operations (admin-only)
 *
 * Authoring is gated by role: non-advisors are redirected away.
 */

import AppShell from "@/components/AppShell";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, FileText, BookOpen, Wrench, Shield, Plus } from "lucide-react";
import { toast } from "sonner";
import { Redirect } from "wouter";

export default function ContentStudio() {
  const meQ = trpc.auth.me.useQuery();
  const role = meQ.data?.role ?? "user";
  const isAdvisorPlus = role === "advisor" || role === "manager" || role === "admin";
  const isAdmin = role === "admin";

  const defsQ = trpc.learning.content.listDefinitions.useQuery({ limit: 20 });
  const tracksQ = trpc.learning.content.listTracks.useQuery({ limit: 50 });
  const pendingQ = trpc.learning.freshness.pendingUpdates.useQuery(undefined, { enabled: isAdmin });
  const utils = trpc.useUtils();

  const createDefMut = trpc.learning.content.createDefinition.useMutation({
    onSuccess: () => {
      toast.success("Definition drafted");
      utils.learning.content.listDefinitions.invalidate();
      setTerm("");
      setDefinition("");
    },
    onError: (e) => toast.error(e.message),
  });

  const seedMut = trpc.learning.seed.useMutation({
    onSuccess: (r) => {
      const errors = (r as any).errors as string[] | undefined;
      const added = r.disciplines + r.tracks;
      if (added === 0 && errors && errors.length > 0) {
        // Bubble up the first real error so operators can diagnose
        // the DB/schema/migration issue instead of seeing "0 inserted".
        toast.error(`Seed failed: ${errors[0]}`);
      } else {
        toast.success(
          `Seeded ${r.disciplines} disciplines, ${r.tracks} tracks (${r.skipped} skipped)` +
            (errors && errors.length ? ` · ${errors.length} non-fatal errors` : ""),
        );
      }
      utils.learning.content.listTracks.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const importMut = trpc.learning.importFromGitHub.useMutation({
    onSuccess: (r) => {
      const { counts, errors } = r;
      const added =
        counts.definitions + counts.tracks + counts.chapters + counts.questions + counts.flashcards;
      if (added === 0 && errors.length > 0) {
        toast.error(`Import failed: ${errors[0]}`);
      } else {
        toast.success(
          `Imported ${counts.definitions} definitions, ${counts.chapters} chapters, ` +
            `${counts.subsections} subsections, ${counts.questions} questions, ${counts.flashcards} flashcards` +
            (errors.length ? ` (${errors.length} non-fatal errors)` : ""),
        );
      }
      utils.learning.content.listTracks.invalidate();
      utils.learning.content.listDefinitions.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const [term, setTerm] = useState("");
  const [definition, setDefinition] = useState("");

  if (meQ.isLoading) {
    return <AppShell title="Content Studio"><div className="p-6 text-sm text-muted-foreground">Loading…</div></AppShell>;
  }
  if (!isAdvisorPlus) {
    return <Redirect to="/learning" />;
  }

  const defs = defsQ.data ?? [];
  const tracks = tracksQ.data ?? [];
  const pending = pendingQ.data ?? [];

  return (
    <AppShell title="Content Studio">
      <div className="mx-auto max-w-5xl p-6 space-y-6">
        <header>
          <h1 className="text-3xl font-semibold flex items-center gap-2">
            <Sparkles className="h-8 w-8 text-primary" />
            Content Studio
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Author definitions, tracks, and practice questions. All changes are versioned and audited.
          </p>
        </header>

        <div className="grid md:grid-cols-4 gap-3">
          <StudioTile icon={<FileText className="h-5 w-5" />} label="Definitions" count={defs.length} />
          <StudioTile icon={<BookOpen className="h-5 w-5" />} label="Tracks" count={tracks.length} />
          <StudioTile icon={<Wrench className="h-5 w-5" />} label="Authors" count={isAdvisorPlus ? "you" : "—"} />
          <StudioTile icon={<Shield className="h-5 w-5" />} label="Review Queue" count={pending.length} />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Draft a Definition
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Term</Label>
              <Input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="e.g. IRMAA" />
            </div>
            <div>
              <Label>Definition</Label>
              <Textarea
                rows={4}
                value={definition}
                onChange={(e) => setDefinition(e.target.value)}
                placeholder="Income-Related Monthly Adjustment Amount — Medicare surcharge based on MAGI..."
              />
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={() => createDefMut.mutate({ term, definition, visibility: "private", status: "draft" })}
                disabled={!term || !definition || createDefMut.isPending}
              >
                Save draft
              </Button>
              <div className="text-xs text-muted-foreground">
                Drafts are private until you publish. Only advisors+ can publish.
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Definitions</CardTitle>
          </CardHeader>
          <CardContent>
            {defs.length === 0 ? (
              <div className="text-sm text-muted-foreground">No definitions yet.</div>
            ) : (
              <ul className="divide-y">
                {defs.map((d: any) => (
                  <li key={d.id} className="py-2 flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium">{d.term}</div>
                      <div className="text-xs text-muted-foreground line-clamp-2">{d.definition}</div>
                    </div>
                    <div className="flex gap-1">
                      <Badge variant="outline">{d.status}</Badge>
                      <Badge variant="secondary">{d.visibility}</Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {isAdmin && (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Regulatory Review Queue
                </CardTitle>
              </CardHeader>
              <CardContent>
                {pending.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No pending regulatory updates.</div>
                ) : (
                  <ul className="space-y-2">
                    {pending.map((u: any) => (
                      <li key={u.id} className="p-3 border rounded-md">
                        <div className="flex items-center gap-2">
                          <Badge>{u.source}</Badge>
                          <Badge variant="outline">{u.category}</Badge>
                          <div className="font-medium">{u.title}</div>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">{u.summary}</div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Initial Seed</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-between gap-3">
                <div className="text-sm text-muted-foreground">
                  Populate the 12 canonical exam tracks and 8 core disciplines. Idempotent — safe to re-run.
                </div>
                <Button onClick={() => seedMut.mutate()} disabled={seedMut.isPending}>
                  Run seed
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Import from emba_modules</CardTitle>
              </CardHeader>
              <CardContent className="flex items-start justify-between gap-3">
                <div className="text-sm text-muted-foreground">
                  Pull the full EMBA payload (disciplines + definitions + tracks + chapters + subsections +
                  practice questions + flashcards) from{" "}
                  <a
                    href="https://github.com/mwpenn94/emba_modules"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    github.com/mwpenn94/emba_modules
                  </a>
                  . Idempotent — every insert is dedup-gated by slug/term/title.
                </div>
                <Button
                  onClick={() => importMut.mutate()}
                  disabled={importMut.isPending}
                  variant="outline"
                >
                  {importMut.isPending ? "Importing…" : "Import from GitHub"}
                </Button>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AppShell>
  );
}

function StudioTile(props: { icon: React.ReactNode; label: string; count: number | string }) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className="text-primary">{props.icon}</div>
        <div>
          <div className="text-xs text-muted-foreground uppercase tracking-wide">{props.label}</div>
          <div className="text-2xl font-semibold">{props.count}</div>
        </div>
      </CardContent>
    </Card>
  );
}
