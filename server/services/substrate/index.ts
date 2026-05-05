/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Substrate Primitives — Unified Export
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * The substrate layer provides the foundational AI infrastructure that all
 * engines (Wealth, Learning, People, Intelligence, CI) build upon.
 *
 * Primitives:
 *   1. classifier       — Rule-based content classification (sensitivity, task, domain)
 *   2. embedding        — Vector embedding generation via Forge API
 *   3. aegis            — Pre/post-flight quality pipeline
 *   4. sovereign        — Multi-provider routing with circuit breakers
 *   5. searchCascade    — Tiered quality-first web search degradation
 *   6. proposalGenerator — (Phase E) Structured proposal/recommendation generation
 *   7. documentIntel    — (Phase E) Document intelligence and extraction
 *   8. voice            — (Existing) Edge TTS + Deepgram STT
 *
 * Dependency graph (no circular dependencies):
 *   classifier → (standalone, no deps)
 *   embedding → (standalone, uses Forge API)
 *   aegis → classifier, embedding
 *   sovereign → classifier, invokeLLM
 *   searchCascade → classifier, dataApi
 */

// ─── Classifier ──────────────────────────────────────────────────────────────
export {
  classify,
  isSensitive,
  getRoutingTier,
  type ClassificationResult,
  type SensitivityLevel,
  type RoutingTier,
  type TaskType,
  type Complexity,
  type Domain,
} from "./classifier";

// ─── Embedding ───────────────────────────────────────────────────────────────
export {
  generateEmbedding,
  generateEmbeddingFull,
  generateEmbeddingsBatch,
  cosineSimilarity,
  findTopK,
  keywordSimilarity,
  EMBEDDING_MODEL,
  EMBEDDING_DIMENSIONS,
  type EmbeddingResult,
} from "./embedding";

// ─── AEGIS ───────────────────────────────────────────────────────────────────
export {
  runPreFlight,
  runPostFlight,
  checkCache,
  writeCache,
  estimateCost,
  classifyTask,
  type PreFlightResult,
  type PostFlightResult,
  type QualityScore,
  type AegisSession,
} from "./aegis";

// ─── Sovereign Routing ───────────────────────────────────────────────────────
export {
  routeRequest,
  registerBYOProvider,
  getRoutingStats,
  getCircuitBreakerStatus,
  getRecentDecisions,
  type ProviderConfig,
  type RoutingRequest,
  type RoutingResult,
  type RoutingDecision,
} from "./sovereign";

// ─── Search Cascade ──────────────────────────────────────────────────────────
export {
  searchCascade,
  type SearchResult,
  type SearchOptions,
  type SearchResponse,
} from "./searchCascade";

// ─── Capability Tiers ────────────────────────────────────────────────────────
export {
  getCapabilities,
  getCapability,
  getActiveTier,
  degradeCapability,
  restoreCapability,
  recordUsage,
  getDegradationHistory,
  hasBYOKey,
  type CapabilityDomain,
  type TierLevel,
  type TierDefinition,
  type CapabilityConfig,
  type DegradationEvent,
} from "./capabilityTiers";

// ─── ATLAS Goal Decomposition ────────────────────────────────────────────────
export {
  decomposeGoal,
  executePlan,
  type GoalInput,
  type DecomposedPlan,
  type PlanTask,
  type ExecutionResult,
} from "./atlas";

// ─── Proposal Generator ─────────────────────────────────────────────────────
export {
  generateProposal,
  getProposalTypes,
  type ProposalType,
  type ProposalInput,
  type GeneratedProposal,
  type ProposalSection,
} from "./proposalGenerator";

// ─── Document Intelligence ───────────────────────────────────────────────────
export {
  classifyDocument,
  extractEntities,
  chunkDocument,
  summarizeDocument,
  compareDocuments,
  analyzeDocument,
  type DocumentType,
  type DocumentMetadata,
  type ExtractedEntity,
  type DocumentChunk,
  type DocumentSummary,
  type ComparisonResult,
} from "./documentIntel";

// ─── Memory Substrate ────────────────────────────────────────────────────────
export {
  getWorkingMemory,
  addToWorkingMemory,
  retrieveMemories,
  consolidateWorkingMemory,
  clearWorkingMemory,
  getMemoryStats,
  type MemoryType,
  type MemoryEntry,
  type WorkingMemory,
  type MemoryQuery,
  type MemoryRetrievalResult,
} from "./memorySubstrate";

// ─── Measurement & Verification ──────────────────────────────────────────────
export {
  recordAICostSavings,
  recordTimeSavings,
  recordSearchEfficiency,
  recordDocumentProcessingSavings,
  recordMemoryContextSavings,
  getPeriodSummary,
  calculateCeiling,
  getUserSavingsEvents,
  getGlobalSavingsSummary,
  clearAllEvents,
  updateMVConfig,
  getMVConfig,
  type SavingsCategory,
  type SavingsEvent,
  type PeriodSummary,
  type CostPlusCeiling,
  type MVConfig,
} from "./measurementVerification";

// ─── Pricing Engine ──────────────────────────────────────────────────────────
export {
  calculateInvoice,
  determineBYOMScenario,
  isInTrial,
  getPlanFees,
  getAllPlanFees,
  type BillingMode,
  type BYOMScenario,
  type BillingProfile,
  type UsageSummary,
  type InvoiceCalculation,
  type TrialConfig,
} from "./pricingEngine";

// ─── M8 Prompt Engine ────────────────────────────────────────────────────────
export {
  assemblePrompt,
  getAssemblyStats,
  type PromptContext,
  type AssembledPrompt,
  type MemorySlot,
} from "./promptEngine";
