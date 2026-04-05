/**
 * Pre-Meeting Brief — AI generates advisor prep doc from accumulated profile
 * Logged to communication_archive (FINRA 17a-4)
 */
import { getDb } from "../../db";
import { logger } from "../../_core/logger";

const log = logger.child({ module: "preMeetingBrief" });

export async function generateBrief(params: {
  leadId: number;
  advisorId: number;
}): Promise<string> {
  try {
    const { getProfile } = await import("./progressiveProfiler");
    const profile = await getProfile("user_id", String(params.leadId));

    const { contextualLLM } = await import("../../shared/stewardlyWiring");

    const profileSummary = Object.entries(profile)
      .map(([key, val]) => `${key}: ${val.value} (confidence: ${val.confidence}, source: ${val.source})`)
      .join("\n");

    const response = await contextualLLM({
      userId: params.advisorId,
      contextType: "analysis" as any,
      messages: [{
        role: "user",
        content: `Generate a pre-meeting advisor preparation brief for this prospect:\n\n${profileSummary}\n\nInclude: key data points, talking points, compliance notes, and suggested products based on their profile. Format as a structured document.`,
      }],
    });

    const brief = response.choices?.[0]?.message?.content || "Brief generation failed — review profile manually.";

    // Archive for FINRA compliance
    const db = await getDb();
    if (db) {
      try {
        const { communicationArchive } = await import("../../../drizzle/schema");
        const threeYears = new Date();
        threeYears.setFullYear(threeYears.getFullYear() + 3);
        await db.insert(communicationArchive).values({
          userId: params.advisorId,
          contentType: "pre_meeting_brief",
          contentText: brief,
          leadId: params.leadId,
          retentionExpiresAt: threeYears,
        });
      } catch { /* graceful */ }
    }

    return brief;
  } catch (e: any) {
    log.error({ error: e.message, leadId: params.leadId }, "Brief generation failed");
    return "Unable to generate brief. Please review the prospect's profile manually.";
  }
}
