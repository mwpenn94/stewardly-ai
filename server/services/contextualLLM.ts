/**
 * Contextual LLM Wrapper — Thin Adapter
 *
 * This file now delegates to @platform/intelligence via the Stewardly wiring.
 * All callers continue to import from this path with zero changes.
 *
 * Usage: `import { contextualLLM } from "../services/contextualLLM"`
 *
 * The wrapper:
 * 1. Assembles deep context for the given userId + query
 * 2. Prepends a <platform_context> block to the system message
 * 3. Falls back to plain invokeLLM if context assembly fails
 */

// Re-export the Stewardly-wired contextualLLM which uses the shared
// intelligence module with all 15 registered context sources.
export { contextualLLM } from "../shared/intelligence/stewardlyWiring";

// Re-export utility functions from the shared intelligence module
// so callers who import extractQuery/injectContext continue to work.
export { extractQuery, injectContext } from "../shared/intelligence/contextualLLM";

// Re-export the ContextType for callers that import it from here
export type { ContextType } from "../shared/intelligence/types";
