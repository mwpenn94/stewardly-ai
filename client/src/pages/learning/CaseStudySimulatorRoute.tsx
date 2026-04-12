/**
 * CaseStudySimulatorRoute — Pass 4 fix for G10.
 *
 * Before this wrapper existed, `/learning/case/:caseId` mounted
 * `<CaseStudySimulator />` without any props, so the `:caseId` URL
 * segment was ignored and every navigation resolved to the same
 * hardcoded `DEMO_CASE` inside the simulator. The Learning Home's
 * "Case Studies" tile encoded a track slug in the URL to make it
 * LOOK track-scoped, but it never was.
 *
 * This wrapper reads `:caseId`, looks it up in the client-side
 * `CASE_STUDY_REGISTRY` (see `@/lib/caseStudyRegistry`), falls back
 * to the first registered case when the id is missing or unknown,
 * and renders a picker with every registered case when the path is
 * `/learning/case` with no id at all.
 *
 * The simulator component itself is unchanged — it still takes a
 * `caseStudy` prop and an `onBack` callback, both of which this
 * wrapper provides. Deleting this wrapper reverts to the pre-Pass-4
 * behavior cleanly.
 */

import { useMemo, useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import AppShell from "@/components/AppShell";
import { SEOHead } from "@/components/SEOHead";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Briefcase, Sparkles } from "lucide-react";
import CaseStudySimulator from "./CaseStudySimulator";
import {
  listCaseStudies,
  getCaseStudyById,
  type CaseStudyData,
} from "@/lib/caseStudyRegistry";

export default function CaseStudySimulatorRoute() {
  const params = useParams<{ caseId?: string }>();
  const [, navigate] = useLocation();
  const cases = useMemo(() => listCaseStudies(), []);

  // URL resolution: if the :caseId param exists, try to look it up. If
  // it doesn't match any registered case (e.g. an old link from before
  // Pass 4 that encoded a track slug), fall back to null so the picker
  // renders. A missing :caseId (route `/learning/case`) also renders
  // the picker.
  const urlCase: CaseStudyData | null = params?.caseId
    ? getCaseStudyById(params.caseId)
    : null;

  const [selected, setSelected] = useState<CaseStudyData | null>(urlCase);

  if (selected) {
    return (
      <AppShell title={`${selected.title} · Case Study`}>
        <SEOHead title={selected.title} description={selected.situation.slice(0, 140)} />
        <div className="py-4">
          <CaseStudySimulator
            caseStudy={selected}
            onBack={() => {
              // If we arrived via URL, go back to the picker so the
              // user can try another case without re-navigating from
              // the Home. If we arrived via the picker, go back to
              // it. Either way: land on the picker.
              setSelected(null);
              if (params?.caseId) {
                navigate("/learning/case");
              }
            }}
          />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Case Studies">
      <SEOHead title="Case Studies" description="Branching scenario practice for advisors" />
      <div className="mx-auto max-w-4xl p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/learning")}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Learning
          </Button>
        </div>
        <div>
          <h1 className="text-2xl font-heading font-semibold tracking-tight flex items-center gap-2">
            <Briefcase className="h-7 w-7 text-accent" />
            Case Studies
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Practice client scenarios with branching decisions. Every option
            is scored, and compliance flags surface when a choice crosses a
            fiduciary or suitability line.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          {cases.map((c) => (
            <Card
              key={c.id}
              className="card-lift cursor-pointer"
              onClick={() => {
                setSelected(c);
                navigate(`/learning/case/${c.id}`);
              }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setSelected(c);
                  navigate(`/learning/case/${c.id}`);
                }
              }}
              aria-label={`Start case study: ${c.title}`}
            >
              <CardContent className="p-5 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-semibold leading-snug">{c.title}</h2>
                  {c.difficulty && (
                    <Badge variant="outline" className="text-[10px] shrink-0 capitalize">
                      {c.difficulty}
                    </Badge>
                  )}
                </div>
                {c.discipline && (
                  <Badge variant="outline" className="text-[10px]">
                    {c.discipline}
                  </Badge>
                )}
                <p className="text-xs text-muted-foreground line-clamp-2">{c.clientProfile}</p>
                <p className="text-xs text-muted-foreground line-clamp-3">{c.situation}</p>
                <div className="flex items-center gap-1 text-[11px] text-accent">
                  <Sparkles className="h-3 w-3" />
                  {c.decisions.length} decision{c.decisions.length === 1 ? "" : "s"}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <p className="text-[11px] text-muted-foreground">
          Case studies are a curated set of scenario drills. To add your own,
          head to{" "}
          <Link href="/learning/studio">
            <a className="underline">Content Studio</a>
          </Link>
          .
        </p>
      </div>
    </AppShell>
  );
}
