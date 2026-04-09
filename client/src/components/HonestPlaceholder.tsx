/**
 * HonestPlaceholder — banner for pages whose UI is ready but the
 * data layer / integration isn't yet.
 *
 * Shows a friendly "coming soon" message with what the feature will do
 * and a link to a working alternative the user can use today.
 */
import { Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "wouter";

export interface HonestPlaceholderProps {
  /** What this page WILL do once it's live (one short sentence). */
  willDo: string;
  /** What's needed to wire it up — shown only to admins or hidden entirely. */
  needed: string;
  /** A working alternative the user can use TODAY (route + label). */
  workingAlternative?: { href: string; label: string };
}

export default function HonestPlaceholder({
  willDo,
  workingAlternative,
}: HonestPlaceholderProps) {
  return (
    <Card className="border-accent/30 bg-accent/5">
      <CardContent className="py-3 flex items-start gap-2.5 text-sm">
        <div className="p-1 rounded-md bg-accent/10 shrink-0 mt-0.5">
          <Clock className="w-3.5 h-3.5 text-accent" aria-hidden="true" />
        </div>
        <div className="space-y-1">
          <p className="text-foreground/90">
            <strong className="font-semibold text-accent">Coming soon</strong>{" — "}
            {willDo}
          </p>
          {workingAlternative && (
            <p className="text-xs text-muted-foreground">
              In the meantime, try{" "}
              <Link
                href={workingAlternative.href}
                className="text-accent underline underline-offset-2 hover:text-accent/80 transition-colors"
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
