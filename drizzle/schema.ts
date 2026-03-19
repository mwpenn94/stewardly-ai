import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, json, float, boolean as mysqlBoolean } from "drizzle-orm/mysql-core";

// ─── USERS ────────────────────────────────────────────────────────
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "advisor", "manager", "admin"]).default("user").notNull(),
  styleProfile: text("styleProfile"),
  suitabilityCompleted: mysqlBoolean("suitabilityCompleted").default(false),
  suitabilityData: json("suitabilityData"),
  settings: json("settings"),
  avatarUrl: text("avatarUrl"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
  tosAcceptedAt: timestamp("tosAcceptedAt"),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── USER PROFILES (Extended personal data) ──────────────────────
export const userProfiles = mysqlTable("user_profiles", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  age: int("age"),
  zipCode: varchar("zipCode", { length: 10 }),
  jobTitle: varchar("jobTitle", { length: 128 }),
  incomeRange: varchar("incomeRange", { length: 64 }),
  savingsRange: varchar("savingsRange", { length: 64 }),
  familySituation: varchar("familySituation", { length: 128 }),
  lifeStage: varchar("lifeStage", { length: 64 }),
  goals: json("goals"),
  sharedContext: json("sharedContext"),
  insuranceSummary: json("insuranceSummary"),
  investmentSummary: json("investmentSummary"),
  estateExposure: json("estateExposure"),
  businessOwner: mysqlBoolean("businessOwner").default(false),
  focusPreference: mysqlEnum("focusPreference", ["general", "financial", "both"]).default("both"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type UserProfile = typeof userProfiles.$inferSelect;

// ─── PROFESSIONAL CONTEXT ────────────────────────────────────────
export const professionalContext = mysqlTable("professional_context", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  addedBy: int("addedBy").notNull(),
  rawInput: text("rawInput").notNull(),
  parsedDomains: json("parsedDomains"),
  visibleToClient: mysqlBoolean("visibleToClient").default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ProfessionalContext = typeof professionalContext.$inferSelect;

// ─── CLIENT ASSOCIATIONS ─────────────────────────────────────────
export const clientAssociations = mysqlTable("client_associations", {
  id: int("id").autoincrement().primaryKey(),
  clientId: int("clientId").notNull(),
  professionalId: int("professionalId").notNull(),
  status: mysqlEnum("status", ["active", "inactive"]).default("active"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ClientAssociation = typeof clientAssociations.$inferSelect;

// ─── ENRICHMENT DATASETS ─────────────────────────────────────────
export const enrichmentDatasets = mysqlTable("enrichment_datasets", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 256 }).notNull(),
  description: text("description"),
  applicableDomains: json("applicableDomains"),
  dataType: varchar("dataType", { length: 64 }),
  matchDimensions: json("matchDimensions"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type EnrichmentDataset = typeof enrichmentDatasets.$inferSelect;

// ─── ENRICHMENT COHORTS ──────────────────────────────────────────
export const enrichmentCohorts = mysqlTable("enrichment_cohorts", {
  id: int("id").autoincrement().primaryKey(),
  datasetId: int("datasetId").notNull(),
  matchCriteria: json("matchCriteria").notNull(),
  enrichmentFields: json("enrichmentFields").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type EnrichmentCohort = typeof enrichmentCohorts.$inferSelect;

// ─── ENRICHMENT MATCHES ──────────────────────────────────────────
export const enrichmentMatches = mysqlTable("enrichment_matches", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  datasetId: int("datasetId").notNull(),
  cohortId: int("cohortId").notNull(),
  matchFields: json("matchFields"),
  confidenceScore: float("confidenceScore").default(0),
  applicableDomains: json("applicableDomains"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type EnrichmentMatch = typeof enrichmentMatches.$inferSelect;

// ─── AFFILIATED RESOURCES ────────────────────────────────────────
export const affiliatedResources = mysqlTable("affiliated_resources", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 256 }).notNull(),
  category: mysqlEnum("category", ["carrier", "lender", "ria", "advanced_markets", "general_partner"]).notNull(),
  description: text("description"),
  contactInfo: json("contactInfo"),
  isActive: mysqlBoolean("isActive").default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AffiliatedResource = typeof affiliatedResources.$inferSelect;

// ─── CONVERSATIONS ────────────────────────────────────────────────
export const conversations = mysqlTable("conversations", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  title: varchar("title", { length: 255 }).default("New Conversation"),
  mode: mysqlEnum("mode", ["client", "coach", "manager"]).default("client").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Conversation = typeof conversations.$inferSelect;

// ─── MESSAGES ─────────────────────────────────────────────────────
export const messages = mysqlTable("messages", {
  id: int("id").autoincrement().primaryKey(),
  conversationId: int("conversationId").notNull(),
  userId: int("userId").notNull(),
  role: mysqlEnum("role", ["user", "assistant", "system"]).notNull(),
  content: text("content").notNull(),
  confidenceScore: float("confidenceScore"),
  complianceStatus: mysqlEnum("complianceStatus", ["pending", "approved", "flagged", "rejected"]),
  metadata: json("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Message = typeof messages.$inferSelect;

// ─── DOCUMENTS (RAG) ──────────────────────────────────────────────
export const documents = mysqlTable("documents", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  filename: varchar("filename", { length: 512 }).notNull(),
  fileUrl: text("fileUrl").notNull(),
  fileKey: text("fileKey").notNull(),
  mimeType: varchar("mimeType", { length: 128 }),
  category: mysqlEnum("category", ["personal_docs", "financial_products", "regulations", "training_materials", "artifacts", "skills"]).default("personal_docs").notNull(),
  visibility: mysqlEnum("visibility", ["private", "professional", "management", "admin"]).default("professional").notNull(),
  extractedText: text("extractedText"),
  chunkCount: int("chunkCount").default(0),
  status: mysqlEnum("status", ["uploading", "processing", "ready", "error"]).default("uploading").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Document = typeof documents.$inferSelect;

// ─── DOCUMENT CHUNKS (RAG embeddings) ─────────────────────────────
export const documentChunks = mysqlTable("document_chunks", {
  id: int("id").autoincrement().primaryKey(),
  documentId: int("documentId").notNull(),
  userId: int("userId").notNull(),
  content: text("content").notNull(),
  chunkIndex: int("chunkIndex").notNull(),
  category: mysqlEnum("category", ["personal_docs", "financial_products", "regulations", "training_materials", "artifacts", "skills"]).default("personal_docs").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type DocumentChunk = typeof documentChunks.$inferSelect;

// ─── PRODUCTS ──────────────────────────────────────────────────────
export const products = mysqlTable("products", {
  id: int("id").autoincrement().primaryKey(),
  company: varchar("company", { length: 128 }).notNull(),
  name: varchar("name", { length: 256 }).notNull(),
  category: mysqlEnum("category", ["iul", "term_life", "disability", "ltc", "premium_finance", "whole_life", "variable_life"]).notNull(),
  description: text("description"),
  features: json("features"),
  riskLevel: mysqlEnum("riskLevel", ["low", "moderate", "moderate_high", "high"]),
  minPremium: float("minPremium"),
  maxPremium: float("maxPremium"),
  targetAudience: text("targetAudience"),
  competitorFlag: mysqlBoolean("competitorFlag").default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Product = typeof products.$inferSelect;

// ─── COMPLIANCE AUDIT TRAIL ───────────────────────────────────────
export const auditTrail = mysqlTable("audit_trail", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  conversationId: int("conversationId"),
  messageId: int("messageId"),
  action: varchar("action", { length: 128 }).notNull(),
  details: text("details"),
  complianceFlags: json("complianceFlags"),
  piiDetected: mysqlBoolean("piiDetected").default(false),
  disclaimerAppended: mysqlBoolean("disclaimerAppended").default(false),
  reviewStatus: mysqlEnum("reviewStatus", ["auto_approved", "pending_review", "approved", "rejected", "modified"]).default("auto_approved"),
  reviewedBy: int("reviewedBy"),
  reviewNotes: text("reviewNotes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AuditTrailEntry = typeof auditTrail.$inferSelect;

// ─── REVIEW QUEUE (Layer 4 Human-in-the-Loop) ─────────────────────
export const reviewQueue = mysqlTable("review_queue", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  conversationId: int("conversationId").notNull(),
  messageId: int("messageId").notNull(),
  confidenceScore: float("confidenceScore").notNull(),
  autonomyLevel: mysqlEnum("autonomyLevel", ["high", "medium", "low"]).notNull(),
  aiReasoning: text("aiReasoning"),
  aiRecommendation: text("aiRecommendation"),
  complianceNotes: text("complianceNotes"),
  status: mysqlEnum("status", ["pending", "approved", "rejected", "modified"]).default("pending").notNull(),
  reviewerAction: text("reviewerAction"),
  reviewedBy: int("reviewedBy"),
  reviewedAt: timestamp("reviewedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ReviewQueueItem = typeof reviewQueue.$inferSelect;

// ─── MEMORIES (Mem0-style) ────────────────────────────────────────
export const memories = mysqlTable("memories", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  category: mysqlEnum("category", ["fact", "preference", "goal", "relationship", "financial", "temporal"]).default("fact").notNull(),
  content: text("content").notNull(),
  source: varchar("source", { length: 128 }),
  confidence: float("confidence").default(0.8),
  validFrom: timestamp("validFrom"),
  validUntil: timestamp("validUntil"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Memory = typeof memories.$inferSelect;

// ─── FEEDBACK ─────────────────────────────────────────────────────
export const feedback = mysqlTable("feedback", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  messageId: int("messageId").notNull(),
  conversationId: int("conversationId").notNull(),
  rating: mysqlEnum("rating", ["up", "down"]).notNull(),
  comment: text("comment"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Feedback = typeof feedback.$inferSelect;

// ─── QUALITY RATINGS ──────────────────────────────────────────────
export const qualityRatings = mysqlTable("quality_ratings", {
  id: int("id").autoincrement().primaryKey(),
  messageId: int("messageId").notNull(),
  conversationId: int("conversationId").notNull(),
  score: float("score").notNull(),
  reasoning: text("reasoning"),
  improvementSuggestions: text("improvementSuggestions"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type QualityRating = typeof qualityRatings.$inferSelect;

// ─── SUITABILITY ASSESSMENTS ──────────────────────────────────────
export const suitabilityAssessments = mysqlTable("suitability_assessments", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  riskTolerance: mysqlEnum("riskTolerance", ["conservative", "moderate", "aggressive"]),
  investmentHorizon: varchar("investmentHorizon", { length: 64 }),
  annualIncome: varchar("annualIncome", { length: 64 }),
  netWorth: varchar("netWorth", { length: 64 }),
  investmentExperience: mysqlEnum("investmentExperience", ["none", "limited", "moderate", "extensive"]),
  financialGoals: json("financialGoals"),
  insuranceNeeds: json("insuranceNeeds"),
  responses: json("responses"),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SuitabilityAssessment = typeof suitabilityAssessments.$inferSelect;

// ─── PROMPT VARIANTS (A/B Testing) ───────────────────────────────
export const promptVariants = mysqlTable("prompt_variants", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 256 }).notNull(),
  description: text("description"),
  promptTemplate: text("promptTemplate").notNull(),
  category: varchar("category", { length: 64 }).default("system"),
  isActive: mysqlBoolean("isActive").default(true),
  weight: float("weight").default(1.0),
  totalUses: int("totalUses").default(0),
  avgRating: float("avgRating").default(0),
  positiveCount: int("positiveCount").default(0),
  negativeCount: int("negativeCount").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PromptVariant = typeof promptVariants.$inferSelect;

// ─── PROMPT EXPERIMENT LOG ───────────────────────────────────────
export const promptExperiments = mysqlTable("prompt_experiments", {
  id: int("id").autoincrement().primaryKey(),
  variantId: int("variantId").notNull(),
  conversationId: int("conversationId").notNull(),
  messageId: int("messageId"),
  feedbackRating: mysqlEnum("feedbackRating", ["up", "down"]),
  confidenceScore: float("confidenceScore"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PromptExperiment = typeof promptExperiments.$inferSelect;
