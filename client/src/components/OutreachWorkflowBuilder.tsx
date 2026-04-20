/**
 * OutreachWorkflowBuilder — Visual workflow automation builder with email/SMS/wait/condition steps.
 * Adapted from stewardly-command-center for the WealthBridge platform.
 * Provides drag-to-reorder step builder for marketing automation sequences.
 */
import { useState } from "react";
import { Plus, Mail, MessageSquare, Clock, GitBranch, Trash2, ArrowDown, Phone, Zap, Linkedin, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface WorkflowStep {
  id: string;
  type: "email" | "sms" | "wait" | "condition" | "call" | "task" | "linkedin_inmail" | "dripify_sequence";
  config: Record<string, any>;
}

export interface OutreachWorkflow {
  id: string;
  name: string;
  trigger: string;
  status: "active" | "paused" | "draft";
  steps: WorkflowStep[];
  enrolledCount: number;
  completedCount: number;
  createdAt: string;
}

const stepTypeConfig: Record<WorkflowStep["type"], { icon: any; label: string; colorClass: string }> = {
  email: { icon: Mail, label: "Send Email", colorClass: "bg-blue-500/10 text-blue-400" },
  sms: { icon: MessageSquare, label: "Send SMS", colorClass: "bg-green-500/10 text-green-400" },
  wait: { icon: Clock, label: "Wait", colorClass: "bg-amber-500/10 text-amber-400" },
  condition: { icon: GitBranch, label: "Condition", colorClass: "bg-purple-500/10 text-purple-400" },
  call: { icon: Phone, label: "Schedule Call", colorClass: "bg-cyan-500/10 text-cyan-400" },
  task: { icon: Zap, label: "Create Task", colorClass: "bg-orange-500/10 text-orange-400" },
  linkedin_inmail: { icon: Linkedin, label: "LinkedIn InMail", colorClass: "bg-sky-500/10 text-sky-400" },
  dripify_sequence: { icon: Send, label: "Dripify Sequence", colorClass: "bg-indigo-500/10 text-indigo-400" },
};

let stepIdCounter = Date.now();

interface OutreachWorkflowBuilderProps {
  steps: WorkflowStep[];
  onChange: (steps: WorkflowStep[]) => void;
}

export default function OutreachWorkflowBuilder({ steps, onChange }: OutreachWorkflowBuilderProps) {
  const [showAddMenu, setShowAddMenu] = useState(false);

  const addStep = (type: WorkflowStep["type"]) => {
    const id = `step-${++stepIdCounter}`;
    const config: Record<string, any> = {};
    if (type === "email") config.template = "Default template";
    if (type === "sms") config.message = "";
    if (type === "wait") config.delayDays = 3;
    if (type === "condition") config.condition = "";
    if (type === "call") config.duration = 30;
    if (type === "task") config.description = "";
    if (type === "linkedin_inmail") config.template = "Default InMail";
    if (type === "dripify_sequence") config.campaignName = "";
    onChange([...steps, { id, type, config }]);
    setShowAddMenu(false);
  };

  const updateStep = (id: string, config: Record<string, any>) => {
    onChange(steps.map((s) => (s.id === id ? { ...s, config: { ...s.config, ...config } } : s)));
  };

  const removeStep = (id: string) => {
    onChange(steps.filter((s) => s.id !== id));
  };

  const moveStep = (index: number, direction: -1 | 1) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= steps.length) return;
    const newSteps = [...steps];
    [newSteps[index], newSteps[newIndex]] = [newSteps[newIndex], newSteps[index]];
    onChange(newSteps);
  };

  return (
    <div className="space-y-3">
      {steps.length === 0 && (
        <div className="text-center py-10 text-muted-foreground text-sm border border-dashed border-border rounded-lg">
          No steps yet. Add your first workflow step below.
        </div>
      )}

      {steps.map((step, index) => {
        const config = stepTypeConfig[step.type];
        const Icon = config.icon;
        return (
          <div key={step.id}>
            {index > 0 && (
              <div className="flex justify-center py-1">
                <ArrowDown className="w-4 h-4 text-muted-foreground" />
              </div>
            )}
            <div className="border border-border rounded-lg p-3 sm:p-4 bg-card">
              <div className="flex items-start gap-3">
                <div className={cn("p-2 rounded-lg flex-shrink-0", config.colorClass)}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">{config.label}</span>
                      <Badge variant="outline" className="text-[10px]">Step {index + 1}</Badge>
                    </div>
                    <div className="flex items-center gap-1">
                      {index > 0 && (
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveStep(index, -1)} aria-label="Move step up">
                          <ArrowDown className="w-3.5 h-3.5 rotate-180" />
                        </Button>
                      )}
                      {index < steps.length - 1 && (
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveStep(index, 1)} aria-label="Move step down">
                          <ArrowDown className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => removeStep(step.id)} aria-label="Remove step">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>

                  {step.type === "email" && (
                    <Input
                      value={step.config.template ?? ""}
                      onChange={(e) => updateStep(step.id, { template: e.target.value })}
                      placeholder="Email template name or subject..."
                      className="text-sm"
                    />
                  )}
                  {step.type === "sms" && (
                    <Textarea
                      value={step.config.message ?? ""}
                      onChange={(e) => updateStep(step.id, { message: e.target.value })}
                      placeholder="SMS message content..."
                      rows={2}
                      className="text-sm"
                    />
                  )}
                  {step.type === "wait" && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Wait</span>
                      <Input
                        type="number"
                        className="w-20 text-sm"
                        min={1}
                        value={step.config.delayDays ?? 3}
                        onChange={(e) => updateStep(step.id, { delayDays: Number(e.target.value) })}
                      />
                      <span className="text-sm text-muted-foreground">days</span>
                    </div>
                  )}
                  {step.type === "condition" && (
                    <Input
                      value={step.config.condition ?? ""}
                      onChange={(e) => updateStep(step.id, { condition: e.target.value })}
                      placeholder="e.g. opened_last_email = true"
                      className="text-sm"
                    />
                  )}
                  {step.type === "call" && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Duration:</span>
                      <Input
                        type="number"
                        className="w-20 text-sm"
                        min={5}
                        value={step.config.duration ?? 30}
                        onChange={(e) => updateStep(step.id, { duration: Number(e.target.value) })}
                      />
                      <span className="text-sm text-muted-foreground">minutes</span>
                    </div>
                  )}
                  {step.type === "task" && (
                    <Input
                      value={step.config.description ?? ""}
                      onChange={(e) => updateStep(step.id, { description: e.target.value })}
                      placeholder="Task description..."
                      className="text-sm"
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {/* Add step */}
      <div className="relative">
        <Button
          variant="outline"
          className="w-full gap-2"
          onClick={() => setShowAddMenu(!showAddMenu)}
        >
          <Plus className="w-4 h-4" /> Add Step
        </Button>
        {showAddMenu && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-lg z-10 p-1">
            {(Object.entries(stepTypeConfig) as [WorkflowStep["type"], typeof stepTypeConfig.email][]).map(
              ([type, config]) => {
                const Icon = config.icon;
                return (
                  <button
                    key={type}
                    onClick={() => addStep(type)}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-accent text-left text-sm transition-colors"
                  >
                    <div className={cn("p-1.5 rounded", config.colorClass)}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-foreground">{config.label}</span>
                  </button>
                );
              }
            )}
          </div>
        )}
      </div>
    </div>
  );
}
