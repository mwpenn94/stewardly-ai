import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, json, float, boolean as mysqlBoolean, bigint } from "drizzle-orm/mysql-core";

// ─── ORGANIZATIONS (Multi-Tenant Organizational Units) ─────────────────────
// DB table: organizations
export const organizations = mysqlTable("organizations", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 256 }).notNull(),
  slug: varchar("slug", { length: 128 }).notNull().unique(),
  description: text("description"),
  website: varchar("website", { length: 512 }),
  ein: varchar("ein", { length: 20 }),
  industry: varchar("industry", { length: 128 }),
  size: mysqlEnum("size", ["solo", "small", "medium", "large", "enterprise"]).default("small"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Organization = typeof organizations.$inferSelect;
export type InsertOrganization = typeof organizations.$inferInsert;

// ─── USER-ORGANIZATION ROLES (Many-to-many with role context) ────────────
// DB table: user_organization_roles
export const userOrganizationRoles = mysqlTable("user_organization_roles", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  organizationId: int("organizationId").notNull(),
  globalRole: mysqlEnum("globalRole", ["global_admin", "user"]).default("user"),
  organizationRole: mysqlEnum("organizationRole", ["org_admin", "manager", "professional", "user"]).default("user"),
  managerId: int("managerId"),
  professionalId: int("professionalId"),
  status: mysqlEnum("status", ["active", "inactive", "invited", "pending_approval"]).default("active"),
  invitedAt: timestamp("invitedAt"),
  approvedAt: timestamp("approvedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type UserOrganizationRole = typeof userOrganizationRoles.$inferSelect;
export type InsertUserOrganizationRole = typeof userOrganizationRoles.$inferInsert;

// ─── ORGANIZATION RELATIONSHIPS (Org-to-org connections) ─────────────────
// DB table: organization_relationships
export const organizationRelationships = mysqlTable("organization_relationships", {
  id: int("id").autoincrement().primaryKey(),
  parentOrgId: int("parentOrgId").notNull(),
  childOrgId: int("childOrgId").notNull(),
  relationshipType: mysqlEnum("relationshipType", ["partner", "subsidiary", "affiliate", "referral", "vendor", "client"]).notNull(),
  status: mysqlEnum("status", ["active", "inactive", "pending"]).default("active"),
  metadata: json("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type OrganizationRelationship = typeof organizationRelationships.$inferSelect;

// ─── USER RELATIONSHIPS (User-to-user connections) ───────────────────────
// DB table: user_relationships
export const userRelationships = mysqlTable("user_relationships", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  relatedUserId: int("relatedUserId").notNull(),
  relationshipType: mysqlEnum("relationshipType", ["manager", "team_member", "mentor", "mentee", "peer", "client", "advisor", "colleague"]).notNull(),
  organizationId: int("organizationId"),
  status: mysqlEnum("status", ["active", "inactive", "pending"]).default("active"),
  metadata: json("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type UserRelationship = typeof userRelationships.$inferSelect;

// ─── ORGANIZATION LANDING PAGE CONFIG ──────────────────────────────────────
// DB table: organization_landing_page_config
export const organizationLandingPageConfig = mysqlTable("organization_landing_page_config", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull().unique(),
  headline: varchar("headline", { length: 512 }).default("Your Complete Financial Picture, Understood by Us"),
  subtitle: text("subtitle"),
  ctaText: varchar("ctaText", { length: 128 }).default("Start Your Financial Twin →"),
  secondaryLinkText: varchar("secondaryLinkText", { length: 128 }).default("Try it anonymously"),
  logoUrl: text("logoUrl"),
  primaryColor: varchar("primaryColor", { length: 7 }).default("#0F172A"),
  accentColor: varchar("accentColor", { length: 7 }).default("#0EA5E9"),
  backgroundOption: varchar("backgroundOption", { length: 64 }).default("gradient"),
  trustSignal1: text("trustSignal1"),
  trustSignal2: text("trustSignal2"),
  trustSignal3: text("trustSignal3"),
  disclaimerText: text("disclaimerText"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type OrganizationLandingPageConfig = typeof organizationLandingPageConfig.$inferSelect;

// ─── USERS ────────────────────────────────────────────────────────────────
// DB table: users
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "advisor", "manager", "admin"]).default("user").notNull(),
  authTier: mysqlEnum("authTier", ["anonymous", "email", "full", "advisor_connected"]).default("full").notNull(),
  affiliateOrgId: int("affiliateOrgId"),
  anonymousConversationCount: int("anonymousConversationCount").default(0).notNull(),
  passwordHash: text("passwordHash"),
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

// ─── USER PROFILES (Extended personal data) ──────────────────────────────
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

// ─── PLATFORM AI SETTINGS (Layer 1 — Global Admin Only) ─────────────────
// DB table: platform_ai_settings
export const platformAISettings = mysqlTable("platform_ai_settings", {
  id: int("id").autoincrement().primaryKey(),
  settingKey: varchar("settingKey", { length: 64 }).notNull().unique().default("default"),
  baseSystemPrompt: text("baseSystemPrompt"),
  defaultTone: varchar("defaultTone", { length: 64 }).default("professional"),
  defaultResponseFormat: varchar("defaultResponseFormat", { length: 64 }).default("mixed"),
  defaultResponseLength: varchar("defaultResponseLength", { length: 64 }).default("standard"),
  modelPreferences: json("modelPreferences"),
  ensembleWeights: json("ensembleWeights"),
  globalGuardrails: json("globalGuardrails"),
  prohibitedTopics: json("prohibitedTopics"),
  maxTokensDefault: int("maxTokensDefault").default(4096),
  temperatureDefault: float("temperatureDefault").default(0.7),
  enabledFocusModes: json("enabledFocusModes"),
  platformDisclaimer: text("platformDisclaimer"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PlatformAISetting = typeof platformAISettings.$inferSelect;

// ─── ORGANIZATION AI SETTINGS (Layer 2 Prompt) ──────────────────────────
// DB table: organization_ai_settings
export const organizationAISettings = mysqlTable("organization_ai_settings", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull().unique(),
  organizationName: varchar("organizationName", { length: 256 }).notNull(),
  brandVoice: text("brandVoice"),
  approvedProductCategories: json("approvedProductCategories"),
  prohibitedTopics: json("prohibitedTopics"),
  complianceLanguage: text("complianceLanguage"),
  customDisclaimers: text("customDisclaimers"),
  promptOverlay: text("promptOverlay"),
  toneStyle: varchar("toneStyle", { length: 64 }).default("professional"),
  responseFormat: varchar("responseFormat", { length: 64 }).default("mixed"),
  responseLength: varchar("responseLength", { length: 64 }).default("standard"),
  modelPreferences: json("modelPreferences"),
  ensembleWeights: json("ensembleWeights"),
  temperature: float("temperature"),
  maxTokens: int("maxTokens"),
  enabledFocusModes: json("enabledFocusModes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type OrganizationAISetting = typeof organizationAISettings.$inferSelect;

// ─── MANAGER AI SETTINGS (Layer 3 Prompt) ────────────────────────────────
export const managerAISettings = mysqlTable("manager_ai_settings", {
  id: int("id").autoincrement().primaryKey(),
  managerId: int("managerId").notNull().unique(),
  organizationId: int("organizationId"),
  teamFocusAreas: json("teamFocusAreas"),
  clientSegmentTargeting: text("clientSegmentTargeting"),
  reportingRequirements: json("reportingRequirements"),
  promptOverlay: text("promptOverlay"),
  toneStyle: varchar("toneStyle", { length: 64 }),
  responseFormat: varchar("responseFormat", { length: 64 }),
  responseLength: varchar("responseLength", { length: 64 }),
  modelPreferences: json("modelPreferences"),
  ensembleWeights: json("ensembleWeights"),
  temperature: float("temperature"),
  maxTokens: int("maxTokens"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ManagerAISetting = typeof managerAISettings.$inferSelect;

// ─── PROFESSIONAL AI SETTINGS (Layer 4 Prompt) ──────────────────────────
export const professionalAISettings = mysqlTable("professional_ai_settings", {
  id: int("id").autoincrement().primaryKey(),
  professionalId: int("professionalId").notNull().unique(),
  organizationId: int("organizationId"),
  managerId: int("managerId"),
  specialization: varchar("specialization", { length: 256 }),
  methodology: text("methodology"),
  communicationStyle: text("communicationStyle"),
  perClientOverrides: json("perClientOverrides"),
  promptOverlay: text("promptOverlay"),
  toneStyle: varchar("toneStyle", { length: 64 }),
  responseFormat: varchar("responseFormat", { length: 64 }),
  responseLength: varchar("responseLength", { length: 64 }),
  modelPreferences: json("modelPreferences"),
  ensembleWeights: json("ensembleWeights"),
  temperature: float("temperature"),
  maxTokens: int("maxTokens"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ProfessionalAISetting = typeof professionalAISettings.$inferSelect;

// ─── USER PREFERENCES (Layer 5 Context) ──────────────────────────────────
export const userPreferences = mysqlTable("user_preferences", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  communicationStyle: mysqlEnum("communicationStyle", ["simple", "detailed", "expert"]).default("detailed"),
  responseLength: mysqlEnum("responseLength", ["concise", "standard", "comprehensive"]).default("standard"),
  responseFormat: varchar("responseFormat", { length: 64 }).default("mixed"),
  ttsVoice: varchar("ttsVoice", { length: 64 }).default("en-US-JennyNeural"),
  autoPlayVoice: mysqlBoolean("autoPlayVoice").default(false),
  handsFreeMode: mysqlBoolean("handsFreeMode").default(false),
  autoGenerateCharts: mysqlBoolean("autoGenerateCharts").default(true),
  riskTolerance: mysqlEnum("riskTolerance", ["conservative", "moderate", "aggressive"]),
  financialGoals: json("financialGoals"),
  taxFilingStatus: varchar("taxFilingStatus", { length: 64 }),
  stateOfResidence: varchar("stateOfResidence", { length: 64 }),
  theme: mysqlEnum("theme", ["system", "light", "dark"]).default("dark"),
  sidebarDefault: mysqlEnum("sidebarDefault", ["expanded", "collapsed"]).default("expanded"),
  chatDensity: mysqlEnum("chatDensity", ["comfortable", "compact"]).default("comfortable"),
  language: varchar("language", { length: 64 }).default("en"),
  modelPreferences: json("modelPreferences"),
  ensembleWeights: json("ensembleWeights"),
  temperature: float("temperature"),
  maxTokens: int("maxTokens"),
  customPromptAdditions: text("customPromptAdditions"),
  focusModeDefaults: varchar("focusModeDefaults", { length: 128 }).default("general,financial"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type UserPreference = typeof userPreferences.$inferSelect;

// ─── VIEW-AS AUDIT LOG ────────────────────────────────────────────────────
export const viewAsAuditLog = mysqlTable("view_as_audit_log", {
  id: int("id").autoincrement().primaryKey(),
  actorId: int("actorId").notNull(),
  targetUserId: int("targetUserId").notNull(),
  organizationId: int("organizationId"),
  startTime: timestamp("startTime").notNull(),
  endTime: timestamp("endTime"),
  actions: json("actions"),
  reason: text("reason"),
  sessionDuration: int("sessionDuration"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ViewAsAuditLogEntry = typeof viewAsAuditLog.$inferSelect;

// ─── WORKFLOW CHECKLIST (Onboarding Steps) ───────────────────────────────
export const workflowChecklist = mysqlTable("workflow_checklist", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  workflowType: mysqlEnum("workflowType", ["professional_onboarding", "client_onboarding", "licensing", "registration"]).notNull(),
  steps: json("steps").notNull(),
  currentStep: int("currentStep").default(0),
  status: mysqlEnum("status", ["not_started", "in_progress", "completed", "paused"]).default("not_started"),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type WorkflowChecklist = typeof workflowChecklist.$inferSelect;

// ─── PROFESSIONAL CONTEXT ────────────────────────────────────────────────
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

// ─── CLIENT ASSOCIATIONS ─────────────────────────────────────────────────
export const clientAssociations = mysqlTable("client_associations", {
  id: int("id").autoincrement().primaryKey(),
  clientId: int("clientId").notNull(),
  professionalId: int("professionalId").notNull(),
  organizationId: int("organizationId"),
  status: mysqlEnum("status", ["active", "inactive"]).default("active"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ClientAssociation = typeof clientAssociations.$inferSelect;

// ─── ENRICHMENT DATASETS ─────────────────────────────────────────────────
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

// ─── ENRICHMENT COHORTS ──────────────────────────────────────────────────
export const enrichmentCohorts = mysqlTable("enrichment_cohorts", {
  id: int("id").autoincrement().primaryKey(),
  datasetId: int("datasetId").notNull(),
  matchCriteria: json("matchCriteria").notNull(),
  enrichmentFields: json("enrichmentFields").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type EnrichmentCohort = typeof enrichmentCohorts.$inferSelect;

// ─── ENRICHMENT MATCHES ──────────────────────────────────────────────────
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

// ─── AFFILIATED RESOURCES ────────────────────────────────────────────────
export const affiliatedResources = mysqlTable("affiliated_resources", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId"),
  name: varchar("name", { length: 256 }).notNull(),
  category: mysqlEnum("category", ["carrier", "lender", "ria", "advanced_markets", "general_partner"]).notNull(),
  description: text("description"),
  contactInfo: json("contactInfo"),
  isActive: mysqlBoolean("isActive").default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AffiliatedResource = typeof affiliatedResources.$inferSelect;

// ─── CONVERSATIONS ────────────────────────────────────────────────────────
// DB table: conversations (has organizationId, NOT firmId or isPinned)
export const conversations = mysqlTable("conversations", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  title: varchar("title", { length: 255 }).default("New Conversation"),
  mode: mysqlEnum("mode", ["client", "coach", "manager"]).default("client").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  organizationId: int("organizationId"),
});

export type Conversation = typeof conversations.$inferSelect;

// ─── MESSAGES ─────────────────────────────────────────────────────────────
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

// ─── DOCUMENTS (RAG) ──────────────────────────────────────────────────────
export const documents = mysqlTable("documents", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  organizationId: int("organizationId"),
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

// ─── DOCUMENT CHUNKS (RAG embeddings) ─────────────────────────────────────
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

// ─── PRODUCTS ──────────────────────────────────────────────────────────────
export const products = mysqlTable("products", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId"),
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
  isPlatform: mysqlBoolean("isPlatform").default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
});

export type Product = typeof products.$inferSelect;

// ─── COMPLIANCE AUDIT TRAIL ───────────────────────────────────────────────
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

// ─── REVIEW QUEUE (Layer 4 Human-in-the-Loop) ─────────────────────────────
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

// ─── MEMORIES (Mem0-style) ────────────────────────────────────────────────
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

// ─── FEEDBACK ─────────────────────────────────────────────────────────────
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

// ─── QUALITY RATINGS ──────────────────────────────────────────────────────
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

// ─── SUITABILITY ASSESSMENTS ──────────────────────────────────────────────
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

// ─── PROMPT VARIANTS (A/B Testing) ───────────────────────────────────────
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

// ─── PROMPT EXPERIMENT LOG ───────────────────────────────────────────────
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


// ─── MEETINGS (Meeting Intelligence) ───────────────────────────────────────
// DB table: meetings
export const meetings = mysqlTable("meetings", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  organizationId: int("organizationId"),
  clientName: varchar("clientName", { length: 256 }),
  clientId: int("clientId"),
  meetingType: mysqlEnum("meetingType", [
    "initial_consultation", "portfolio_review", "financial_plan",
    "tax_planning", "estate_planning", "insurance_review", "general", "follow_up",
  ]).default("general"),
  status: mysqlEnum("status", ["scheduled", "preparing", "in_progress", "completed", "cancelled"]).default("scheduled"),
  scheduledAt: timestamp("scheduledAt"),
  completedAt: timestamp("completedAt"),
  preMeetingBrief: text("preMeetingBrief"),
  postMeetingSummary: text("postMeetingSummary"),
  transcript: text("transcript"),
  keyDecisions: text("keyDecisions"),
  followUpDate: timestamp("followUpDate"),
  followUpEmail: text("followUpEmail"),
  complianceNotes: text("complianceNotes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type Meeting = typeof meetings.$inferSelect;

// DB table: meeting_action_items
export const meetingActionItems = mysqlTable("meeting_action_items", {
  id: int("id").autoincrement().primaryKey(),
  meetingId: int("meetingId").notNull(),
  userId: int("userId").notNull(),
  title: varchar("title", { length: 512 }).notNull(),
  description: text("description"),
  assignedTo: varchar("assignedTo", { length: 256 }),
  priority: mysqlEnum("priority", ["low", "medium", "high", "urgent"]).default("medium"),
  status: mysqlEnum("status", ["pending", "in_progress", "completed", "cancelled"]).default("pending"),
  dueDate: timestamp("dueDate"),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type MeetingActionItem = typeof meetingActionItems.$inferSelect;


// ─── PROACTIVE INSIGHTS ──────────────────────────────────────────────────
export const proactiveInsights = mysqlTable("proactive_insights", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  organizationId: int("organization_id"),
  clientId: int("client_id"),
  category: mysqlEnum("category", ["compliance", "portfolio", "tax", "engagement", "spending", "life_event"]).default("portfolio").notNull(),
  priority: mysqlEnum("priority", ["low", "medium", "high", "critical"]).default("medium").notNull(),
  title: varchar("title", { length: 256 }).notNull(),
  description: text("description"),
  suggestedAction: text("suggested_action"),
  status: mysqlEnum("status", ["new", "viewed", "acted", "dismissed", "snoozed"]).default("new").notNull(),
  snoozeUntil: timestamp("snooze_until"),
  actedAt: timestamp("acted_at"),
  dismissedAt: timestamp("dismissed_at"),
  metadata: json("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type ProactiveInsight = typeof proactiveInsights.$inferSelect;

// ─── ENGAGEMENT SCORES ───────────────────────────────────────────────────
export const engagementScores = mysqlTable("engagement_scores", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  clientId: int("client_id"),
  organizationId: int("organization_id"),
  loginFrequency: float("login_frequency").default(0),
  meetingCadence: float("meeting_cadence").default(0),
  responseTimeAvg: float("response_time_avg").default(0),
  portalActivity: float("portal_activity").default(0),
  overallScore: float("overall_score").default(0),
  riskLevel: mysqlEnum("risk_level", ["healthy", "at_risk", "critical"]).default("healthy").notNull(),
  periodStart: timestamp("period_start"),
  periodEnd: timestamp("period_end"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type EngagementScore = typeof engagementScores.$inferSelect;


// ─── COMPLIANCE REVIEWS ────────────────────────────────────────────────
export const complianceReviews = mysqlTable("compliance_reviews", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: varchar("user_id", { length: 255 }).notNull(),
  organizationId: varchar("organization_id", { length: 255 }),
  reviewType: varchar("review_type", { length: 50 }).notNull().default("content_review"),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  contentHash: varchar("content_hash", { length: 64 }),
  originalContent: text("original_content"),
  flaggedIssues: text("flagged_issues"),
  appliedFixes: text("applied_fixes"),
  severity: varchar("severity", { length: 20 }).default("low"),
  reviewerId: varchar("reviewer_id", { length: 255 }),
  reviewedAt: bigint("reviewed_at", { mode: "number" }),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});
export type ComplianceReview = typeof complianceReviews.$inferSelect;

// ─── COMPLIANCE FLAGS ──────────────────────────────────────────────────
export const complianceFlags = mysqlTable("compliance_flags", {
  id: varchar("id", { length: 36 }).primaryKey(),
  reviewId: varchar("review_id", { length: 36 }).notNull(),
  ruleCode: varchar("rule_code", { length: 50 }).notNull(),
  ruleName: varchar("rule_name", { length: 255 }).notNull(),
  description: text("description"),
  severity: varchar("severity", { length: 20 }).notNull().default("warning"),
  autoFixed: mysqlBoolean("auto_fixed").default(false),
  fixApplied: text("fix_applied"),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});
export type ComplianceFlag = typeof complianceFlags.$inferSelect;

// ─── FEATURE FLAGS ──────────────────────────────────────────────────
export const featureFlags = mysqlTable("feature_flags", {
  id: int("id").autoincrement().primaryKey(),
  flagKey: varchar("flagKey", { length: 128 }).notNull().unique(),
  label: varchar("label", { length: 256 }).notNull(),
  description: text("description"),
  enabled: mysqlBoolean("enabled").notNull().default(true),
  scope: mysqlEnum("scope", ["platform", "organization"]).notNull().default("platform"),
  organizationId: int("organizationId"),
  updatedBy: int("updatedBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type FeatureFlag = typeof featureFlags.$inferSelect;


// ═══════════════════════════════════════════════════════════════════
// v4+ TABLES — Memory Engine, Knowledge Graph, Compliance Copilot,
//              Privacy Shield, Education, Plan Adherence, Segmentation
// ═══════════════════════════════════════════════════════════════════

// ─── MEMORY EPISODES (Conversation Summaries — Tier 3) ──────────
export const memoryEpisodes = mysqlTable("memory_episodes", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  conversationId: int("conversationId").notNull(),
  summary: text("summary").notNull(),
  keyTopics: json("keyTopics"), // string[]
  emotionalTone: varchar("emotionalTone", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type MemoryEpisode = typeof memoryEpisodes.$inferSelect;

// ─── KNOWLEDGE GRAPH NODES ──────────────────────────────────────
export const kgNodes = mysqlTable("kg_nodes", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  nodeType: mysqlEnum("nodeType", [
    "person", "account", "goal", "insurance", "property",
    "liability", "income", "tax", "estate", "product",
    "regulation", "document", "advisor", "beneficiary",
  ]).notNull(),
  label: varchar("label", { length: 256 }).notNull(),
  dataJson: json("dataJson"),
  status: mysqlEnum("status", ["active", "inactive", "pending"]).default("active"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type KgNode = typeof kgNodes.$inferSelect;

// ─── KNOWLEDGE GRAPH EDGES ──────────────────────────────────────
export const kgEdges = mysqlTable("kg_edges", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  sourceNodeId: int("sourceNodeId").notNull(),
  targetNodeId: int("targetNodeId").notNull(),
  edgeType: mysqlEnum("edgeType", [
    "owns", "benefits_from", "funds", "pays", "governs",
    "depends_on", "conflicts_with", "beneficiary_of",
    "manages", "insures", "employs", "related_to",
  ]).notNull(),
  weight: float("weight").default(1.0),
  metadataJson: json("metadataJson"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type KgEdge = typeof kgEdges.$inferSelect;

// ─── COMPLIANCE AUDIT (Enhanced — Immutable Append-Only) ────────
export const complianceAudit = mysqlTable("compliance_audit", {
  id: int("id").autoincrement().primaryKey(),
  messageId: int("messageId").notNull(),
  userId: int("userId").notNull(),
  conversationId: int("conversationId"),
  classification: mysqlEnum("classification", [
    "general_education", "product_discussion",
    "personalized_recommendation", "investment_advice",
  ]).notNull(),
  confidenceScore: float("confidenceScore").notNull(),
  flagsJson: json("flagsJson"),
  reasoningChainJson: json("reasoningChainJson"),
  modificationsJson: json("modificationsJson"),
  reviewTier: mysqlEnum("reviewTier", ["auto_approved", "auto_modified", "human_review", "blocked"]).notNull(),
  reviewerId: int("reviewerId"),
  modelVersion: varchar("modelVersion", { length: 64 }),
  promptHash: varchar("promptHash", { length: 64 }),
  deliveryStatus: mysqlEnum("deliveryStatus", ["delivered", "held", "blocked", "modified"]).default("delivered"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type ComplianceAuditEntry = typeof complianceAudit.$inferSelect;

// ─── PRIVACY AUDIT LOG ──────────────────────────────────────────
export const privacyAudit = mysqlTable("privacy_audit", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  apiCallPurpose: varchar("apiCallPurpose", { length: 128 }).notNull(),
  dataCategories: json("dataCategories"), // string[]
  piiMasked: mysqlBoolean("piiMasked").default(false),
  modelUsed: varchar("modelUsed", { length: 64 }),
  tokensSent: int("tokensSent"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type PrivacyAuditEntry = typeof privacyAudit.$inferSelect;

// ─── EDUCATION MODULES ──────────────────────────────────────────
export const educationModules = mysqlTable("education_modules", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 256 }).notNull(),
  description: text("description"),
  category: mysqlEnum("category", [
    "budgeting", "investing", "insurance", "tax", "estate",
    "retirement", "debt", "credit", "real_estate", "general",
  ]).notNull(),
  difficulty: mysqlEnum("difficulty", ["beginner", "intermediate", "advanced"]).default("beginner"),
  estimatedMinutes: int("estimatedMinutes").default(5),
  content: text("content"), // markdown
  isActive: mysqlBoolean("isActive").default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type EducationModule = typeof educationModules.$inferSelect;

// ─── EDUCATION PROGRESS ─────────────────────────────────────────
export const educationProgress = mysqlTable("education_progress", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  moduleId: int("moduleId").notNull(),
  assignedBy: varchar("assignedBy", { length: 64 }).default("system"),
  startedAt: timestamp("startedAt"),
  completedAt: timestamp("completedAt"),
  score: float("score"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type EducationProgressEntry = typeof educationProgress.$inferSelect;

// ─── PLAN ADHERENCE ─────────────────────────────────────────────
export const planAdherence = mysqlTable("plan_adherence", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  category: mysqlEnum("category", ["savings", "spending", "investment", "debt", "insurance", "estate"]).notNull(),
  targetValue: float("targetValue"),
  actualValue: float("actualValue"),
  adherenceScore: float("adherenceScore"), // 0-100
  trend: mysqlEnum("trend", ["improving", "stable", "declining"]).default("stable"),
  lastNudgeTier: mysqlEnum("lastNudgeTier", ["none", "gentle", "contextual", "advisor_alert", "plan_revision"]).default("none"),
  periodStart: timestamp("periodStart"),
  periodEnd: timestamp("periodEnd"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type PlanAdherenceEntry = typeof planAdherence.$inferSelect;

// ─── CLIENT SEGMENTS ────────────────────────────────────────────
export const clientSegments = mysqlTable("client_segments", {
  id: int("id").autoincrement().primaryKey(),
  clientId: int("clientId").notNull(),
  professionalId: int("professionalId").notNull(),
  valueScore: float("valueScore").default(0),
  growthScore: float("growthScore").default(0),
  engagementScore: float("engagementScore").default(0),
  relationshipScore: float("relationshipScore").default(0),
  totalScore: float("totalScore").default(0),
  tier: mysqlEnum("tier", ["platinum", "gold", "silver", "bronze"]).default("silver"),
  serviceModelJson: json("serviceModelJson"),
  previousTier: mysqlEnum("previousTier", ["platinum", "gold", "silver", "bronze"]),
  lastClassified: timestamp("lastClassified"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type ClientSegment = typeof clientSegments.$inferSelect;

// ─── PRACTICE METRICS ───────────────────────────────────────────
export const practiceMetrics = mysqlTable("practice_metrics", {
  id: int("id").autoincrement().primaryKey(),
  professionalId: int("professionalId").notNull(),
  firmId: int("firmId"),
  periodEndDate: timestamp("periodEndDate").notNull(),
  organicGrowthRate: float("organicGrowthRate"),
  netNewClients: int("netNewClients"),
  revenuePerClient: float("revenuePerClient"),
  costToServeJson: json("costToServeJson"),
  attritionRiskClientsJson: json("attritionRiskClientsJson"),
  engagementScoresJson: json("engagementScoresJson"),
  benchmarkPercentilesJson: json("benchmarkPercentilesJson"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type PracticeMetric = typeof practiceMetrics.$inferSelect;

// ─── STUDENT LOANS ──────────────────────────────────────────────
export const studentLoans = mysqlTable("student_loans", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  servicer: varchar("servicer", { length: 256 }),
  balance: float("balance").notNull(),
  rate: float("rate").notNull(),
  loanType: mysqlEnum("loanType", ["subsidized", "unsubsidized", "plus", "grad_plus", "private", "consolidation"]).notNull(),
  repaymentPlan: varchar("repaymentPlan", { length: 64 }),
  paymentsMade: int("paymentsMade").default(0),
  remainingTerm: int("remainingTerm"), // months
  pslfQualifyingPayments: int("pslfQualifyingPayments").default(0),
  pslfEligible: mysqlBoolean("pslfEligible").default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type StudentLoan = typeof studentLoans.$inferSelect;

// ─── EQUITY GRANTS ──────────────────────────────────────────────
export const equityGrants = mysqlTable("equity_grants", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  grantType: mysqlEnum("grantType", ["iso", "nso", "rsu", "espp"]).notNull(),
  company: varchar("company", { length: 256 }).notNull(),
  grantDate: timestamp("grantDate"),
  vestingSchedule: json("vestingSchedule"),
  exercisePrice: float("exercisePrice"),
  currentFMV: float("currentFMV"),
  sharesGranted: int("sharesGranted"),
  sharesVested: int("sharesVested").default(0),
  sharesExercised: int("sharesExercised").default(0),
  expirationDate: timestamp("expirationDate"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type EquityGrant = typeof equityGrants.$inferSelect;

// ─── COI CONTACTS ───────────────────────────────────────────────
export const coiContacts = mysqlTable("coi_contacts", {
  id: int("id").autoincrement().primaryKey(),
  professionalId: int("professionalId").notNull(),
  firmId: int("firmId"),
  name: varchar("name", { length: 256 }).notNull(),
  coiFirm: varchar("coiFirm", { length: 256 }),
  specialty: mysqlEnum("specialty", ["cpa", "attorney", "insurance_agent", "mortgage_broker", "real_estate", "other"]).notNull(),
  contactJson: json("contactJson"),
  relationshipStrength: mysqlEnum("relationshipStrength", ["strong", "moderate", "new"]).default("new"),
  referralsSent: int("referralsSent").default(0),
  referralsReceived: int("referralsReceived").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type CoiContact = typeof coiContacts.$inferSelect;

// ─── REFERRALS ──────────────────────────────────────────────────
export const referrals = mysqlTable("referrals", {
  id: int("id").autoincrement().primaryKey(),
  fromProfessionalId: int("fromProfessionalId").notNull(),
  toCoiId: int("toCoiId").notNull(),
  clientId: int("clientId"),
  reason: text("reason"),
  outcome: mysqlEnum("outcome", ["pending", "accepted", "completed", "declined"]).default("pending"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type Referral = typeof referrals.$inferSelect;

// ─── DIGITAL ASSET INVENTORY ────────────────────────────────────
export const digitalAssetInventory = mysqlTable("digital_asset_inventory", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  assetType: mysqlEnum("assetType", [
    "crypto_wallet", "exchange_account", "brokerage", "bank",
    "social_media", "email", "cloud_storage", "loyalty_program",
    "domain", "digital_content", "other",
  ]).notNull(),
  platform: varchar("platform", { length: 256 }).notNull(),
  approximateValue: float("approximateValue"),
  accessMethod: text("accessMethod"), // encrypted description
  hasAccessPlan: mysqlBoolean("hasAccessPlan").default(false),
  legacyContactSet: mysqlBoolean("legacyContactSet").default(false),
  lastVerified: timestamp("lastVerified"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type DigitalAssetInventoryItem = typeof digitalAssetInventory.$inferSelect;

// ─── NOTIFICATION LOG ───────────────────────────────────────────
export const notificationLog = mysqlTable("notification_log", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  type: varchar("type", { length: 64 }).notNull(),
  channel: mysqlEnum("channel", ["in_app", "email", "push", "sms"]).default("in_app"),
  urgency: mysqlEnum("urgency", ["low", "medium", "high", "critical"]).default("medium"),
  title: varchar("title", { length: 256 }),
  content: text("content"),
  deliveredAt: timestamp("deliveredAt"),
  readAt: timestamp("readAt"),
  suppressed: mysqlBoolean("suppressed").default(false),
  suppressionReason: varchar("suppressionReason", { length: 128 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type NotificationLogEntry = typeof notificationLog.$inferSelect;
