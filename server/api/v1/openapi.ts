/**
 * /api/v1 — OpenAPI 3.1 spec builder.
 *
 * Shipped by Pass 6 of the hybrid build loop — PARITY-API-0001.
 *
 * Returns a hand-written OpenAPI 3.1 document describing the
 * Stewardly public API v1 surface. Kept as a plain object literal
 * so `/api/v1/openapi.json` can serve it without a build step.
 * Callers can override `servers[].url` via `buildOpenApiDoc` to
 * match their deployment domain.
 */

export interface OpenApiOptions {
  /** Base URL for the API (defaults to `/api/v1`). */
  serverUrl?: string;
  /** Optional title override. */
  title?: string;
  /** Version string (defaults to 1.0.0). */
  version?: string;
}

/** Returns a fresh OpenAPI 3.1 spec document. */
export function buildOpenApiDoc(options: OpenApiOptions = {}): Record<string, unknown> {
  const serverUrl = options.serverUrl ?? "/api/v1";
  const title = options.title ?? "Stewardly Public API";
  const version = options.version ?? "1.0.0";

  return {
    openapi: "3.1.0",
    info: {
      title,
      version,
      description:
        "Read-only public API for Stewardly. Provides competitive analysis, portfolio rebalancing simulation, multi-year tax projection, and cost-basis ledger computations. All endpoints require a bearer API key with the `stwly_` prefix.",
      license: { name: "Proprietary" },
    },
    servers: [{ url: serverUrl }],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "stwly_live_<token>",
          description:
            "Supply your token as `Authorization: Bearer stwly_live_<token>` or the `?api_key=` query parameter.",
        },
      },
      schemas: {
        Error: {
          type: "object",
          properties: {
            error: {
              type: "object",
              properties: {
                code: { type: "string" },
                message: { type: "string" },
              },
              required: ["code", "message"],
            },
          },
          required: ["error"],
        },
        Health: {
          type: "object",
          properties: {
            status: { type: "string", enum: ["ok"] },
            version: { type: "string" },
            serverTime: { type: "string", format: "date-time" },
          },
          required: ["status", "version", "serverTime"],
        },
        ComparablesSummary: {
          type: "object",
          properties: {
            stewardlyTotal: { type: "number" },
            maxTotal: { type: "number" },
            stewardlyRank: { type: "number" },
            overallPct: { type: "number" },
            bands: {
              type: "object",
              properties: {
                leading: { type: "number" },
                parity: { type: "number" },
                trailing: { type: "number" },
                missing: { type: "number" },
              },
            },
          },
        },
        RebalanceRequest: {
          type: "object",
          required: ["holdings", "targets"],
          properties: {
            holdings: {
              type: "array",
              items: {
                type: "object",
                required: ["id", "name", "marketValue"],
                properties: {
                  id: { type: "string" },
                  name: { type: "string" },
                  marketValue: { type: "number" },
                  longTermGainLossUSD: { type: "number" },
                  isCash: { type: "boolean" },
                },
              },
            },
            targets: {
              type: "array",
              items: {
                type: "object",
                required: ["id", "targetPct"],
                properties: {
                  id: { type: "string" },
                  targetPct: { type: "number" },
                },
              },
            },
            options: {
              type: "object",
              properties: {
                driftThreshold: { type: "number" },
                cashBufferPct: { type: "number" },
                taxAware: { type: "boolean" },
              },
            },
          },
        },
      },
    },
    security: [{ BearerAuth: [] }],
    paths: {
      "/health": {
        get: {
          summary: "Health check",
          description:
            "Public unauthenticated health probe. Returns 200 with status + server time.",
          security: [],
          tags: ["meta"],
          responses: {
            "200": {
              description: "OK",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/Health" },
                },
              },
            },
          },
        },
      },
      "/openapi.json": {
        get: {
          summary: "OpenAPI spec",
          description: "Returns this document.",
          security: [],
          tags: ["meta"],
          responses: {
            "200": {
              description: "OpenAPI 3.1 document",
              content: { "application/json": {} },
            },
          },
        },
      },
      "/comparables/summary": {
        get: {
          summary: "Overall competitive summary",
          description:
            "Returns Stewardly's headline % vs the comparable catalog: total depth, rank among all apps, band counts (leading/parity/trailing/missing).",
          tags: ["comparables"],
          responses: {
            "200": {
              description: "Summary",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ComparablesSummary" },
                },
              },
            },
            "401": {
              description: "Missing or invalid credentials",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/Error" },
                },
              },
            },
            "429": {
              description: "Rate limited",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/Error" },
                },
              },
            },
          },
        },
      },
      "/comparables/gaps": {
        get: {
          summary: "Gap matrix",
          description:
            "One row per feature axis with Stewardly's score, the best external score, and the delta.",
          tags: ["comparables"],
          responses: {
            "200": { description: "Gap matrix" },
            "401": { description: "Missing or invalid credentials" },
          },
        },
      },
      "/rebalancing/simulate": {
        post: {
          summary: "Simulate portfolio drift + cash-neutral trades",
          description:
            "POST a holdings snapshot + target allocation to get drift rows and cash-neutral trade proposals. Pure compute — no data is persisted.",
          tags: ["rebalancing"],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/RebalanceRequest" },
              },
            },
          },
          responses: {
            "200": { description: "Drift report" },
            "400": { description: "Invalid request payload" },
            "401": { description: "Missing or invalid credentials" },
            "429": { description: "Rate limited" },
          },
        },
      },
      "/tax/project-year": {
        post: {
          summary: "Project a single tax year",
          description:
            "POST a YearContext with income, deductions, and filing status. Returns AGI, taxable income, ordinary + LTCG tax, marginal + effective rates.",
          tags: ["tax"],
          requestBody: {
            required: true,
            content: { "application/json": {} },
          },
          responses: {
            "200": { description: "Year result" },
            "400": { description: "Invalid request payload" },
            "401": { description: "Missing or invalid credentials" },
          },
        },
      },
      "/portfolio-ledger/run": {
        post: {
          summary: "Run a transaction list through the cost-basis ledger",
          description:
            "POST a transaction array + optional cost-basis method. Returns positions, realized gains, and warnings.",
          tags: ["portfolio"],
          requestBody: {
            required: true,
            content: { "application/json": {} },
          },
          responses: {
            "200": { description: "Ledger result" },
            "400": { description: "Invalid request payload" },
            "401": { description: "Missing or invalid credentials" },
          },
        },
      },
    },
  };
}
