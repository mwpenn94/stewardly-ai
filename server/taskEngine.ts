/**
 * Task Engine — Practice management task tracking
 * Part F: Operational Tools
 *
 * No API keys needed. Manages advisor tasks, deadlines, priorities.
 */

import { getDb } from "./db";
import { eq, and, desc, asc, lte, isNull } from "drizzle-orm";

export type TaskPriority = "urgent" | "high" | "medium" | "low";
export type TaskStatus = "pending" | "in_progress" | "completed" | "cancelled" | "overdue";
export type TaskCategory = "client_review" | "compliance" | "onboarding" | "follow_up" | "planning" | "admin" | "meeting_prep" | "document" | "other";

export interface TaskInput {
  title: string;
  description?: string;
  priority: TaskPriority;
  category: TaskCategory;
  dueDate?: string; // ISO date
  assignedTo?: number; // userId
  clientId?: number;
  relatedEntityType?: string;
  relatedEntityId?: number;
  recurring?: boolean;
  recurringInterval?: "daily" | "weekly" | "monthly" | "quarterly" | "annually";
}

export interface TaskSummary {
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
  overdue: number;
  byPriority: Record<TaskPriority, number>;
  byCategory: Record<string, number>;
  upcomingDeadlines: { id: number; title: string; dueDate: string; priority: TaskPriority }[];
}

export function generateTaskSummary(tasks: any[]): TaskSummary {
  const now = new Date();
  const summary: TaskSummary = {
    total: tasks.length,
    pending: 0,
    inProgress: 0,
    completed: 0,
    overdue: 0,
    byPriority: { urgent: 0, high: 0, medium: 0, low: 0 },
    byCategory: {},
    upcomingDeadlines: [],
  };

  for (const t of tasks) {
    const status = t.status as TaskStatus;
    if (status === "pending") summary.pending++;
    else if (status === "in_progress") summary.inProgress++;
    else if (status === "completed") summary.completed++;

    if (t.dueDate && new Date(t.dueDate) < now && status !== "completed" && status !== "cancelled") {
      summary.overdue++;
    }

    const priority = (t.priority || "medium") as TaskPriority;
    summary.byPriority[priority] = (summary.byPriority[priority] || 0) + 1;

    const cat = t.category || "other";
    summary.byCategory[cat] = (summary.byCategory[cat] || 0) + 1;

    if (t.dueDate && new Date(t.dueDate) > now && status !== "completed") {
      summary.upcomingDeadlines.push({
        id: t.id,
        title: t.title,
        dueDate: t.dueDate,
        priority,
      });
    }
  }

  summary.upcomingDeadlines.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  summary.upcomingDeadlines = summary.upcomingDeadlines.slice(0, 10);

  return summary;
}

export function suggestTasks(clientData: {
  lastReviewDate?: string;
  hasOpenItems?: boolean;
  upcomingBirthday?: boolean;
  recentLifeEvent?: string;
  portfolioNeedsRebalance?: boolean;
}): TaskInput[] {
  const suggestions: TaskInput[] = [];

  if (clientData.lastReviewDate) {
    const daysSinceReview = Math.floor((Date.now() - new Date(clientData.lastReviewDate).getTime()) / 86400000);
    if (daysSinceReview > 180) {
      suggestions.push({
        title: "Schedule semi-annual review",
        description: `Last review was ${daysSinceReview} days ago`,
        priority: daysSinceReview > 365 ? "urgent" : "high",
        category: "client_review",
      });
    }
  }

  if (clientData.upcomingBirthday) {
    suggestions.push({
      title: "Send birthday greeting",
      priority: "low",
      category: "follow_up",
    });
  }

  if (clientData.recentLifeEvent) {
    suggestions.push({
      title: `Follow up on life event: ${clientData.recentLifeEvent}`,
      description: "Review financial plan implications",
      priority: "high",
      category: "planning",
    });
  }

  if (clientData.portfolioNeedsRebalance) {
    suggestions.push({
      title: "Portfolio rebalancing needed",
      description: "Drift exceeds threshold",
      priority: "medium",
      category: "planning",
    });
  }

  if (clientData.hasOpenItems) {
    suggestions.push({
      title: "Follow up on open action items",
      priority: "medium",
      category: "follow_up",
    });
  }

  return suggestions;
}
