/**
 * HonestPlaceholder — banner for stub pages whose UI is wired but the
 * data layer / integration isn't yet.
 *
 * Per v10.0 prompt Target 5: every placeholder page must show
 *   - what this page WILL do
 *   - what's needed to make it live
 *   - a link to the feature that works TODAY
 *
 * Replaces the 7 inline "Design preview" banner blocks that were
 * duplicated across BillingPage, APIKeys, TeamManagement,
 * ClientDashboard, AdminLeadSources, AdminRateManagement, CRMSync.
 */
import { AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "wouter";

export interface HonestPlaceholderProps {
  /** What this page WILL do once it's live (one short sentence). */
  willDo: string;
  /** What's needed to wire it up (env var, integration, migration, etc.). */
  needed: string;
  /** A working alternative the user can use TODAY (route + label). */
  workingAlternative?: { href: string; label: string };
}

export default function HonestPlaceholder({
  willDo,
  needed,
  workingAlternative,
}: HonestPlaceholderProps) {
  return (
    <Card className="border-amber-500/40 bg-amber-500/5">
      <CardContent className="py-3 flex items-start gap-2 text-amber-600 dark:text-amber-400 text-sm">
        <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
        <div className="space-y-1">
          <p>
            <strong className="font-semibold">Design preview — not live data.</strong>{" "}
            {willDo}
          </p>
          <p className="text-xs text-amber-700/80 dark:text-amber-400/70">
            <span className="font-semibold">To make this live:</span> {needed}
          </p>
          {workingAlternative && (
            <p className="text-xs text-amber-700/80 dark:text-amber-400/70">
              <span className="font-semibold">Working alternative today:</span>{" "}
              <Link
                href={workingAlternative.href}
                className="underline underline-offset-2 hover:text-amber-600 dark:hover:text-amber-300"
              >
                {workingAlternative.label}
              </Link>
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
