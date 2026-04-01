/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ATLAS LLM Adapter — Drop-in invokeLLM Replacement
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Provides a backward-compatible `invokeLLM` function that delegates to
 * the ATLAS intelligence wiring layer. This adapter enables incremental
 * migration: files can switch from
 *
 *   import { invokeLLM } from "../_core/llm";
 *
 * to:
 *
 *   import { invokeLLM } from "../shared/intelligence/atlasLLMAdapter";
 *
 * without changing any call sites. The adapter adds:
 *   - model_version tracking on every invocation
 *   - Quality score normalization for any returned scores
 *   - Consistent error handling
 *
 * For new code, prefer importing `atlasContextualLLM` or `atlasInvokeLLM`
 * directly from `./atlasWiring` to get full context injection.
 */

import { atlasInvokeLLM, getModelVersion } from "./atlasWiring";

/**
 * Drop-in replacement for `invokeLLM` from `_core/llm`.
 * Accepts the same parameter shape and returns the same response shape,
 * with model_version injected.
 */
export async function invokeLLM(params: {
  messages: Array<{ role: string; content: any }>;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  max_tokens?: number;
  response_format?: any;
  tools?: any[];
  [key: string]: any;
}) {
  // Normalize max_tokens vs maxTokens (both are used in the codebase)
  const normalizedParams = {
    ...params,
    maxTokens: params.maxTokens ?? params.max_tokens,
  };

  return atlasInvokeLLM(normalizedParams);
}

/**
 * Re-export common types that callers of _core/llm might expect.
 */
export type { ContextualLLMResponse } from "./types";
export { getModelVersion };

export default invokeLLM;
