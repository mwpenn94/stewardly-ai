/**
 * Autonomous Source Onboarding Wizard
 *
 * Single-call entrypoint that ties Passes 1-15 together into one flow.
 * Give it sample records + optional connection hints, and it returns:
 *
 *   1. Redacted records (PII/secrets stripped before downstream processing)
 *   2. Inferred schema (with type + hint + PK detection)
 *   3. Field overrides pre-applied
 *   4. Generated adapter spec (with auth + endpoints + rate limits)
 *   5. CRM canonical mapping (to Stewardly's canonical contact shape)
 *   6. Personalization hints (feeding learning/calculator/risk/CRM)
 *   7. DSL-serialized adapter (fingerprint + canonical JSON for storage)
 *   8. Readiness + next-step report
 *
 * This is what the Code Chat agent calls to onboard a new source in one
 * step, what the Integrations UI wizard calls after the user pastes
 * sample data, and what the autonomous ingestion loop calls when it
 * discovers a new source from web scraping.
 *
 * Pure orchestration. No I/O. Every downstream module already has unit
 * tests; this module just runs them in the right order.
 */

import type { InferredSchema } from "./schemaInference";
import type {
  AdapterSpec,
  GenerateAdapterOptions,
  AdapterAuthSpec,
} from "./adapterGenerator";
import type { CrmMappingResult } from "./crmCanonicalMap";
import type { PersonalizationHintResult } from "./personalizationHints";
import type { FieldOverride } from "./fieldOverrides";
import type { SerializedSpec } from "./adapterDSL";
import type { RedactionConfig, RedactionReport } from "./sensitiveRedaction";
import type { SampleResponse } from "./authProbe";

// ─── Types ─────────────────────────────────────────────────────────────────

export interface OnboardingInput {
  sampleRecords: Array<Record<string, unknown>>;
  name: string;
  baseUrl?: string;
  listEndpoint?: string;
  authHint?: GenerateAdapterOptions["authHint"];
  authProbeSamples?: SampleResponse[];
  collectionPath?: string;
  sampleListResponse?: unknown;
  fieldOverrides?: FieldOverride[];
  redaction?: RedactionConfig;
  skipRedaction?: boolean;
  skipCrmMapping?: boolean;
  skipPersonalizationHints?: boolean;
}

export interface NextStep {
  action: "provide_base_url" | "confirm_auth" | "review_warnings" | "review_crm_mapping" | "approve_mappings" | "ready_to_run";
  description: string;
  priority: "required" | "recommended" | "info";
}

export interface OnboardingResult {
  name: string;
  schema: InferredSchema;
  spec: AdapterSpec;
  serialized: SerializedSpec;
  crmMapping: CrmMappingResult | null;
  personalizationHints: PersonalizationHintResult | null;
  redactionReport: RedactionReport | null;
  authSpec: AdapterAuthSpec;
  ready: boolean;
  nextSteps: NextStep[];
  summary: string;
}

// ─── Main entry point ────────────────────────────────────────────────────

