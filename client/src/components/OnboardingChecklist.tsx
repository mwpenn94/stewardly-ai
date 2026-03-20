import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  CheckCircle2, Circle, ChevronDown, ChevronUp, Sparkles,
  X, Loader2, RotateCcw, Rocket,
} from "lucide-react";

interface OnboardingChecklistProps {
  workflowType: "professional_onboarding" | "client_onboarding" | "licensing" | "registration";
  onStepAction?: (stepKey: string) => void;
  onDismiss?: () => void;
  compact?: boolean;
  enabled?: boolean;
}

export default function OnboardingChecklist({
  workflowType,
  onStepAction,
  onDismiss,
  compact = false,
  enabled = true,
}: OnboardingChecklistProps) {
  const [expanded, setExpanded] = useState(!compact);
  const utils = trpc.useUtils();

  const checklistQuery = trpc.workflow.getChecklist.useQuery({ workflowType }, { enabled });
  const completeStep = trpc.workflow.completeStep.useMutation({
    onSuccess: (data) => {
      utils.workflow.getChecklist.invalidate({ workflowType });
      if (data.allCompleted) {
        toast.success("Onboarding complete! You're all set.");
      } else {
        toast.success("Step completed!");
      }
    },
    onError: (e) => toast.error(e.message),
  });
  const resetWorkflow = trpc.workflow.reset.useMutation({
    onSuccess: () => {
      utils.workflow.getChecklist.invalidate({ workflowType });
      toast.info("Checklist reset");
    },
    onError: (e) => toast.error(e.message),
  });

  if (checklistQuery.isLoading) {
    return (
      <div className="p-4 rounded-xl border border-border bg-card/50 backdrop-blur-sm">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading checklist...
        </div>
      </div>
    );
  }

  const checklist = checklistQuery.data;
  if (!checklist) return null;

  const steps = Array.isArray(checklist.steps) ? checklist.steps : [];
  const completedCount = steps.filter((s: any) => s.completed).length;
  const totalSteps = steps.length;
  const progress = totalSteps > 0 ? Math.round((completedCount / totalSteps) * 100) : 0;
  const isComplete = checklist.status === "completed";

  if (isComplete && compact) return null;

  const typeLabels: Record<string, string> = {
    professional_onboarding: "Professional Setup",
    client_onboarding: "Getting Started",
    licensing: "Licensing Checklist",
    registration: "Registration",
  };

  return (
    <div className={`rounded-xl border ${isComplete ? "border-emerald-500/30 bg-emerald-500/5" : "border-accent/20 bg-accent/5"} backdrop-blur-sm overflow-hidden transition-all`}>
      {/* Header */}
      <div
        className="flex items-center gap-3 p-4 cursor-pointer select-none"
        onClick={() => setExpanded(!expanded)}
      >
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isComplete ? "bg-emerald-500/20" : "bg-accent/15"}`}>
          {isComplete ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Rocket className="w-4 h-4 text-accent" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">{typeLabels[workflowType] || "Onboarding"}</span>
            <Badge variant={isComplete ? "default" : "outline"} className="text-[9px]">
              {completedCount}/{totalSteps}
            </Badge>
          </div>
          <Progress value={progress} className="h-1.5 mt-1.5" />
        </div>
        <div className="flex items-center gap-1">
          {onDismiss && (
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={(e) => { e.stopPropagation(); onDismiss(); }}>
              <X className="w-3 h-3" />
            </Button>
          )}
          {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
      </div>

      {/* Steps */}
      {expanded && (
        <div className="px-4 pb-4 space-y-2">
          {steps.map((step: any, i: number) => (
            <div
              key={step.key}
              className={`flex items-start gap-3 p-3 rounded-lg transition-all ${
                step.completed
                  ? "bg-secondary/30 opacity-70"
                  : i === (checklist.currentStep || 0)
                    ? "bg-accent/10 border border-accent/20"
                    : "bg-secondary/20"
              }`}
            >
              <button
                className="mt-0.5 shrink-0"
                onClick={() => {
                  if (!step.completed) {
                    completeStep.mutate({ workflowType, stepKey: step.key });
                  }
                }}
                disabled={step.completed || completeStep.isPending}
              >
                {step.completed ? (
                  <CheckCircle2 className="w-4.5 h-4.5 text-emerald-400" />
                ) : (
                  <Circle className={`w-4.5 h-4.5 ${i === (checklist.currentStep || 0) ? "text-accent" : "text-muted-foreground/50"}`} />
                )}
              </button>
              <div className="flex-1 min-w-0">
                <p className={`text-sm ${step.completed ? "line-through text-muted-foreground" : "font-medium"}`}>
                  {step.label}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{step.description}</p>
              </div>
              {!step.completed && onStepAction && i === (checklist.currentStep || 0) && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 text-[10px] shrink-0"
                  onClick={() => onStepAction(step.key)}
                >
                  Go
                </Button>
              )}
            </div>
          ))}

          {/* Footer actions */}
          <div className="flex items-center justify-between pt-2 border-t border-border/30">
            <p className="text-[10px] text-muted-foreground">
              {isComplete ? "All steps completed!" : `${totalSteps - completedCount} steps remaining`}
            </p>
            {completedCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-[10px] text-muted-foreground"
                onClick={() => resetWorkflow.mutate({ workflowType })}
                disabled={resetWorkflow.isPending}
              >
                <RotateCcw className="w-3 h-3 mr-1" /> Reset
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
