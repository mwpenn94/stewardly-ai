/**
 * MyWork.tsx — Aggregated work dashboard
 */

import { useState } from "react";
import { useLocation } from "wouter";
import {
  Briefcase, ShieldCheck, FileText, Clock, AlertTriangle, CheckCircle2,
  ChevronRight, RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import AppShell from "@/components/AppShell";
import { SEOHead } from "@/components/SEOHead";

interface WorkItem {
  id: string;
  type: "case" | "compliance" | "workflow" | "document" | "task";
  title: string;
  subtitle?: string;
  status: "action-needed" | "in-progress" | "review" | "complete";
  priority: "high" | "medium" | "low";
  updatedAt: string;
  href: string;
}

const STATUS_CONFIG = {
  "action-needed": { label: "Needs Action", color: "text-rose-400", bgColor: "bg-rose-500/10", icon: AlertTriangle },
  "in-progress": { label: "In Progress", color: "text-chart-3", bgColor: "bg-chart-3/10", icon: Clock },
  review: { label: "In Review", color: "text-amber-400", bgColor: "bg-amber-500/10", icon: ShieldCheck },
  complete: { label: "Complete", color: "text-emerald-400", bgColor: "bg-emerald-500/10", icon: CheckCircle2 },
};

const TYPE_CONFIG = {
  case: { label: "Advisory Case", icon: Briefcase },
  compliance: { label: "Compliance", icon: ShieldCheck },
  workflow: { label: "Workflow", icon: RefreshCw },
  document: { label: "Document", icon: FileText },
  task: { label: "Task", icon: CheckCircle2 },
};

interface MyWorkProps {
  items?: WorkItem[];
  isLoading?: boolean;
}

export default function MyWork({ items = [], isLoading = false }: MyWorkProps) {
  const [, navigate] = useLocation();
  const [filter, setFilter] = useState<string>("all");

  const actionNeeded = items.filter((i) => i.status === "action-needed");
  const inProgress = items.filter((i) => i.status === "in-progress");
  const inReview = items.filter((i) => i.status === "review");
  const recentComplete = items.filter((i) => i.status === "complete").slice(0, 5);

  const sections = [
    { key: "action-needed", title: "Needs Your Action", items: actionNeeded, emptyText: "Nothing needs your attention right now." },
    { key: "in-progress", title: "In Progress", items: inProgress, emptyText: "No active work items." },
    { key: "review", title: "Awaiting Review", items: inReview, emptyText: "Nothing in review." },
    { key: "complete", title: "Recently Completed", items: recentComplete, emptyText: "" },
  ];

  return (
    <AppShell title="My Work">
      <SEOHead title="My Work" description="Aggregated work dashboard and task management" />
    <div className="max-w-3xl mx-auto px-4 py-6 pb-20 md:pb-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-heading text-2xl font-bold">My Work</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {actionNeeded.length > 0 ? `${actionNeeded.length} item${actionNeeded.length > 1 ? "s" : ""} need your attention` : "You're all caught up"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6">
        {(["action-needed", "in-progress", "review", "complete"] as const).map((status) => {
          const config = STATUS_CONFIG[status];
          const count = items.filter((i) => i.status === status).length;
          return (
            <button key={status} onClick={() => setFilter(filter === status ? "all" : status)}
              className={`flex flex-col items-center py-2 px-1 rounded-lg border cursor-pointer transition-colors
                ${filter === status ? "border-primary bg-primary/5" : "border-border hover:border-primary/20"}`}>
              <span className={`text-lg font-heading font-bold ${config.color}`}>{count}</span>
              <span className="text-[10px] text-muted-foreground text-center leading-tight mt-0.5">{config.label}</span>
            </button>
          );
        })}
      </div>

      {sections.filter((s) => filter === "all" || s.key === filter).map((section) => (
        <div key={section.key} className="mb-6">
          <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-2 px-1">{section.title}</h2>
          {section.items.length === 0 && section.emptyText ? (
            <p className="text-sm text-muted-foreground/60 px-1 py-3">{section.emptyText}</p>
          ) : (
            <div className="space-y-1">
              {section.items.map((item) => {
                const typeConf = TYPE_CONFIG[item.type];
                const statusConf = STATUS_CONFIG[item.status];
                return (
                  <button key={item.id} onClick={() => navigate(item.href)}
                    className="w-full flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-card/80 transition-colors cursor-pointer text-left group">
                    <div className={`flex items-center justify-center w-8 h-8 rounded-lg ${statusConf.bgColor} flex-none`}>
                      <typeConf.icon className={`w-4 h-4 ${statusConf.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">{item.title}</div>
                      {item.subtitle && <div className="text-xs text-muted-foreground truncate">{item.subtitle}</div>}
                    </div>
                    <div className="flex items-center gap-2 flex-none">
                      {item.priority === "high" && <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />}
                      <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ))}

      {items.length === 0 && !isLoading && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <CheckCircle2 className="w-6 h-6 text-primary" />
          </div>
          <h3 className="font-heading text-lg font-semibold mb-1">All clear</h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            No active cases, compliance reviews, or workflows. Start a conversation with Steward to begin a new advisory case.
          </p>
          <Button size="sm" className="mt-4 gap-2 cursor-pointer" onClick={() => navigate("/chat")}>Open Chat</Button>
        </div>
      )}
    </div>
    </AppShell>
  );
}
