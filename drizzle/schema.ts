import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, json, float, boolean as mysqlBoolean, bigint, decimal, date } from "drizzle-orm/mysql-core";

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
  // AI Fine-Tuning fields
  thinkingDepth: mysqlEnum("thinkingDepth", ["quick", "standard", "deep", "extended"]).default("standard"),
  creativity: float("creativity").default(0.7),
  contextDepth: mysqlEnum("contextDepth", ["recent", "moderate", "full"]).default("moderate"),
  disclaimerVerbosity: mysqlEnum("disclaimerVerbosity", ["minimal", "standard", "comprehensive"]).default("standard"),
  autoFollowUp: mysqlBoolean("autoFollowUp").default(false),
  autoFollowUpCount: int("autoFollowUpCount").default(1),
  crossModelVerify: mysqlBoolean("crossModelVerify").default(false),
  citationStyle: mysqlEnum("citationStyle", ["none", "inline", "footnotes"]).default("none"),
  reasoningTransparency: mysqlBoolean("reasoningTransparency").default(false),
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

// ─── LTC Analyses ──────────────────────────────────────────────
export const ltcAnalyses = mysqlTable("ltc_analyses", {
  id: int("id").primaryKey().autoincrement(),
  userId: int("user_id").notNull(),
  currentAge: int("current_age"),
  retirementAge: int("retirement_age").default(65),
  state: varchar("state", { length: 2 }),
  zipCode: varchar("zip_code", { length: 10 }),
  healthStatus: mysqlEnum("health_status", ["excellent", "good", "fair", "poor"]).default("good"),
  gender: mysqlEnum("gender", ["male", "female", "other"]),
  maritalStatus: mysqlEnum("marital_status", ["single", "married", "divorced", "widowed"]),
  annualIncome: decimal("annual_income", { precision: 15, scale: 2 }),
  totalAssets: decimal("total_assets", { precision: 15, scale: 2 }),
  ltcInsuranceHas: mysqlBoolean("ltc_insurance_has").default(false),
  ltcInsuranceDailyBenefit: decimal("ltc_insurance_daily_benefit", { precision: 10, scale: 2 }),
  ltcInsuranceBenefitPeriod: int("ltc_insurance_benefit_period"),
  projectedAnnualCost: decimal("projected_annual_cost", { precision: 15, scale: 2 }),
  projectedDurationYears: decimal("projected_duration_years", { precision: 5, scale: 2 }),
  probabilityOfNeed: decimal("probability_of_need", { precision: 5, scale: 2 }),
  fundingGap: decimal("funding_gap", { precision: 15, scale: 2 }),
  recommendedStrategy: varchar("recommended_strategy", { length: 50 }),
  analysisJson: text("analysis_json"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
});

// ─── Portal Engagement ─────────────────────────────────────────
export const portalEngagement = mysqlTable("portal_engagement", {
  id: int("id").primaryKey().autoincrement(),
  userId: int("user_id").notNull(),
  sessionDate: date("session_date").notNull(),
  loginCount: int("login_count").default(0),
  timeSpentSeconds: int("time_spent_seconds").default(0),
  pagesVisited: int("pages_visited").default(0),
  featuresUsed: text("features_used"),
  goalsChecked: int("goals_checked").default(0),
  actionsCompleted: int("actions_completed").default(0),
  engagementScore: int("engagement_score").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

// ─── Health Scores ─────────────────────────────────────────────
export const healthScores = mysqlTable("health_scores", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  totalScore: int("total_score").notNull().default(0),
  spendScore: int("spend_score").notNull().default(0),
  saveScore: int("save_score").notNull().default(0),
  borrowScore: int("borrow_score").notNull().default(0),
  planScore: int("plan_score").notNull().default(0),
  status: mysqlEnum("status", ["healthy", "coping", "vulnerable"]).notNull().default("coping"),
  insightsJson: text("insights_json"),
  recommendationsJson: text("recommendations_json"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
});

// ─── Business Exit Plans ───────────────────────────────────────
export const businessExitPlans = mysqlTable("business_exit_plans", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  businessName: varchar("business_name", { length: 256 }).notNull(),
  businessType: varchar("business_type", { length: 128 }),
  annualRevenue: float("annual_revenue"),
  annualProfit: float("annual_profit"),
  employeeCount: int("employee_count"),
  ownerDependenceScore: int("owner_dependence_score"), // 0-100
  readinessScore: int("readiness_score"), // 0-100
  preferredExitPath: varchar("preferred_exit_path", { length: 64 }),
  analysisJson: text("analysis_json"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
});

// ─── Constitutional Violations ─────────────────────────────────
export const constitutionalViolations = mysqlTable("constitutional_violations", {
  id: int("id").autoincrement().primaryKey(),
  messageId: int("message_id"),
  principleNumber: int("principle_number").notNull(),
  principleText: text("principle_text"),
  violationDescription: text("violation_description"),
  severity: mysqlEnum("severity", ["low", "medium", "high"]).default("low"),
  originalResponseHash: varchar("original_response_hash", { length: 64 }),
  correctedResponseHash: varchar("corrected_response_hash", { length: 64 }),
  createdAt: timestamp("created_at").defaultNow(),
});

// ─── Workflow Event Chains ─────────────────────────────────────
export const workflowEventChains = mysqlTable("workflow_event_chains", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 256 }).notNull(),
  eventType: varchar("event_type", { length: 128 }).notNull(),
  actionsJson: text("actions_json").notNull(),
  isActive: mysqlBoolean("is_active").default(true),
  createdBy: int("created_by"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
});

export const workflowExecutionLog = mysqlTable("workflow_execution_log", {
  id: int("id").autoincrement().primaryKey(),
  chainId: int("chain_id").notNull(),
  eventSource: varchar("event_source", { length: 256 }),
  triggeredAt: timestamp("triggered_at").defaultNow(),
  actionsExecuted: int("actions_executed").default(0),
  actionsFailed: int("actions_failed").default(0),
  resultJson: text("result_json"),
  status: mysqlEnum("status", ["running", "completed", "failed", "partial"]).default("running"),
});

// ─── Annual Reviews ────────────────────────────────────────────
export const annualReviews = mysqlTable("annual_reviews", {
  id: int("id").autoincrement().primaryKey(),
  clientId: int("client_id").notNull(),
  professionalId: int("professional_id").notNull(),
  phase: mysqlEnum("phase", ["identify", "prepare", "schedule", "conduct", "document", "followup"]).default("identify"),
  dueDate: timestamp("due_date"),
  scheduledDate: timestamp("scheduled_date"),
  completedDate: timestamp("completed_date"),
  prepReportJson: text("prep_report_json"),
  agendaJson: text("agenda_json"),
  meetingSummary: text("meeting_summary"),
  actionItemsJson: text("action_items_json"),
  complianceChecklist: text("compliance_checklist"),
  status: mysqlEnum("status", ["pending", "scheduled", "in_progress", "completed", "overdue"]).default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
});


// ─── Tasks (Practice Management) ──────────────────────────────
export const tasks = mysqlTable("tasks", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  assignedTo: int("assigned_to"),
  clientId: int("client_id"),
  title: varchar("title", { length: 512 }).notNull(),
  description: text("description"),
  priority: mysqlEnum("priority", ["urgent", "high", "medium", "low"]).default("medium"),
  status: mysqlEnum("status", ["pending", "in_progress", "completed", "cancelled", "overdue"]).default("pending"),
  category: mysqlEnum("category", ["client_review", "compliance", "onboarding", "follow_up", "planning", "admin", "meeting_prep", "document", "other"]).default("other"),
  dueDate: timestamp("due_date"),
  completedAt: timestamp("completed_at"),
  recurring: mysqlBoolean("recurring").default(false),
  recurringInterval: mysqlEnum("recurring_interval", ["daily", "weekly", "monthly", "quarterly", "annually"]),
  relatedEntityType: varchar("related_entity_type", { length: 64 }),
  relatedEntityId: int("related_entity_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
});

// ─── Communications Log ───────────────────────────────────────
export const commsLog = mysqlTable("comms_log", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  clientId: int("client_id"),
  templateId: varchar("template_id", { length: 128 }),
  channel: mysqlEnum("channel", ["email", "sms", "letter", "portal_message"]).default("email"),
  category: varchar("category", { length: 64 }),
  subject: varchar("subject", { length: 512 }),
  body: text("body"),
  status: mysqlEnum("status", ["draft", "sent", "scheduled", "failed"]).default("draft"),
  scheduledAt: timestamp("scheduled_at"),
  sentAt: timestamp("sent_at"),
  complianceFlags: json("compliance_flags"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ─── Saved Financial Analyses ─────────────────────────────────
export const savedAnalyses = mysqlTable("saved_analyses", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  clientId: int("client_id"),
  analysisType: mysqlEnum("analysis_type", [
    "tax_projection", "ss_optimization", "hsa_optimization",
    "medicare_navigation", "charitable_giving", "divorce_financial",
    "education_plan", "fee_comparison",
  ]).notNull(),
  title: varchar("title", { length: 256 }),
  inputJson: text("input_json"),
  resultJson: text("result_json"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
});


// ═══════════════════════════════════════════════════════════════════════════
// PART G: AGENTIC EXECUTION TABLES
// ═══════════════════════════════════════════════════════════════════════════

// ─── G8: Licensed Review Gate (immutable compliance gate log) ──────────────
export const gateReviews = mysqlTable("gate_reviews", {
  id: int("id").autoincrement().primaryKey(),
  actionId: varchar("action_id", { length: 255 }).notNull(),
  actionType: varchar("action_type", { length: 100 }).notNull(),
  complianceTier: int("compliance_tier").notNull().default(1),
  classificationRationale: text("classification_rationale"),
  reviewerId: int("reviewer_id"),
  reviewerLicenseNumber: varchar("reviewer_license_number", { length: 100 }),
  reviewerLicenseState: varchar("reviewer_license_state", { length: 10 }),
  reviewerLicenseExpiry: bigint("reviewer_license_expiry", { mode: "number" }),
  decision: mysqlEnum("decision", ["pending", "approved", "modified", "rejected", "escalated"]).default("pending"),
  modificationDetails: text("modification_details"),
  complianceNotes: text("compliance_notes"),
  decisionTimestamp: bigint("decision_timestamp", { mode: "number" }),
  archiveRef: varchar("archive_ref", { length: 255 }),
  workflowType: varchar("workflow_type", { length: 100 }),
  clientId: int("client_id"),
  professionalId: int("professional_id"),
  firmId: int("firm_id"),
  slaDeadline: bigint("sla_deadline", { mode: "number" }),
  escalatedTo: int("escalated_to"),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});
export type GateReview = typeof gateReviews.$inferSelect;

// ─── G1: Agent Instances ───────────────────────────────────────────────────
export const agentInstances = mysqlTable("agent_instances", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  firmId: int("firm_id"),
  workflowType: varchar("workflow_type", { length: 100 }).notNull(),
  deploymentMode: mysqlEnum("deployment_mode", ["local", "cloud", "hybrid"]).default("local"),
  instanceStatus: mysqlEnum("instance_status", ["spawning", "active", "paused", "terminated", "error"]).default("spawning"),
  configJson: json("config_json"),
  budgetLimitUsd: decimal("budget_limit_usd", { precision: 10, scale: 2 }),
  runtimeLimitMinutes: int("runtime_limit_minutes").default(60),
  totalActions: int("total_actions").default(0),
  totalCostUsd: decimal("total_cost_usd", { precision: 10, scale: 2 }).default("0"),
  spawnedAt: bigint("spawned_at", { mode: "number" }).notNull(),
  terminatedAt: bigint("terminated_at", { mode: "number" }),
});
export type AgentInstance = typeof agentInstances.$inferSelect;

// ─── G1: Agent Actions (immutable log) ─────────────────────────────────────
export const agentActions = mysqlTable("agent_actions", {
  id: int("id").autoincrement().primaryKey(),
  agentInstanceId: int("agent_instance_id").notNull(),
  actionType: varchar("action_type", { length: 100 }).notNull(),
  targetSystem: varchar("target_system", { length: 255 }),
  targetUrl: text("target_url"),
  dataAccessedSummary: text("data_accessed_summary"),
  dataModifiedSummary: text("data_modified_summary"),
  screenshotHash: varchar("screenshot_hash", { length: 255 }),
  complianceTier: int("compliance_tier").default(1),
  gateTriggered: mysqlBoolean("gate_triggered").default(false),
  gateResult: varchar("gate_result", { length: 50 }),
  durationMs: int("duration_ms"),
  errorMessage: text("error_message"),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});
export type AgentAction = typeof agentActions.$inferSelect;

// ─── G2: Insurance Quotes ──────────────────────────────────────────────────
export const insuranceQuotes = mysqlTable("insurance_quotes", {
  id: int("id").autoincrement().primaryKey(),
  clientId: int("client_id").notNull(),
  professionalId: int("professional_id"),
  quoteRunId: varchar("quote_run_id", { length: 255 }).notNull(),
  carrierName: varchar("carrier_name", { length: 255 }).notNull(),
  productType: varchar("product_type", { length: 100 }).notNull(),
  productName: varchar("product_name", { length: 255 }),
  premiumMonthly: decimal("premium_monthly", { precision: 12, scale: 2 }),
  premiumAnnual: decimal("premium_annual", { precision: 12, scale: 2 }),
  deathBenefit: decimal("death_benefit", { precision: 15, scale: 2 }),
  cashValueYr10: decimal("cash_value_yr10", { precision: 15, scale: 2 }),
  cashValueYr20: decimal("cash_value_yr20", { precision: 15, scale: 2 }),
  ridersJson: json("riders_json"),
  uwClassEstimated: varchar("uw_class_estimated", { length: 100 }),
  amBestRating: varchar("am_best_rating", { length: 10 }),
  quoteDate: bigint("quote_date", { mode: "number" }).notNull(),
  source: mysqlEnum("source", ["api", "browser", "manual"]).default("manual"),
  status: mysqlEnum("status", ["illustrative", "reviewed", "selected", "expired"]).default("illustrative"),
  comparisonNotes: text("comparison_notes"),
});
export type InsuranceQuote = typeof insuranceQuotes.$inferSelect;

// ─── G3: Insurance Applications ────────────────────────────────────────────
export const insuranceApplications = mysqlTable("insurance_applications", {
  id: int("id").autoincrement().primaryKey(),
  clientId: int("client_id").notNull(),
  professionalId: int("professional_id"),
  carrierName: varchar("carrier_name", { length: 255 }).notNull(),
  productName: varchar("product_name", { length: 255 }),
  applicationDataJson: json("application_data_json"),
  preliminaryUwAssessment: text("preliminary_uw_assessment"),
  compliancePreflightJson: json("compliance_preflight_json"),
  gateStatus: mysqlEnum("gate_status", ["draft", "pending_review", "approved", "submitted", "issued", "declined", "counter_offer"]).default("draft"),
  gateReviewId: int("gate_review_id"),
  reviewerId: int("reviewer_id"),
  reviewerLicense: varchar("reviewer_license", { length: 100 }),
  reviewedAt: bigint("reviewed_at", { mode: "number" }),
  submittedAt: bigint("submitted_at", { mode: "number" }),
  carrierStatus: varchar("carrier_status", { length: 100 }),
  carrierRefNumber: varchar("carrier_ref_number", { length: 255 }),
  pendingRequirementsJson: json("pending_requirements_json"),
  policyNumber: varchar("policy_number", { length: 255 }),
  issuedAt: bigint("issued_at", { mode: "number" }),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
});
export type InsuranceApplication = typeof insuranceApplications.$inferSelect;

// ─── G4: Advisory Executions ───────────────────────────────────────────────
export const advisoryExecutions = mysqlTable("advisory_executions", {
  id: int("id").autoincrement().primaryKey(),
  clientId: int("client_id").notNull(),
  professionalId: int("professional_id").notNull(),
  executionType: mysqlEnum("execution_type", ["account_open", "rebalance", "harvest", "transfer", "trade", "rollover"]).notNull(),
  executionDataJson: json("execution_data_json"),
  taxImpactEstimate: decimal("tax_impact_estimate", { precision: 12, scale: 2 }),
  gateStatus: mysqlEnum("gate_status", ["draft", "pending_review", "approved", "executing", "completed", "failed"]).default("draft"),
  gateReviewId: int("gate_review_id"),
  reviewerId: int("reviewer_id"),
  approvedAt: bigint("approved_at", { mode: "number" }),
  executedAt: bigint("executed_at", { mode: "number" }),
  custodianConfirmation: varchar("custodian_confirmation", { length: 255 }),
  postExecutionAuditJson: json("post_execution_audit_json"),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});
export type AdvisoryExecution = typeof advisoryExecutions.$inferSelect;

// ─── G5: Estate Documents ──────────────────────────────────────────────────
export const estateDocuments = mysqlTable("estate_documents", {
  id: int("id").autoincrement().primaryKey(),
  clientId: int("client_id").notNull(),
  documentType: mysqlEnum("document_type", ["trust", "will", "poa_financial", "poa_healthcare", "directive", "beneficiary_audit"]).notNull(),
  draftVersion: int("draft_version").default(1),
  draftContentUrl: text("draft_content_url"),
  draftContentHash: varchar("draft_content_hash", { length: 255 }),
  complexityLevel: mysqlEnum("complexity_level", ["simple", "standard", "complex"]).default("standard"),
  reviewPath: mysqlEnum("review_path", ["self_help", "attorney_review"]).default("attorney_review"),
  attorneyId: int("attorney_id"),
  attorneyStatus: mysqlEnum("attorney_status", ["pending", "reviewing", "approved", "revision_requested"]).default("pending"),
  stateJurisdiction: varchar("state_jurisdiction", { length: 10 }),
  finalized: mysqlBoolean("finalized").default(false),
  executedDate: bigint("executed_date", { mode: "number" }),
  archiveRef: varchar("archive_ref", { length: 255 }),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
});
export type EstateDocument = typeof estateDocuments.$inferSelect;

// ─── G6: Premium Finance Cases ─────────────────────────────────────────────
export const premiumFinanceCases = mysqlTable("premium_finance_cases", {
  id: int("id").autoincrement().primaryKey(),
  clientId: int("client_id").notNull(),
  professionalId: int("professional_id").notNull(),
  insurancePolicyRef: varchar("insurance_policy_ref", { length: 255 }),
  financedPremiumAnnual: decimal("financed_premium_annual", { precision: 15, scale: 2 }),
  loanAmount: decimal("loan_amount", { precision: 15, scale: 2 }),
  lenderName: varchar("lender_name", { length: 255 }),
  interestRate: decimal("interest_rate", { precision: 5, scale: 3 }),
  termYears: int("term_years"),
  collateralType: varchar("collateral_type", { length: 100 }),
  collateralValue: decimal("collateral_value", { precision: 15, scale: 2 }),
  structureJson: json("structure_json"),
  stressTestJson: json("stress_test_json"),
  gateStatus: mysqlEnum("gate_status", ["modeling", "pending_review", "approved", "applied", "funded", "monitoring", "closed"]).default("modeling"),
  gateReviewId: int("gate_review_id"),
  status: mysqlEnum("status", ["modeling", "applied", "funded", "monitoring", "closed"]).default("modeling"),
  monitoringAlertsJson: json("monitoring_alerts_json"),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
});
export type PremiumFinanceCase = typeof premiumFinanceCases.$inferSelect;

// ─── G7: Carrier Connections ───────────────────────────────────────────────
export const carrierConnections = mysqlTable("carrier_connections", {
  id: int("id").autoincrement().primaryKey(),
  firmId: int("firm_id").notNull(),
  carrierName: varchar("carrier_name", { length: 255 }).notNull(),
  connectionType: mysqlEnum("connection_type", ["api", "browser"]).default("browser"),
  apiEndpoint: varchar("api_endpoint", { length: 500 }),
  credentialsVaultRef: varchar("credentials_vault_ref", { length: 255 }),
  supportedOperationsJson: json("supported_operations_json"),
  stateAppointmentsJson: json("state_appointments_json"),
  lastVerified: bigint("last_verified", { mode: "number" }),
  active: mysqlBoolean("active").default(true),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});
export type CarrierConnection = typeof carrierConnections.$inferSelect;

// ═══════════════════════════════════════════════════════════════════════════
// DATA INGESTION & INTELLIGENCE PIPELINE TABLES
// ═══════════════════════════════════════════════════════════════════════════

// ─── Data Sources Registry ─────────────────────────────────────────────────
export const dataSources = mysqlTable("data_sources", {
  id: int("id").autoincrement().primaryKey(),
  firmId: int("firm_id"),
  name: varchar("name", { length: 255 }).notNull(),
  sourceType: mysqlEnum("source_type", ["document_upload", "web_scrape", "api_feed", "market_data", "regulatory", "product_catalog", "news_feed", "competitor", "custom"]).notNull(),
  url: varchar("url", { length: 1000 }),
  authType: mysqlEnum("auth_type", ["none", "api_key", "oauth", "basic", "bearer"]).default("none"),
  credentialsVaultRef: varchar("credentials_vault_ref", { length: 255 }),
  scheduleCron: varchar("schedule_cron", { length: 100 }),
  priority: int("priority").default(5),
  isActive: mysqlBoolean("is_active").default(true),
  lastRunAt: bigint("last_run_at", { mode: "number" }),
  lastSuccessAt: bigint("last_success_at", { mode: "number" }),
  totalRecordsIngested: int("total_records_ingested").default(0),
  configJson: json("config_json"),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
});
export type DataSource = typeof dataSources.$inferSelect;

// ─── Ingestion Jobs ────────────────────────────────────────────────────────
export const ingestionJobs = mysqlTable("ingestion_jobs", {
  id: int("id").autoincrement().primaryKey(),
  dataSourceId: int("data_source_id").notNull(),
  triggeredBy: int("triggered_by"),
  status: mysqlEnum("status", ["queued", "running", "completed", "failed", "cancelled"]).default("queued"),
  progressPct: int("progress_pct").default(0),
  recordsProcessed: int("records_processed").default(0),
  recordsCreated: int("records_created").default(0),
  recordsUpdated: int("records_updated").default(0),
  recordsSkipped: int("records_skipped").default(0),
  recordsErrored: int("records_errored").default(0),
  errorLog: text("error_log"),
  startedAt: bigint("started_at", { mode: "number" }),
  completedAt: bigint("completed_at", { mode: "number" }),
  durationMs: int("duration_ms"),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});
export type IngestionJob = typeof ingestionJobs.$inferSelect;

// ─── Ingested Records (normalized) ─────────────────────────────────────────
export const ingestedRecords = mysqlTable("ingested_records", {
  id: int("id").autoincrement().primaryKey(),
  dataSourceId: int("data_source_id").notNull(),
  ingestionJobId: int("ingestion_job_id"),
  recordType: mysqlEnum("record_type", ["customer_profile", "organization", "product", "market_price", "regulatory_update", "news_article", "competitor_intel", "document_extract", "entity", "metric"]).notNull(),
  entityId: varchar("entity_id", { length: 255 }),
  title: varchar("title", { length: 500 }),
  contentSummary: text("content_summary"),
  structuredData: json("structured_data"),
  rawDataUrl: text("raw_data_url"),
  confidenceScore: decimal("confidence_score", { precision: 3, scale: 2 }).default("0.80"),
  freshnessAt: bigint("freshness_at", { mode: "number" }),
  tags: json("tags"),
  isVerified: mysqlBoolean("is_verified").default(false),
  verifiedBy: int("verified_by"),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
});
export type IngestedRecord = typeof ingestedRecords.$inferSelect;

// ─── Market Data Cache (time-series) ───────────────────────────────────────
export const marketDataCache = mysqlTable("market_data_cache", {
  id: int("id").autoincrement().primaryKey(),
  symbol: varchar("symbol", { length: 50 }).notNull(),
  dataType: mysqlEnum("data_type", ["price", "fx_rate", "interest_rate", "index", "economic_indicator", "commodity"]).notNull(),
  value: decimal("value", { precision: 18, scale: 6 }).notNull(),
  currency: varchar("currency", { length: 10 }).default("USD"),
  source: varchar("source", { length: 100 }),
  observedAt: bigint("observed_at", { mode: "number" }).notNull(),
  metadataJson: json("metadata_json"),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});
export type MarketDataCacheRow = typeof marketDataCache.$inferSelect;

// ─── Web Scrape Results ────────────────────────────────────────────────────
export const webScrapeResults = mysqlTable("web_scrape_results", {
  id: int("id").autoincrement().primaryKey(),
  dataSourceId: int("data_source_id"),
  ingestionJobId: int("ingestion_job_id"),
  url: varchar("url", { length: 2000 }).notNull(),
  pageTitle: varchar("page_title", { length: 500 }),
  contentText: text("content_text"),
  extractedEntities: json("extracted_entities"),
  extractedMetrics: json("extracted_metrics"),
  scrapeStatus: mysqlEnum("scrape_status", ["success", "partial", "failed"]).default("success"),
  httpStatus: int("http_status"),
  contentHash: varchar("content_hash", { length: 64 }),
  scrapedAt: bigint("scraped_at", { mode: "number" }).notNull(),
});
export type WebScrapeResult = typeof webScrapeResults.$inferSelect;

// ─── Document Extractions ──────────────────────────────────────────────────
export const documentExtractions = mysqlTable("document_extractions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id"),
  documentId: int("document_id"),
  ingestionJobId: int("ingestion_job_id"),
  extractionType: mysqlEnum("extraction_type", ["financial_statement", "tax_return", "insurance_policy", "investment_statement", "bank_statement", "pay_stub", "estate_document", "medical_record", "custom"]).notNull(),
  extractedData: json("extracted_data").notNull(),
  extractedEntities: json("extracted_entities"),
  extractedAmounts: json("extracted_amounts"),
  extractionConfidence: decimal("extraction_confidence", { precision: 3, scale: 2 }).default("0.80"),
  pageCount: int("page_count"),
  processingTimeMs: int("processing_time_ms"),
  llmModelUsed: varchar("llm_model_used", { length: 100 }),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});
