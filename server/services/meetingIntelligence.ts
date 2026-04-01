/**
 * Meeting Intelligence — transcription pipeline, pre-meeting briefs, action items (1C)
 */
import { getDb } from "../db";
import { meetings } from "../../drizzle/schema";
import { eq, and, gte, lte, desc } from "drizzle-orm";
import { contextualLLM } from "../shared/intelligence/sovereignWiring"
import { contextualLLM } from "./contextualLLM";

export interface TranscriptionSegment {
  speaker: string;
  text: string;
  startMs: number;
  endMs: number;
  confidence: number;
}

export interface MeetingBrief {
  clientName: string;
  lastMeetingDate?: string;
  lastMeetingSummary?: string;
  openActionItems: string[];
  portfolioHighlights: string[];
  recentLifeEvents: string[];
  suggestedTopics: string[];
  complianceReminders: string[];
}

export interface ActionItem {
  description: string;
  assignee: string;
  dueDate?: string;
  priority: "high" | "medium" | "low";
  category: "follow_up" | "document" | "review" | "compliance" | "planning";
}

export interface MeetingSummary {
  keyTopics: string[];
  decisions: string[];
  actionItems: ActionItem[];
  clientSentiment: "positive" | "neutral" | "concerned";
  complianceNotes: string[];
  nextSteps: string;
  duration: number;
}

// ─── Pre-Meeting Brief ─────────────────────────────────────────────────────
export async function generatePreMeetingBrief(userId: number, clientId: number): Promise<MeetingBrief> {
  const db = (await getDb())!;
  const recentMeetings = await db.select().from(meetings)
    .where(and(eq(meetings.userId, userId)))
    .orderBy(desc(meetings.createdAt))
    .limit(5);

  const lastMeeting = recentMeetings[0];
  const response = await contextualLLM({ userId, contextType: "meeting",
    messages: [
      { role: "system", content: "You are a financial meeting preparation assistant. Generate a pre-meeting brief based on the client's history. Return JSON." },
      { role: "user", content: `Generate a pre-meeting brief for client ${clientId}. Recent meetings: ${JSON.stringify(recentMeetings.map(m => ({ type: m.meetingType, date: m.scheduledAt, summary: m.postMeetingSummary })))}` },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "meeting_brief",
        strict: true,
        schema: {
          type: "object",
          properties: {
            suggestedTopics: { type: "array", items: { type: "string" } },
            complianceReminders: { type: "array", items: { type: "string" } },
            portfolioHighlights: { type: "array", items: { type: "string" } },
            recentLifeEvents: { type: "array", items: { type: "string" } },
          },
          required: ["suggestedTopics", "complianceReminders", "portfolioHighlights", "recentLifeEvents"],
          additionalProperties: false,
        },
      },
    },
  });

  const parsed = JSON.parse(response.choices[0].message.content as string);
  return {
    clientName: `Client ${clientId}`,
    lastMeetingDate: lastMeeting?.scheduledAt?.toISOString(),
    lastMeetingSummary: lastMeeting?.postMeetingSummary ?? undefined,
    openActionItems: [],
    ...parsed,
  };
}

// ─── Post-Meeting Summary ──────────────────────────────────────────────────
export async function generateMeetingSummary(transcription: string, meetingId: number): Promise<MeetingSummary> {
  const response = await contextualLLM({ userId: 0, contextType: "meeting",
    messages: [
      { role: "system", content: `You are a financial meeting analyst. Analyze the meeting transcription and extract key information. Return JSON with: keyTopics (array of strings), decisions (array of strings), actionItems (array of {description, assignee, priority, category}), clientSentiment (positive/neutral/concerned), complianceNotes (array), nextSteps (string).` },
      { role: "user", content: `Analyze this meeting transcription:\n\n${transcription.slice(0, 8000)}` },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "meeting_summary",
        strict: true,
        schema: {
          type: "object",
          properties: {
            keyTopics: { type: "array", items: { type: "string" } },
            decisions: { type: "array", items: { type: "string" } },
            actionItems: { type: "array", items: { type: "object", properties: { description: { type: "string" }, assignee: { type: "string" }, priority: { type: "string" }, category: { type: "string" } }, required: ["description", "assignee", "priority", "category"], additionalProperties: false } },
            clientSentiment: { type: "string" },
            complianceNotes: { type: "array", items: { type: "string" } },
            nextSteps: { type: "string" },
          },
          required: ["keyTopics", "decisions", "actionItems", "clientSentiment", "complianceNotes", "nextSteps"],
          additionalProperties: false,
        },
      },
    },
  });

  const parsed = JSON.parse(response.choices[0].message.content as string);
  return { ...parsed, duration: 0 };
}

// ─── Transcription Processing ──────────────────────────────────────────────
export async function processTranscription(audioUrl: string): Promise<TranscriptionSegment[]> {
  // Uses the built-in voice transcription service
  // Returns mock segments for now — actual implementation would use transcribeAudio
  return [
    { speaker: "Advisor", text: "Let's review your portfolio performance this quarter.", startMs: 0, endMs: 5000, confidence: 0.95 },
    { speaker: "Client", text: "I'm concerned about the market volatility.", startMs: 5000, endMs: 9000, confidence: 0.92 },
  ];
}

export async function extractActionItems(summary: MeetingSummary): Promise<ActionItem[]> {
  return summary.actionItems.map(item => ({
    ...item,
    priority: (item.priority as ActionItem["priority"]) || "medium",
    category: (item.category as ActionItem["category"]) || "follow_up",
  }));
}
