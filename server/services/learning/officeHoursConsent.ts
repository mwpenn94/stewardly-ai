/**
 * §P1-5 Faculty Office Hours — Consent Flow + Transcript Persistence
 * Handles recording consent, transcript storage, and compliance.
 */
import { getDb } from "../../db";
import { storagePut } from "../../storage";
import { logger } from "../../_core/logger";
import { nanoid } from "nanoid";
import { sql } from "drizzle-orm";

const log = logger.child({ service: "officeHoursConsent" });

interface ConsentRecord {
  sessionId: number;
  participantId: string;
  consentType: "recording" | "transcript" | "both";
  granted: boolean;
  timestamp: number;
  ipAddress?: string;
}

interface TranscriptSegment {
  speaker: string;
  text: string;
  startMs: number;
  endMs: number;
}

/**
 * Record participant consent for office hours session.
 * Must be called before recording begins.
 */
export async function recordConsent(consent: ConsentRecord): Promise<{ id: string }> {
  const db = (await getDb())!;
  const consentId = `consent-${nanoid(12)}`;

  await db.execute(sql`
    INSERT INTO office_hours_consent 
    (consent_id, session_id, participant_id, consent_type, granted, timestamp, ip_address) 
    VALUES (${consentId}, ${consent.sessionId}, ${consent.participantId}, ${consent.consentType}, ${consent.granted ? 1 : 0}, ${consent.timestamp}, ${consent.ipAddress ?? null})
    ON DUPLICATE KEY UPDATE granted = VALUES(granted), timestamp = VALUES(timestamp)
  `);

  log.info({
    consentId,
    sessionId: consent.sessionId,
    participantId: consent.participantId,
    consentType: consent.consentType,
    granted: consent.granted,
  }, "Consent recorded");

  return { id: consentId };
}

/**
 * Check if all participants have granted consent for a session.
 */
export async function checkAllConsented(sessionId: number): Promise<{
  allConsented: boolean;
  pending: string[];
  denied: string[];
}> {
  const db = (await getDb())!;
  const rows = await db.execute(sql`
    SELECT participant_id, granted FROM office_hours_consent WHERE session_id = ${sessionId}
  `);

  const pending: string[] = [];
  const denied: string[] = [];

  // @ts-expect-error — property access on loosely typed object
  for (const row of rows.rows as any[]) {
    if (!row.granted) {
      denied.push(row.participant_id);
    }
  }

  return { allConsented: denied.length === 0, pending, denied };
}

/**
 * Persist a session transcript to S3 and record metadata.
 */
export async function persistTranscript(
  sessionId: number,
  segments: TranscriptSegment[],
  metadata: { duration: number; participantCount: number; topic?: string }
): Promise<{ url: string; fileKey: string }> {
  const transcriptId = `transcript-${nanoid(12)}`;

  // Format transcript as readable text
  const formattedText = formatTranscript(segments, metadata);

  // Also store structured JSON
  const structuredData = JSON.stringify({
    transcriptId,
    sessionId,
    metadata,
    segments,
    generatedAt: new Date().toISOString(),
  }, null, 2);

  // Upload both formats to S3
  const textKey = `office-hours/transcripts/${sessionId}/${transcriptId}.txt`;
  const jsonKey = `office-hours/transcripts/${sessionId}/${transcriptId}.json`;

  const [textResult, jsonResult] = await Promise.all([
    storagePut(textKey, Buffer.from(formattedText), "text/plain"),
    storagePut(jsonKey, Buffer.from(structuredData), "application/json"),
  ]);

  // Record in database
  const db = (await getDb())!;
  await db.execute(sql`
    INSERT INTO office_hours_transcripts 
    (transcript_id, session_id, text_url, json_url, duration_ms, segment_count, created_at) 
    VALUES (${transcriptId}, ${sessionId}, ${textResult.url}, ${jsonResult.url}, ${metadata.duration}, ${segments.length}, ${Date.now()})
  `);

  log.info({
    transcriptId,
    sessionId,
    segmentCount: segments.length,
    duration: metadata.duration,
  }, "Transcript persisted");

  return { url: textResult.url, fileKey: textKey };
}

function formatTranscript(
  segments: TranscriptSegment[],
  metadata: { duration: number; participantCount: number; topic?: string }
): string {
  const header = [
    "=== Office Hours Session Transcript ===",
    `Topic: ${metadata.topic ?? "General"}`,
    `Participants: ${metadata.participantCount}`,
    `Duration: ${Math.round(metadata.duration / 60000)} minutes`,
    `Generated: ${new Date().toISOString()}`,
    "=".repeat(40),
    "",
  ].join("\n");

  const body = segments.map(seg => {
    const timeStr = formatTime(seg.startMs);
    return `[${timeStr}] ${seg.speaker}: ${seg.text}`;
  }).join("\n");

  return header + body;
}

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