export type DocumentExtraction = typeof documentExtractions.$inferSelect;


// ─── Scrape Schedules ─────────────────────────────────────────────────────
export const scrapeSchedules = mysqlTable("scrape_schedules", {
  id: int("id").autoincrement().primaryKey(),
  dataSourceId: int("data_source_id").notNull(),
  cronExpression: varchar("cron_expression", { length: 100 }).notNull(),
  nextRunAt: bigint("next_run_at", { mode: "number" }),
  lastRunAt: bigint("last_run_at", { mode: "number" }),
  enabled: mysqlBoolean("enabled").default(true),
  retryOnFailure: mysqlBoolean("retry_on_failure").default(true),
  maxRetries: int("max_retries").default(3),
  notifyOnFailure: mysqlBoolean("notify_on_failure").default(true),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});
export type ScrapeSchedule = typeof scrapeSchedules.$inferSelect;

// ─── Data Quality Scores ──────────────────────────────────────────────────
export const dataQualityScores = mysqlTable("data_quality_scores", {
  id: int("id").autoincrement().primaryKey(),
  dataSourceId: int("data_source_id").notNull(),
  ingestionJobId: int("ingestion_job_id"),
  completeness: decimal("completeness", { precision: 5, scale: 2 }).default("0.00"),
  accuracy: decimal("accuracy", { precision: 5, scale: 2 }).default("0.00"),
  freshness: decimal("freshness", { precision: 5, scale: 2 }).default("0.00"),
  consistency: decimal("consistency", { precision: 5, scale: 2 }).default("0.00"),
  overallScore: decimal("overall_score", { precision: 5, scale: 2 }).default("0.00"),
  issuesFound: json("issues_found"),
  recommendations: json("recommendations"),
  scoredAt: bigint("scored_at", { mode: "number" }).notNull(),
});
export type DataQualityScore = typeof dataQualityScores.$inferSelect;

