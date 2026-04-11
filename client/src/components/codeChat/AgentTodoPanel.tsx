/**
 * AgentTodoPanel — renders a live agent todo list (Pass 237).
 *
 * Two shapes:
 *   - `live`: rendered during execution as a sticky top-of-chat
 *     summary strip showing "Currently: <activeForm>" + counts
 *   - `card`: rendered below the finished assistant message with the
 *     full list for historical context
 *
 * Pure presentational — state lives in the parent.
 */

import { CheckCircle2, Circle, Loader2, ListTodo } from "lucide-react";
import {
  todoProgress,
  currentTodo,
  type AgentTodoItem,
  type TodoStatus,
} from "./agentTodos";

const STATUS_ICON: Record<TodoStatus, { Icon: typeof CheckCircle2; cls: string }> = {
  pending: { Icon: Circle, cls: "text-muted-foreground/70" },
  in_progress: { Icon: Loader2, cls: "text-chart-3 animate-spin" },
  completed: { Icon: CheckCircle2, cls: "text-emerald-500" },
};

interface AgentTodoPanelProps {
  todos: AgentTodoItem[];
  variant: "live" | "card";
}

export default function AgentTodoPanel({ todos, variant }: AgentTodoPanelProps) {
  if (todos.length === 0) return null;
  const progress = todoProgress(todos);
  const current = currentTodo(todos);

  if (variant === "live") {
    return (
      <div
        className="mb-2 flex items-center gap-2 rounded-lg border border-chart-3/30 bg-chart-3/5 px-3 py-2 text-xs"
        role="status"
        aria-live="polite"
        aria-label="Agent progress"
      >
        <ListTodo className="h-3.5 w-3.5 text-chart-3 shrink-0" />
        <span className="text-muted-foreground font-mono shrink-0">
          {progress.completed}/{progress.total}
        </span>
        <div className="h-1 flex-1 rounded-full bg-muted overflow-hidden min-w-[60px]">
          <div
            className="h-full bg-gradient-to-r from-chart-3 via-accent to-emerald-500 transition-all duration-300"
            style={{ width: `${progress.pct * 100}%` }}
          />
        </div>
        {current && (
          <span className="text-chart-3 truncate min-w-0" title={current.activeForm}>
            {current.status === "in_progress" ? current.activeForm : `Next: ${current.content}`}
          </span>
        )}
      </div>
    );
  }

  return (
    <div
      className="my-3 rounded-xl border border-border/40 bg-card/40 overflow-hidden"
      role="region"
      aria-label="Agent todo list"
    >
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border/30 bg-background/40">
        <div className="flex items-center gap-2 min-w-0">
          <ListTodo className="h-3.5 w-3.5 text-chart-3 shrink-0" />
          <span className="text-xs font-medium text-foreground">Todos</span>
          <span className="text-[10px] text-muted-foreground font-mono tabular-nums">
            {progress.completed}/{progress.total}
          </span>
        </div>
        <span
          className={`text-[10px] font-mono tabular-nums ${
            progress.allDone
              ? "text-emerald-500"
              : progress.inProgress > 0
                ? "text-chart-3"
                : "text-muted-foreground"
          }`}
        >
          {Math.round(progress.pct * 100)}%
        </span>
      </div>
      <ul className="divide-y divide-border/20">
        {todos.map((t) => {
          const { Icon, cls } = STATUS_ICON[t.status];
          return (
            <li
              key={t.id}
              className="flex items-start gap-2 px-3 py-2 text-xs"
              aria-label={`${t.content} — ${t.status}`}
            >
              <Icon className={`h-3 w-3 mt-0.5 shrink-0 ${cls}`} />
              <span
                className={`flex-1 min-w-0 ${
                  t.status === "completed"
                    ? "text-muted-foreground line-through"
                    : t.status === "in_progress"
                      ? "text-chart-3 font-medium"
                      : "text-foreground"
                }`}
              >
                {t.status === "in_progress" ? t.activeForm : t.content}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