export async function runOnboardingWizard(
  input: OnboardingInput,
): Promise<OnboardingResult> {
  if (!input.sampleRecords || input.sampleRecords.length === 0) {
    throw new Error("sampleRecords required (min 1)");
  }

  // 1. Redact sensitive data FIRST — before schema inference even sees it
  const { redactRecords } = await import("./sensitiveRedaction");
  let workingRecords = input.sampleRecords;
  let redactionReport: RedactionReport | null = null;
  if (!input.skipRedaction) {
    const redacted = redactRecords(workingRecords, input.redaction);
    workingRecords = redacted.records;
    redactionReport = redacted.report;
  }

  // 2. Infer schema from redacted records
  const { inferSchema } = await import("./schemaInference");
  const schema = inferSchema(workingRecords);

  // 3. Deep auth probe if samples provided; otherwise fall back to user hint
  const { probeAuthDeep } = await import("./authProbe");
  const authSpec: AdapterAuthSpec =
    input.authProbeSamples && input.authProbeSamples.length > 0
      ? probeAuthDeep({
          samples: input.authProbeSamples,
          userHint: input.authHint
            ? { type: input.authHint.type, headerName: input.authHint.headerName, queryParam: input.authHint.queryParam }
            : undefined,
        })
      : {
          type: input.authHint?.type || "unknown",
          headerName: input.authHint?.headerName,
          queryParam: input.authHint?.queryParam,
          probeConfidence: input.authHint?.type ? 1.0 : 0,
          notes: input.authHint?.type
            ? [`User-provided auth type: ${input.authHint.type}`]
            : ["Auth type not provided"],
        };

  // 4. Generate adapter from schema + connection hints
  const { generateAdapter } = await import("./adapterGenerator");
  let spec = generateAdapter(schema, {
    name: input.name,
    baseUrl: input.baseUrl,
    listEndpoint: input.listEndpoint,
    authHint: input.authHint,
    collectionPath: input.collectionPath,
    sampleListResponse: input.sampleListResponse,
  });
  // Overwrite auth with the deep-probe result if we ran one
  if (input.authProbeSamples && input.authProbeSamples.length > 0) {
    spec = { ...spec, auth: authSpec };
  }

  // 5. Apply any user-provided field overrides
  if (input.fieldOverrides && input.fieldOverrides.length > 0) {
    const { applyOverrides } = await import("./fieldOverrides");
    const applied = applyOverrides(spec, input.fieldOverrides);
    spec = applied.spec;
  }

  // 6. Map to canonical CRM contact shape (for downstream CRM sync)
  let crmMapping: CrmMappingResult | null = null;
  if (!input.skipCrmMapping) {
    const { mapToCanonicalContact } = await import("./crmCanonicalMap");
    crmMapping = mapToCanonicalContact(schema);
  }

  // 7. Extract personalization hints
  let personalizationHints: PersonalizationHintResult | null = null;
  if (!input.skipPersonalizationHints) {
    const { extractPersonalizationHints, augmentWithCrmHints } = await import(
      "./personalizationHints"
    );
    let hints = extractPersonalizationHints(schema);
    if (crmMapping) {
      hints = augmentWithCrmHints(hints, crmMapping);
    }
    personalizationHints = hints;
  }

  // 8. Serialize for portable storage
  const { serializeSpec } = await import("./adapterDSL");
  const serialized = serializeSpec(spec);

  // 9. Compute next steps + readiness rollup
  const nextSteps: NextStep[] = [];
  if (!input.baseUrl) {
    nextSteps.push({
      action: "provide_base_url",
      description: "Provide a base URL for the source (required to execute the adapter)",
      priority: "required",
    });
  }
  if (authSpec.type === "unknown") {
    nextSteps.push({
      action: "confirm_auth",
      description: "Auth type could not be detected — please provide userHint",
      priority: "required",
    });
  }
  if (spec.readinessReport.warnings.length > 0) {
    nextSteps.push({
      action: "review_warnings",
      description: `Review ${spec.readinessReport.warnings.length} readiness warning(s)`,
      priority: "recommended",
    });
  }
  if (crmMapping && crmMapping.missingRequired.length > 0) {
    nextSteps.push({
      action: "review_crm_mapping",
      description: `Missing required CRM fields: ${crmMapping.missingRequired.join(", ")}`,
      priority: "recommended",
    });
  }
  const lowConfidenceMappings = spec.fieldMappings.filter((m) => m.confidence < 0.6);
  if (lowConfidenceMappings.length > 0) {
    nextSteps.push({
      action: "approve_mappings",
      description: `${lowConfidenceMappings.length} field mappings have low confidence — review recommended`,
      priority: "recommended",
    });
  }
  const ready = spec.readinessReport.ready && authSpec.type !== "unknown";
  if (ready) {
    nextSteps.push({
      action: "ready_to_run",
      description: "Adapter is ready to run via runPipeline()",
      priority: "info",
    });
  }

  // 10. Human-readable summary
  const parts: string[] = [];
  parts.push(`${input.name}`);
  parts.push(`${schema.fields.length} fields`);
  parts.push(`auth=${authSpec.type}`);
  if (redactionReport && redactionReport.redactedCount > 0) {
    parts.push(`${redactionReport.redactedCount} redacted`);
  }
  if (crmMapping) {
    parts.push(`${crmMapping.matches.length} CRM matches`);
  }
  if (personalizationHints) {
    parts.push(`${personalizationHints.hints.length} hints`);
  }
  parts.push(ready ? "READY" : `${nextSteps.filter((s) => s.priority === "required").length} blocked`);

  return {
    name: input.name,
    schema,
    spec,
    serialized,
    crmMapping,
    personalizationHints,
    redactionReport,
    authSpec,
    ready,
    nextSteps,
    summary: parts.join(" · "),
  };
}