// ─── Ingestion Insights (AI-generated) ────────────────────────────────────
export const ingestionInsights = mysqlTable("ingestion_insights", {
  id: int("id").autoincrement().primaryKey(),
  insightType: mysqlEnum("insight_type", ["trend", "anomaly", "opportunity", "risk", "recommendation", "competitive_intel", "market_shift", "regulatory_change"]).notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description").notNull(),
  severity: mysqlEnum("severity", ["low", "medium", "high", "critical"]).default("medium"),
  dataSourceIds: json("data_source_ids"),
  relatedEntityIds: json("related_entity_ids"),
  actionable: mysqlBoolean("actionable").default(true),
  acknowledged: mysqlBoolean("acknowledged").default(false),
  acknowledgedBy: int("acknowledged_by"),
  expiresAt: bigint("expires_at", { mode: "number" }),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});
export type IngestionInsight = typeof ingestionInsights.$inferSelect;

// ─── Bulk Import Batches ──────────────────────────────────────────────────
export const bulkImportBatches = mysqlTable("bulk_import_batches", {
  id: int("id").autoincrement().primaryKey(),
  batchName: varchar("batch_name", { length: 255 }).notNull(),
  importType: mysqlEnum("import_type", ["csv_upload", "api_bulk", "multi_url_scrape", "rss_feed", "sitemap_crawl"]).notNull(),
  totalItems: int("total_items").default(0),
  processedItems: int("processed_items").default(0),
  successItems: int("success_items").default(0),
  failedItems: int("failed_items").default(0),
  status: mysqlEnum("status", ["pending", "processing", "completed", "failed", "cancelled"]).default("pending"),
  inputData: json("input_data"),
  resultsJson: json("results_json"),
  triggeredBy: int("triggered_by"),
  startedAt: bigint("started_at", { mode: "number" }),
  completedAt: bigint("completed_at", { mode: "number" }),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});
export type BulkImportBatch = typeof bulkImportBatches.$inferSelect;
