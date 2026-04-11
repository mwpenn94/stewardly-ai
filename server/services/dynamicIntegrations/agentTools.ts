/**
 * ReAct agent bridge for dynamic-integration blueprints.
 *
 * These tools delegate to `server/services/dynamicIntegrations/*` so the
 * chat agent uses the exact same runtime as the UI. Every tool takes a
 * `caller` context (userId + role) so visibility gates match what the
 * tRPC router enforces.
 */

import { listBlueprints, getBlueprint } from "./blueprintRegistry";
import { executeBlueprint } from "./blueprintExecutor";
import { draftBlueprint, type DraftRequest } from "./aiBlueprintDrafter";
import { probeBody } from "./sourceProber";
import { inferSchema, schemaToPersisted } from "./schemaInference";

const SAMPLE_FETCH_BYTES = 200_000;

export interface BlueprintToolContext {
  userId: number;
  role: string;
}

/**
 * Dispatch a single `blueprint_*` tool call. Returns a compact JSON string
 * ready to feed back into the ReAct loop as the tool result.
 */
export async function executeBlueprintTool(
  name: string,
  args: Record<string, unknown>,
  ctx: BlueprintToolContext,
): Promise<string> {
  try {
    switch (name) {
      case "blueprint_probe": {
        const url = typeof args.url === "string" ? args.url : undefined;
        const inlineSample = typeof args.inlineSample === "string" ? args.inlineSample : undefined;
        if (!url && !inlineSample) {
          return JSON.stringify({ error: "blueprint_probe requires url or inlineSample" });
        }
        let body = inlineSample ?? "";
        let contentType = "";
        if (url) {
          try {
            const resp = await fetch(url, {
              headers: { "User-Agent": "Stewardly-BlueprintAgent/1.0" },
              signal: AbortSignal.timeout(15_000),
            });
            contentType = resp.headers.get("content-type") ?? "";
            const buf = await resp.arrayBuffer();
            const truncated =
              buf.byteLength > SAMPLE_FETCH_BYTES
                ? Buffer.from(buf).slice(0, SAMPLE_FETCH_BYTES)
                : Buffer.from(buf);
            body = truncated.toString("utf-8");
          } catch (e: unknown) {
            return JSON.stringify({ error: `fetch failed: ${(e as Error).message}` });
          }
        }
        const probe = probeBody(body, contentType);
        const schema = probe.records.length > 0 ? inferSchema(probe.records) : null;
        return JSON.stringify({
          format: probe.detectedFormat,
          recordCount: probe.records.length,
          sample: probe.records.slice(0, 3),
          schemaPreview: schema ? schemaToPersisted(schema) : null,
          notes: probe.notes,
        });
      }

      case "blueprint_draft": {
        const req: DraftRequest = {
          name: typeof args.name === "string" ? args.name : undefined,
          description: typeof args.description === "string" ? args.description : "",
          url: typeof args.url === "string" ? args.url : undefined,
          inlineSample: typeof args.inlineSample === "string" ? args.inlineSample : undefined,
          preferSink: args.preferSink as DraftRequest["preferSink"],
        };
        if (!req.description || req.description.length < 3) {
          return JSON.stringify({ error: "blueprint_draft requires a description (>=3 chars)" });
        }
        const result = await draftBlueprint(req);
        return JSON.stringify({
          draft: result.draft,
          detectedFormat: result.detectedFormat,
          schemaPreview: result.schemaPreview,
          llmUsed: result.llmUsed,
          notes: result.notes,
        });
      }

      case "blueprint_list": {
        const list = await listBlueprints({ userId: ctx.userId, role: ctx.role });
        return JSON.stringify(
          list.map((b) => ({
            id: b.id,
            name: b.name,
            status: b.status,
            sinkKind: b.sinkConfig?.kind ?? null,
            sourceKind: b.sourceKind,
            totalRuns: b.totalRuns,
            totalRecordsIngested: b.totalRecordsIngested,
            lastRunStatus: b.lastRunStatus,
          })),
        );
      }

      case "blueprint_run": {
        const id = typeof args.id === "string" ? args.id : "";
        const dryRun = Boolean(args.dryRun);
        if (!id) return JSON.stringify({ error: "blueprint_run requires id" });
        const bp = await getBlueprint(id, ctx);
        if (!bp) return JSON.stringify({ error: "blueprint not found or not visible" });
        const summary = await executeBlueprint(bp, {
          dryRun,
          triggeredBy: ctx.userId,
          triggerSource: "api",
        });
        return JSON.stringify({
          runId: summary.runId,
          status: summary.status,
          recordsParsed: summary.recordsParsed,
          recordsWritten: summary.recordsWritten,
          recordsErrored: summary.recordsErrored,
          durationMs: summary.durationMs,
          error: summary.error,
          sample: summary.sample?.slice(0, 3),
        });
      }

      default:
        return JSON.stringify({ error: `Unknown blueprint tool: ${name}` });
    }
  } catch (e: unknown) {
    return JSON.stringify({ error: (e as Error).message || "blueprint tool execution failed" });
  }
}

export const BLUEPRINT_TOOL_NAMES = new Set([
  "blueprint_probe",
  "blueprint_draft",
  "blueprint_list",
  "blueprint_run",
]);
