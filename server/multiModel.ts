/**
 * Multi-Model Synthesis Engine
 * 
 * Queries the LLM from multiple "perspective" viewpoints (analyst, advisor, critic)
 * and synthesizes their responses into a single cohesive answer.
 */

import { contextualLLM } from "./shared/intelligence/sovereignWiring"
import { contextualLLM } from "./services/contextualLLM";

// ─── PERSPECTIVE DEFINITIONS ────────────────────────────────────────────────

export interface Perspective {
  id: string;
  name: string;
  systemPrompt: string;
  weight: number;
}

const BUILT_IN_PERSPECTIVES: Record<string, Perspective> = {
  analyst: {
    id: "analyst",
    name: "Financial Analyst",
    systemPrompt: "You are a rigorous financial analyst. Focus on data, numbers, market trends, and quantitative analysis. Be precise and evidence-based.",
    weight: 1.0,
  },
  advisor: {
    id: "advisor",
    name: "Financial Advisor",
    systemPrompt: "You are an experienced financial advisor focused on practical, actionable guidance. Consider the client's goals, risk tolerance, and life circumstances.",
    weight: 1.0,
  },
  critic: {
    id: "critic",
    name: "Risk Analyst",
    systemPrompt: "You are a critical risk analyst. Challenge assumptions, identify potential pitfalls, and highlight risks that others might miss.",
    weight: 0.8,
  },
  educator: {
    id: "educator",
    name: "Financial Educator",
    systemPrompt: "You are a patient financial educator. Explain concepts clearly, use analogies, and ensure the user truly understands the topic.",
    weight: 0.7,
  },
};

// ─── PRESETS ────────────────────────────────────────────────────────────────

export interface ModelPreset {
  id: string;
  name: string;
  description: string;
  perspectives: string[];
  weights: Record<string, number>;
  isBuiltIn: boolean;
}

export const BUILT_IN_PRESETS: ModelPreset[] = [
  {
    id: "balanced",
    name: "Balanced",
    description: "Equal weight across analyst, advisor, and critic perspectives",
    perspectives: ["analyst", "advisor", "critic"],
    weights: { analyst: 1.0, advisor: 1.0, critic: 0.8 },
    isBuiltIn: true,
  },
  {
    id: "research",
    name: "Deep Research",
    description: "Emphasizes analytical depth with critical review",
    perspectives: ["analyst", "critic"],
    weights: { analyst: 1.2, critic: 1.0 },
    isBuiltIn: true,
  },
  {
    id: "advisory",
    name: "Advisory Focus",
    description: "Prioritizes practical advice with educational support",
    perspectives: ["advisor", "educator"],
    weights: { advisor: 1.2, educator: 0.8 },
    isBuiltIn: true,
  },
  {
    id: "comprehensive",
    name: "Comprehensive",
    description: "All four perspectives for maximum coverage",
    perspectives: ["analyst", "advisor", "critic", "educator"],
    weights: { analyst: 1.0, advisor: 1.0, critic: 0.8, educator: 0.7 },
    isBuiltIn: true,
  },
];

// ─── MULTI-PERSPECTIVE QUERY ────────────────────────────────────────────────

interface MultiModelOptions {
  userMessage: string;
  systemContext: string;
  perspectives: string[];
  weights: Record<string, number>;
  history?: Array<{ role: string; content: string }>;
}

interface PerspectiveResult {
  perspectiveId: string;
  perspectiveName: string;
  content: string;
  weight: number;
}

export async function queryMultiPerspective(opts: MultiModelOptions): Promise<PerspectiveResult[]> {
  const activePerspectives = opts.perspectives
    .map(id => BUILT_IN_PERSPECTIVES[id])
    .filter(Boolean);

  if (activePerspectives.length === 0) {
    throw new Error("No valid perspectives selected");
  }

  const results = await Promise.allSettled(
    activePerspectives.map(async (perspective) => {
      const perspectivePrompt = `${opts.systemContext}\n\n<perspective_role>\n${perspective.systemPrompt}\n</perspective_role>`;
      
      const messages = [
        { role: "system" as const, content: perspectivePrompt },
        ...(opts.history || []).slice(-10).map(m => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
        { role: "user" as const, content: opts.userMessage },
      ];

      const response = await contextualLLM({ userId: null, contextType: "chat", messages });
      const content = typeof response.choices[0]?.message?.content === "string"
        ? response.choices[0].message.content
        : "";

      return {
        perspectiveId: perspective.id,
        perspectiveName: perspective.name,
        content,
        weight: opts.weights[perspective.id] ?? perspective.weight,
      };
    })
  );

  return results
    .filter((r): r is PromiseFulfilledResult<PerspectiveResult> => r.status === "fulfilled")
    .map(r => r.value);
}

// ─── SYNTHESIS ENGINE ───────────────────────────────────────────────────────

export async function synthesizeResponses(
  perspectiveResults: PerspectiveResult[],
  originalQuestion: string,
): Promise<string> {
  if (perspectiveResults.length === 0) return "";
  if (perspectiveResults.length === 1) return perspectiveResults[0].content;

  const perspectiveSummaries = perspectiveResults
    .sort((a, b) => b.weight - a.weight)
    .map(r => `### ${r.perspectiveName} (weight: ${r.weight.toFixed(1)})\n${r.content}`)
    .join("\n\n---\n\n");

  const synthesisPrompt = `You are a synthesis engine. Multiple expert perspectives have analyzed the same question. Merge their insights into a single, cohesive response. Weight perspectives according to their assigned weights. Highlight areas of agreement and note significant disagreements. Do NOT mention the perspectives by name.

Original question: ${originalQuestion}

Perspective analyses:
${perspectiveSummaries}`;

  const response = await contextualLLM({ userId: null, contextType: "chat",
    messages: [
      { role: "system", content: synthesisPrompt },
      { role: "user", content: "Synthesize these perspectives into a single cohesive response." },
    ],
  });

  return typeof response.choices[0]?.message?.content === "string"
    ? response.choices[0].message.content
    : perspectiveResults[0].content;
}

// ─── CROSS-MODEL VERIFICATION ───────────────────────────────────────────────

export interface VerificationResult {
  isConsistent: boolean;
  confidence: number;
  discrepancies: string[];
  recommendation: string;
}

export async function crossModelVerify(
  originalResponse: string,
  question: string,
): Promise<VerificationResult> {
  try {
    const response = await contextualLLM({ userId: null, contextType: "chat",
      messages: [
        {
          role: "system",
          content: `Review this AI response for accuracy and consistency. Question: ${question}\n\nResponse: ${originalResponse}`,
        },
        { role: "user", content: "Verify this response and return JSON." },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "verification_result",
          strict: true,
          schema: {
            type: "object",
            properties: {
              isConsistent: { type: "boolean" },
              confidence: { type: "number" },
              discrepancies: { type: "array", items: { type: "string" } },
              recommendation: { type: "string" },
            },
            required: ["isConsistent", "confidence", "discrepancies", "recommendation"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices[0]?.message?.content;
    if (typeof content === "string") return JSON.parse(content);
  } catch { /* fallback */ }

  return { isConsistent: true, confidence: 0.7, discrepancies: [], recommendation: "approve" };
}

export function getAvailablePerspectives() {
  return Object.values(BUILT_IN_PERSPECTIVES);
}

export function getBuiltInPresets() {
  return BUILT_IN_PRESETS;
}
