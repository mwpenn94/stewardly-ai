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
  // Auth enrichment columns
  authProvider: varchar("auth_provider", { length: 20 }).default("manus"),
  linkedinId: varchar("linkedin_id", { length: 100 }),
  googleId: varchar("google_id", { length: 100 }),
  linkedinProfileUrl: varchar("linkedin_profile_url", { length: 500 }),
  linkedinHeadline: varchar("linkedin_headline", { length: 300 }),
  linkedinIndustry: varchar("linkedin_industry", { length: 100 }),
  linkedinLocation: varchar("linkedin_location", { length: 200 }),
  googlePhone: varchar("google_phone", { length: 50 }),
  googleBirthday: timestamp("google_birthday"),
  googleGender: varchar("google_gender", { length: 20 }),
  googleAddressJson: json("google_address_json"),
  googleOrganizationsJson: json("google_organizations_json"),
  employerName: varchar("employer_name", { length: 200 }),
  jobTitle: varchar("job_title", { length: 200 }),
  profileEnrichedAt: timestamp("profile_enriched_at"),
  profileEnrichmentSource: varchar("profile_enrichment_source", { length: 50 }),
  signInDataJson: json("sign_in_data_json"),
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
  defaultTtsVoice: varchar("defaultTtsVoice", { length: 64 }),
  defaultSpeechRate: float("defaultSpeechRate"),
  defaultAutoPlayVoice: mysqlBoolean("defaultAutoPlayVoice"),
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
  defaultTtsVoice: varchar("defaultTtsVoice", { length: 64 }),
  defaultSpeechRate: float("defaultSpeechRate"),
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
  defaultTtsVoice: varchar("defaultTtsVoice", { length: 64 }),
  defaultSpeechRate: float("defaultSpeechRate"),
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
  defaultTtsVoice: varchar("defaultTtsVoice", { length: 64 }),
  defaultSpeechRate: float("defaultSpeechRate"),
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
  discoveryDirection: mysqlEnum("discoveryDirection", ["deeper", "broader", "applied", "auto"]).default("auto"),
  discoveryIdleThresholdMs: int("discoveryIdleThresholdMs").default(120000),
  discoveryContinuous: mysqlBoolean("discoveryContinuous").default(false),
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
// ─── CONVERSATION FOLDERS ──────────────────────────────────────────────────
export const conversationFolders = mysqlTable("conversation_folders", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 128 }).notNull(),
  color: varchar("color", { length: 32 }).default("#6366f1"),
  sortOrder: int("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type ConversationFolder = typeof conversationFolders.$inferSelect;

export const conversations = mysqlTable("conversations", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  title: varchar("title", { length: 255 }).default("New Conversation"),
  mode: mysqlEnum("mode", ["client", "coach", "manager"]).default("client").notNull(),
  pinned: mysqlBoolean("pinned").default(false).notNull(),
  folderId: int("folderId"),
  sortOrder: int("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  organizationId: int("organizationId"),
});
export type Conversation = typeof conversations.$inferSelect;;

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
  sortOrder: int("sortOrder").default(0).notNull(),
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

// ─── DOCUMENT VERSIONS (version history for re-uploads) ──────────────────────
export const documentVersions = mysqlTable("document_versions", {
  id: int("id").autoincrement().primaryKey(),
  documentId: int("documentId").notNull(),
  userId: int("userId").notNull(),
  versionNumber: int("versionNumber").notNull(),
  filename: varchar("filename", { length: 512 }).notNull(),
  fileUrl: text("fileUrl").notNull(),
  fileKey: text("fileKey").notNull(),
  mimeType: varchar("mimeType", { length: 128 }),
  extractedText: text("extractedText"),
  chunkCount: int("chunkCount").default(0),
  sizeBytes: int("sizeBytes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type DocumentVersion = typeof documentVersions.$inferSelect;

// ─── DOCUMENT ANNOTATIONS (collaborative) ──────────────────────────────────
export const documentAnnotations = mysqlTable("document_annotations", {
  id: int("id").autoincrement().primaryKey(),
  documentId: int("documentId").notNull(),
  userId: int("userId").notNull(),
  content: text("content").notNull(),
  highlightText: text("highlightText"),
  highlightStart: int("highlightStart"),
  highlightEnd: int("highlightEnd"),
  annotationType: mysqlEnum("annotationType", ["comment", "highlight", "question", "action_item", "ai_insight"]).default("comment").notNull(),
  parentId: int("parentId"),
  resolved: mysqlBoolean("resolved").default(false),
  resolvedBy: int("resolvedBy"),
  resolvedAt: timestamp("resolvedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type DocumentAnnotation = typeof documentAnnotations.$inferSelect;

// ─── DOCUMENT TAGS (AI-generated + user-editable) ─────────────────────────
export const documentTags = mysqlTable("document_tags", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 128 }).notNull(),
  color: varchar("color", { length: 32 }).default("#6366f1"),
  isAiGenerated: mysqlBoolean("isAiGenerated").default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type DocumentTag = typeof documentTags.$inferSelect;

export const documentTagMap = mysqlTable("document_tag_map", {
  id: int("id").autoincrement().primaryKey(),
  documentId: int("documentId").notNull(),
  tagId: int("tagId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type DocumentTagMap = typeof documentTagMap.$inferSelect;

// ─── KNOWLEDGE GAP FEEDBACK ────────────────────────────────────────────────
export const knowledgeGapFeedback = mysqlTable("knowledge_gap_feedback", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  gapId: varchar("gapId", { length: 128 }).notNull(),
  gapTitle: varchar("gapTitle", { length: 512 }).notNull(),
  gapCategory: varchar("gapCategory", { length: 128 }),
  action: mysqlEnum("action", ["dismiss", "acknowledge", "resolved", "not_applicable"]).notNull(),
  userNote: text("userNote"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type KnowledgeGapFeedback = typeof knowledgeGapFeedback.$inferSelect;

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
  // Tamper-evident hash chain: each entry includes hash of previous entry
  entryHash: varchar("entryHash", { length: 64 }),
  previousHash: varchar("previousHash", { length: 64 }),
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

// ─── Insight Actions (Insight-to-Action Workflow) ─────────────────────────
export const insightActions = mysqlTable("insight_actions", {
  id: int("id").autoincrement().primaryKey(),
  insightId: int("insight_id").notNull(),
  actionType: mysqlEnum("action_type", ["task_created", "notification_sent", "alert_escalated", "review_scheduled", "auto_dismissed"]).notNull(),
  actionPayload: json("action_payload"),
  assignedTo: int("assigned_to"),
  status: mysqlEnum("status", ["pending", "in_progress", "completed", "dismissed"]).default("pending"),
  priority: mysqlEnum("priority", ["low", "medium", "high", "urgent"]).default("medium"),
  dueAt: bigint("due_at", { mode: "number" }),
  completedAt: bigint("completed_at", { mode: "number" }),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});
export type InsightAction = typeof insightActions.$inferSelect;

// ─── Search Cache ──────────────────────────────────────────────────────────
export const searchCache = mysqlTable("search_cache", {
  id: int("id").autoincrement().primaryKey(),
  queryHash: varchar("query_hash", { length: 64 }).notNull(),
  queryText: text("query_text").notNull(),
  category: varchar("category", { length: 50 }),
  resultJson: json("result_json"),
  sourceCitations: json("source_citations"),
  hitCount: int("hit_count").default(1),
  expiresAt: bigint("expires_at", { mode: "number" }).notNull(),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});
export type SearchCache = typeof searchCache.$inferSelect;


// ─── Email Campaigns ──────────────────────────────────────────────────────
export const emailCampaigns = mysqlTable("email_campaigns", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  subject: varchar("subject", { length: 500 }).notNull(),
  bodyHtml: text("body_html").notNull(),
  bodyText: text("body_text"),
  templateId: varchar("template_id", { length: 100 }),
  status: mysqlEnum("status", ["draft", "scheduled", "sending", "sent", "paused", "cancelled"]).default("draft"),
  recipientFilter: json("recipient_filter"),
  totalRecipients: int("total_recipients").default(0),
  sentCount: int("sent_count").default(0),
  openCount: int("open_count").default(0),
  clickCount: int("click_count").default(0),
  bounceCount: int("bounce_count").default(0),
  scheduledAt: bigint("scheduled_at", { mode: "number" }),
  sentAt: bigint("sent_at", { mode: "number" }),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
});
export type EmailCampaign = typeof emailCampaigns.$inferSelect;

export const emailSends = mysqlTable("email_sends", {
  id: int("id").autoincrement().primaryKey(),
  campaignId: int("campaign_id").notNull(),
  recipientEmail: varchar("recipient_email", { length: 320 }).notNull(),
  recipientName: varchar("recipient_name", { length: 255 }),
  status: mysqlEnum("status", ["pending", "sent", "delivered", "opened", "clicked", "bounced", "failed"]).default("pending"),
  sentAt: bigint("sent_at", { mode: "number" }),
  openedAt: bigint("opened_at", { mode: "number" }),
  clickedAt: bigint("clicked_at", { mode: "number" }),
  errorMessage: text("error_message"),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});
export type EmailSend = typeof emailSends.$inferSelect;


// ═══════════════════════════════════════════════════════════════════════════
// PER-SOURCE CONSENT TRACKING (1F)
// ═══════════════════════════════════════════════════════════════════════════

export const userConsents = mysqlTable("user_consents", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  consentType: mysqlEnum("consent_type", ["ai_chat", "voice_input", "document_upload", "data_sharing", "marketing", "analytics"]).notNull(),
  granted: mysqlBoolean("granted").default(false).notNull(),
  grantedAt: bigint("granted_at", { mode: "number" }),
  revokedAt: bigint("revoked_at", { mode: "number" }),
  version: varchar("version", { length: 20 }).default("1.0").notNull(),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
});
export type UserConsent = typeof userConsents.$inferSelect;

// ═══════════════════════════════════════════════════════════════════════════
// FAIRNESS TESTING HARNESS (2D)
// ═══════════════════════════════════════════════════════════════════════════

export const fairnessTestPrompts = mysqlTable("fairness_test_prompts", {
  id: int("id").autoincrement().primaryKey(),
  demographic: varchar("demographic", { length: 128 }).notNull(),
  category: varchar("category", { length: 64 }).notNull(),
  promptText: text("prompt_text").notNull(),
  expectedBehavior: text("expected_behavior"),
  isActive: mysqlBoolean("is_active").default(true).notNull(),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});
export type FairnessTestPrompt = typeof fairnessTestPrompts.$inferSelect;

export const fairnessTestRuns = mysqlTable("fairness_test_runs", {
  id: int("id").autoincrement().primaryKey(),
  runBy: int("run_by").notNull(),
  status: mysqlEnum("status", ["pending", "running", "completed", "failed"]).default("pending").notNull(),
  totalPrompts: int("total_prompts").default(0),
  completedPrompts: int("completed_prompts").default(0),
  overallScore: float("overall_score"),
  biasDetected: mysqlBoolean("bias_detected").default(false),
  summary: json("summary"),
  findings: json("findings"),
  recommendations: json("recommendations"),
  startedAt: bigint("started_at", { mode: "number" }),
  completedAt: bigint("completed_at", { mode: "number" }),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});
export type FairnessTestRun = typeof fairnessTestRuns.$inferSelect;

export const fairnessTestResults = mysqlTable("fairness_test_results", {
  id: int("id").autoincrement().primaryKey(),
  runId: int("run_id").notNull(),
  promptId: int("prompt_id").notNull(),
  response: text("response"),
  toneScore: float("tone_score"),
  qualityScore: float("quality_score"),
  biasIndicators: json("bias_indicators"),
  disclaimerPresent: mysqlBoolean("disclaimer_present").default(false),
  responseTimeMs: int("response_time_ms"),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});
export type FairnessTestResult = typeof fairnessTestResults.$inferSelect;

// ═══════════════════════════════════════════════════════════════════════════
// PROFESSIONAL REFERRAL DIRECTORY
// ═══════════════════════════════════════════════════════════════════════════

export const professionals = mysqlTable("professionals", {
  id: int("id").autoincrement().primaryKey(),
  // If this professional is also a platform user, link them
  linkedUserId: int("linked_user_id"),
  name: varchar("name", { length: 256 }).notNull(),
  title: varchar("title", { length: 256 }),
  firm: varchar("firm", { length: 256 }),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 32 }),
  website: varchar("website", { length: 512 }),
  location: varchar("location", { length: 256 }),
  state: varchar("state", { length: 64 }),
  bio: text("bio"),
  avatarUrl: text("avatar_url"),
  // Credentials & qualifications
  credentials: json("credentials"), // ["CFP", "CFA", "ChFC", "CLU", "RICP"]
  licenses: json("licenses"), // ["Series 7", "Series 66", "Life & Health"]
  specializations: json("specializations"), // ["retirement", "estate", "insurance", "tax", "investment"]
  // Tier classification
  tier: mysqlEnum("tier", ["tier1_existing", "tier2_org_affiliated", "tier3_specialty", "tier4_location", "tier5_general"]).default("tier5_general").notNull(),
  // Verification & trust
  verified: mysqlBoolean("verified").default(false).notNull(),
  verifiedAt: bigint("verified_at", { mode: "number" }),
  source: mysqlEnum("source", ["manual", "directory_import", "org_roster", "self_registered", "referral"]).default("manual").notNull(),
  // Ratings
  avgRating: float("avg_rating").default(0),
  reviewCount: int("review_count").default(0),
  // Metadata
  yearsExperience: int("years_experience"),
  aumRange: varchar("aum_range", { length: 64 }),
  feeStructure: varchar("fee_structure", { length: 128 }),
  minimumInvestment: varchar("minimum_investment", { length: 64 }),
  servicesOffered: json("services_offered"),
  languagesSpoken: json("languages_spoken"),
  // Status
  status: mysqlEnum("status", ["active", "inactive", "pending_verification", "suspended"]).default("active").notNull(),
  createdBy: int("created_by"),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
});
export type Professional = typeof professionals.$inferSelect;
export type InsertProfessional = typeof professionals.$inferInsert;

export const professionalRelationships = mysqlTable("professional_relationships", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  professionalId: int("professional_id").notNull(),
  relationshipType: mysqlEnum("relationship_type", [
    "financial_advisor", "insurance_agent", "tax_professional", "estate_attorney",
    "accountant", "mortgage_broker", "real_estate_agent", "other"
  ]).notNull(),
  status: mysqlEnum("status", ["active", "inactive", "pending", "ended"]).default("active").notNull(),
  startedAt: bigint("started_at", { mode: "number" }),
  endedAt: bigint("ended_at", { mode: "number" }),
  notes: text("notes"),
  lastContactAt: bigint("last_contact_at", { mode: "number" }),
  referralSource: varchar("referral_source", { length: 128 }),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
});
export type ProfessionalRelationship = typeof professionalRelationships.$inferSelect;

export const professionalReviews = mysqlTable("professional_reviews", {
  id: int("id").autoincrement().primaryKey(),
  professionalId: int("professional_id").notNull(),
  userId: int("user_id").notNull(),
  rating: int("rating").notNull(), // 1-5
  title: varchar("title", { length: 256 }),
  review: text("review"),
  isAnonymous: mysqlBoolean("is_anonymous").default(false),
  status: mysqlEnum("status", ["published", "pending", "flagged", "removed"]).default("pending").notNull(),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
});
export type ProfessionalReview = typeof professionalReviews.$inferSelect;

// ═══════════════════════════════════════════════════════════════════════════
// 5-LAYER AI IMPROVEMENT ENGINE
// ═══════════════════════════════════════════════════════════════════════════

export const layerAudits = mysqlTable("layer_audits", {
  id: int("id").autoincrement().primaryKey(),
  layer: mysqlEnum("layer", ["platform", "organization", "manager", "professional", "user"]).notNull(),
  auditType: mysqlEnum("audit_type", [
    "scheduled", "manual", "triggered", "continuous"
  ]).default("scheduled").notNull(),
  auditDirection: varchar("audit_direction", { length: 30 }).default("system_infrastructure").notNull(),
  targetId: int("target_id"), // org/manager/professional/user ID depending on layer
  status: mysqlEnum("status", ["pending", "running", "completed", "failed"]).default("pending").notNull(),
  // Findings
  findings: json("findings"), // Array of { category, severity, description, evidence, metric }
  overallHealthScore: float("overall_health_score"), // 0-100
  metricsSnapshot: json("metrics_snapshot"), // Key metrics at time of audit
  // AI Analysis
  aiAnalysis: text("ai_analysis"), // LLM-generated analysis
  recommendations: json("recommendations"), // Array of { priority, description, layer, autoImplementable, estimatedImpact }
  // Timing
  runBy: int("run_by"),
  startedAt: bigint("started_at", { mode: "number" }),
  completedAt: bigint("completed_at", { mode: "number" }),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});
export type LayerAudit = typeof layerAudits.$inferSelect;

export const improvementActions = mysqlTable("improvement_actions", {
  id: int("id").autoincrement().primaryKey(),
  auditId: int("audit_id").notNull(),
  layer: mysqlEnum("layer", ["platform", "organization", "manager", "professional", "user"]).notNull(),
  direction: varchar("direction", { length: 30 }).default("system_infrastructure").notNull(),
  actionType: mysqlEnum("action_type", [
    "auto_implement", "recommend", "escalate", "monitor"
  ]).notNull(),
  category: varchar("category", { length: 128 }).notNull(),
  title: varchar("title", { length: 256 }).notNull(),
  description: text("description").notNull(),
  // Implementation details
  implementationPlan: text("implementation_plan"),
  configChanges: json("config_changes"), // What settings/config to change
  beforeState: json("before_state"),
  afterState: json("after_state"),
  // Status tracking
  status: mysqlEnum("status", [
    "proposed", "approved", "implementing", "implemented", "rejected", "failed", "rolled_back"
  ]).default("proposed").notNull(),
  priority: mysqlEnum("priority", ["low", "medium", "high", "critical"]).default("medium").notNull(),
  estimatedImpact: varchar("estimated_impact", { length: 256 }),
  actualImpact: text("actual_impact"),
  // Approval
  approvedBy: int("approved_by"),
  approvedAt: bigint("approved_at", { mode: "number" }),
  rejectedBy: int("rejected_by"),
  rejectedAt: bigint("rejected_at", { mode: "number" }),
  rejectionReason: text("rejection_reason"),
  // Implementation
  implementedAt: bigint("implemented_at", { mode: "number" }),
  implementedBy: varchar("implemented_by", { length: 64 }), // "ai_engine" or user ID
  rolledBackAt: bigint("rolled_back_at", { mode: "number" }),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
});
export type ImprovementAction = typeof improvementActions.$inferSelect;

export const layerMetrics = mysqlTable("layer_metrics", {
  id: int("id").autoincrement().primaryKey(),
  layer: mysqlEnum("layer", ["platform", "organization", "manager", "professional", "user"]).notNull(),
  targetId: int("target_id"), // specific entity ID within the layer
  metricName: varchar("metric_name", { length: 128 }).notNull(),
  metricValue: float("metric_value").notNull(),
  metricUnit: varchar("metric_unit", { length: 32 }),
  context: json("context"), // Additional context for the metric
  period: varchar("period", { length: 32 }), // "hourly", "daily", "weekly", "monthly"
  recordedAt: bigint("recorded_at", { mode: "number" }).notNull(),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});
export type LayerMetric = typeof layerMetrics.$inferSelect;

export const improvementFeedback = mysqlTable("improvement_feedback", {
  id: int("id").autoincrement().primaryKey(),
  actionId: int("action_id").notNull(),
  userId: int("user_id").notNull(),
  rating: int("rating").notNull(), // 1-5
  helpful: mysqlBoolean("helpful").default(true),
  notes: text("notes"),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});
export type ImprovementFeedback = typeof improvementFeedback.$inferSelect;

// ─── USER INSIGHTS CACHE ────────────────────────────────────────
// Stores pre-computed contextual insights per user per direction/layer.
// Used to inject real data into system prompts for audit-direction chat prompts.
export const userInsightsCache = mysqlTable("user_insights_cache", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  insightType: mysqlEnum("insight_type", [
    "people_performance", "system_infrastructure", "usage_optimization"
  ]).notNull(),
  layer: mysqlEnum("layer", ["platform", "organization", "manager", "professional", "user"]).notNull(),
  data: json("data").notNull(), // Structured insight data (metrics, recommendations, gaps)
  summary: text("summary").notNull(), // Human-readable summary for prompt injection
  computedAt: bigint("computed_at", { mode: "number" }).notNull(),
  expiresAt: bigint("expires_at", { mode: "number" }).notNull(),
});
export type UserInsightCache = typeof userInsightsCache.$inferSelect;

// ─── KNOWLEDGE BASE SHARING PERMISSIONS ─────────────────────────────────
// Granular topic-scoped sharing controls for client data.
// Clients control which professionals/orgs can see which categories of their data.
// Defaults are set per relationship type (e.g., insurance agent sees insurance data).
export const kbSharingPermissions = mysqlTable("kb_sharing_permissions", {
  id: int("id").autoincrement().primaryKey(),
  ownerId: int("owner_id").notNull(), // The client who owns the data
  granteeId: int("grantee_id").notNull(), // The professional/user who receives access
  granteeType: mysqlEnum("grantee_type", ["professional", "manager", "organization", "admin"]).notNull(),
  // Topic categories that map to data domains
  topic: mysqlEnum("topic", [
    "insurance", "investments", "tax", "estate", "retirement",
    "debt", "budgeting", "real_estate", "business", "education",
    "health_finance", "general", "all"
  ]).notNull(),
  // What level of access
  accessLevel: mysqlEnum("access_level", [
    "none",       // Explicitly blocked
    "summary",    // Can see aggregated/anonymized summaries only
    "read",       // Can read full data
    "contribute", // Can read + add context/notes
    "full"        // Can read + contribute + manage (for admins)
  ]).default("read").notNull(),
  // Whether this was auto-set by defaults or manually configured
  source: mysqlEnum("source", ["default", "user_set", "professional_request", "admin_override"]).default("default").notNull(),
  isActive: mysqlBoolean("is_active").default(true).notNull(),
  grantedAt: bigint("granted_at", { mode: "number" }).notNull(),
  revokedAt: bigint("revoked_at", { mode: "number" }),
  expiresAt: bigint("expires_at", { mode: "number" }), // Optional expiry
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
});
export type KbSharingPermission = typeof kbSharingPermissions.$inferSelect;

// ─── SHARING DEFAULTS (per relationship type) ───────────────────────────
// Defines what topics are shared by default when a client connects with a professional.
// Users can adjust from these defaults easily.
export const kbSharingDefaults = mysqlTable("kb_sharing_defaults", {
  id: int("id").autoincrement().primaryKey(),
  relationshipType: mysqlEnum("relationship_type", [
    "financial_advisor", "insurance_agent", "tax_professional", "estate_attorney",
    "accountant", "mortgage_broker", "real_estate_agent", "other"
  ]).notNull(),
  topic: mysqlEnum("topic", [
    "insurance", "investments", "tax", "estate", "retirement",
    "debt", "budgeting", "real_estate", "business", "education",
    "health_finance", "general", "all"
  ]).notNull(),
  defaultAccessLevel: mysqlEnum("default_access_level", [
    "none", "summary", "read", "contribute", "full"
  ]).default("read").notNull(),
  rationale: text("rationale"), // Why this default makes sense
});
export type KbSharingDefault = typeof kbSharingDefaults.$inferSelect;

// ─── ACCESS TRANSITION LOG ──────────────────────────────────────────────
// Tracks when access transitions from one professional to another.
// When a client changes providers, access moves from old to new.
export const kbAccessTransitions = mysqlTable("kb_access_transitions", {
  id: int("id").autoincrement().primaryKey(),
  ownerId: int("owner_id").notNull(),
  fromGranteeId: int("from_grantee_id").notNull(),
  toGranteeId: int("to_grantee_id").notNull(),
  topic: mysqlEnum("topic", [
    "insurance", "investments", "tax", "estate", "retirement",
    "debt", "budgeting", "real_estate", "business", "education",
    "health_finance", "general", "all"
  ]).notNull(),
  previousAccessLevel: varchar("previous_access_level", { length: 32 }).notNull(),
  newAccessLevel: varchar("new_access_level", { length: 32 }).notNull(),
  reason: mysqlEnum("reason", ["client_switched", "professional_left", "org_change", "manual", "expired"]).notNull(),
  transitionedAt: bigint("transitioned_at", { mode: "number" }).notNull(),
  transitionedBy: int("transitioned_by").notNull(), // Who initiated (client or admin)
});
export type KbAccessTransition = typeof kbAccessTransitions.$inferSelect;


// ═══════════════════════════════════════════════════════════════════════════
// INTEGRATION INFRASTRUCTURE TABLES
// ═══════════════════════════════════════════════════════════════════════════

// ─── INTEGRATION PROVIDERS (Registry of all available providers) ──────────
export const integrationProviders = mysqlTable("integration_providers", {
  id: varchar("id", { length: 36 }).primaryKey(),
  slug: varchar("slug", { length: 50 }).notNull().unique(),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  category: mysqlEnum("category", [
    "crm", "messaging", "carrier", "investments", "insurance",
    "demographics", "economic", "enrichment", "regulatory", "property", "middleware"
  ]).notNull(),
  ownershipTier: mysqlEnum("ownership_tier", ["platform", "organization", "professional", "client"]).notNull(),
  authMethod: mysqlEnum("auth_method", [
    "oauth2", "api_key", "bearer_token", "hmac_webhook", "manual_upload", "none"
  ]).notNull(),
  baseUrl: varchar("base_url", { length: 500 }),
  docsUrl: varchar("docs_url", { length: 500 }),
  signupUrl: varchar("signup_url", { length: 500 }),
  freeTierDescription: text("free_tier_description"),
  freeTierLimit: varchar("free_tier_limit", { length: 200 }),
  logoUrl: varchar("logo_url", { length: 500 }),
  isActive: mysqlBoolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type IntegrationProvider = typeof integrationProviders.$inferSelect;

// ─── INTEGRATION CONNECTIONS (Configured connections per owner) ───────────
export const integrationConnections = mysqlTable("integration_connections", {
  id: varchar("id", { length: 36 }).primaryKey(),
  providerId: varchar("provider_id", { length: 36 }).notNull(),
  ownershipTier: mysqlEnum("ownership_tier", ["platform", "organization", "professional", "client"]).notNull(),
  ownerId: varchar("owner_id", { length: 36 }).notNull(),
  organizationId: int("organization_id"),
  userId: int("user_id"),
  status: mysqlEnum("status", ["connected", "disconnected", "error", "pending", "expired"]).default("pending"),
  credentialsEncrypted: text("credentials_encrypted"),
  configJson: json("config_json"),
  lastSyncAt: timestamp("last_sync_at"),
  lastSyncStatus: mysqlEnum("last_sync_status", ["success", "partial", "failed"]),
  lastSyncError: text("last_sync_error"),
  recordsSynced: int("records_synced").default(0),
  usageThisPeriod: int("usage_this_period").default(0),
  usagePeriodStart: timestamp("usage_period_start"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type IntegrationConnection = typeof integrationConnections.$inferSelect;

// ─── INTEGRATION SYNC LOGS (Audit trail of sync operations) ──────────────
export const integrationSyncLogs = mysqlTable("integration_sync_logs", {
  id: varchar("id", { length: 36 }).primaryKey(),
  connectionId: varchar("connection_id", { length: 36 }).notNull(),
  syncType: mysqlEnum("sync_type", ["full", "incremental", "webhook", "manual_upload", "on_demand"]).notNull(),
  direction: mysqlEnum("direction", ["inbound", "outbound", "bidirectional"]).notNull(),
  startedAt: timestamp("started_at").notNull(),
  completedAt: timestamp("completed_at"),
  status: mysqlEnum("status", ["running", "success", "partial", "failed", "cancelled"]).notNull(),
  recordsCreated: int("records_created").default(0),
  recordsUpdated: int("records_updated").default(0),
  recordsFailed: int("records_failed").default(0),
  errorDetails: json("error_details"),
  triggeredBy: mysqlEnum("triggered_by", ["schedule", "webhook", "manual", "system"]).notNull(),
  triggeredByUserId: int("triggered_by_user_id"),
});
export type IntegrationSyncLog = typeof integrationSyncLogs.$inferSelect;

// ─── INTEGRATION FIELD MAPPINGS ──────────────────────────────────────────
export const integrationFieldMappings = mysqlTable("integration_field_mappings", {
  id: varchar("id", { length: 36 }).primaryKey(),
  connectionId: varchar("connection_id", { length: 36 }).notNull(),
  externalField: varchar("external_field", { length: 200 }).notNull(),
  internalTable: varchar("internal_table", { length: 100 }).notNull(),
  internalField: varchar("internal_field", { length: 200 }).notNull(),
  transform: mysqlEnum("transform", [
    "direct", "lowercase", "uppercase", "date_parse", "phone_e164",
    "currency_cents", "boolean_parse", "custom"
  ]).default("direct"),
  customTransform: text("custom_transform"),
  isActive: mysqlBoolean("is_active").default(true),
});
export type IntegrationFieldMapping = typeof integrationFieldMappings.$inferSelect;

// ─── INTEGRATION WEBHOOK EVENTS (Raw inbound webhook log) ────────────────
export const integrationWebhookEvents = mysqlTable("integration_webhook_events", {
  id: varchar("id", { length: 36 }).primaryKey(),
  connectionId: varchar("connection_id", { length: 36 }).notNull(),
  providerSlug: varchar("provider_slug", { length: 50 }).notNull(),
  eventType: varchar("event_type", { length: 100 }).notNull(),
  payloadJson: json("payload_json").notNull(),
  signatureValid: mysqlBoolean("signature_valid").notNull(),
  processedAt: timestamp("processed_at"),
  processingStatus: mysqlEnum("processing_status", ["pending", "processed", "failed", "skipped"]).default("pending"),
  processingError: text("processing_error"),
  receivedAt: timestamp("received_at").defaultNow().notNull(),
});
export type IntegrationWebhookEvent = typeof integrationWebhookEvents.$inferSelect;

// ─── ENRICHMENT CACHE (Cached enrichment lookups) ────────────────────────
export const enrichmentCache = mysqlTable("enrichment_cache", {
  id: varchar("id", { length: 36 }).primaryKey(),
  providerSlug: varchar("provider_slug", { length: 50 }).notNull(),
  lookupKey: varchar("lookup_key", { length: 500 }).notNull(),
  lookupType: varchar("lookup_type", { length: 50 }).notNull(),
  resultJson: json("result_json").notNull(),
  qualityScore: decimal("quality_score", { precision: 3, scale: 2 }),
  fetchedAt: timestamp("fetched_at").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  hitCount: int("hit_count").default(1),
  connectionId: varchar("connection_id", { length: 36 }),
});
export type EnrichmentCacheEntry = typeof enrichmentCache.$inferSelect;

// ─── CARRIER IMPORT TEMPLATES (Parsing templates for manual uploads) ─────
export const carrierImportTemplates = mysqlTable("carrier_import_templates", {
  id: varchar("id", { length: 36 }).primaryKey(),
  carrierSlug: varchar("carrier_slug", { length: 50 }).notNull(),
  reportType: varchar("report_type", { length: 100 }).notNull(),
  name: varchar("name", { length: 200 }).notNull(),
  description: text("description"),
  columnMappings: json("column_mappings").notNull(),
  parserType: mysqlEnum("parser_type", ["csv", "pdf_table", "pdf_ocr", "excel"]).notNull(),
  sampleHeaders: json("sample_headers"),
  isSystem: mysqlBoolean("is_system").default(false),
  createdBy: int("created_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type CarrierImportTemplate = typeof carrierImportTemplates.$inferSelect;

// ─── INTEGRATION SYNC CONFIG (Per-connection sync scheduling) ──────────────
export const integrationSyncConfig = mysqlTable("integration_sync_config", {
  id: varchar("id", { length: 36 }).primaryKey(),
  connectionId: varchar("connection_id", { length: 36 }).notNull(),
  syncType: mysqlEnum("sync_type", ["full", "incremental", "webhook"]).default("incremental").notNull(),
  schedule: varchar("schedule", { length: 64 }),
  lastSyncAt: timestamp("last_sync_at"),
  nextSyncAt: timestamp("next_sync_at"),
  retryCount: int("retry_count").default(0),
  maxRetries: int("max_retries").default(3),
  backoffMinutes: int("backoff_minutes").default(5),
  fieldMappingOverrides: json("field_mapping_overrides"),
  filterCriteria: json("filter_criteria"),
  isActive: mysqlBoolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type IntegrationSyncConfig = typeof integrationSyncConfig.$inferSelect;

// ─── SUITABILITY PROFILES (12-dimension model) ────────────────────────────
export const suitabilityProfiles = mysqlTable("suitability_profiles", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: int("user_id").notNull(),
  organizationId: int("organization_id"),
  overallScore: float("overall_score"),
  confidenceLevel: float("confidence_level").default(0),
  dataCompleteness: float("data_completeness").default(0),
  lastSynthesizedAt: timestamp("last_synthesized_at"),
  synthesisVersion: int("synthesis_version").default(1),
  dimensionScores: json("dimension_scores"),
  sourceBreakdown: json("source_breakdown"),
  changeVelocity: float("change_velocity"),
  status: mysqlEnum("status", ["draft", "active", "needs_review", "archived"]).default("draft"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type SuitabilityProfile = typeof suitabilityProfiles.$inferSelect;

// ─── SUITABILITY DIMENSIONS (Individual dimension tracking) ────────────────
export const suitabilityDimensions = mysqlTable("suitability_dimensions", {
  id: varchar("id", { length: 36 }).primaryKey(),
  profileId: varchar("profile_id", { length: 36 }).notNull(),
  dimensionKey: varchar("dimension_key", { length: 64 }).notNull(),
  dimensionLabel: varchar("dimension_label", { length: 128 }).notNull(),
  value: json("value"),
  score: float("score"),
  confidence: float("confidence").default(0),
  sources: json("sources"),
  lastUpdatedAt: timestamp("last_updated_at").defaultNow().notNull(),
  decayRate: float("decay_rate").default(0.01),
  nextReviewAt: timestamp("next_review_at"),
});
export type SuitabilityDimension = typeof suitabilityDimensions.$inferSelect;

// ─── SUITABILITY CHANGE EVENTS (Track changes over time) ──────────────────
export const suitabilityChangeEvents = mysqlTable("suitability_change_events", {
  id: varchar("id", { length: 36 }).primaryKey(),
  profileId: varchar("profile_id", { length: 36 }).notNull(),
  dimensionKey: varchar("dimension_key", { length: 64 }),
  changeType: mysqlEnum("change_type", ["user_input", "advisor_update", "system_inference", "integration_sync", "decay", "milestone"]).notNull(),
  previousValue: json("previous_value"),
  newValue: json("new_value"),
  source: varchar("source", { length: 128 }),
  confidence: float("confidence"),
  triggeredBy: int("triggered_by"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type SuitabilityChangeEvent = typeof suitabilityChangeEvents.$inferSelect;

// ─── SUITABILITY QUESTIONS QUEUE (Progressive profiling) ──────────────────
export const suitabilityQuestionsQueue = mysqlTable("suitability_questions_queue", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: int("user_id").notNull(),
  dimensionKey: varchar("dimension_key", { length: 64 }).notNull(),
  question: text("question").notNull(),
  questionType: mysqlEnum("question_type", ["multiple_choice", "scale", "free_text", "yes_no", "numeric"]).default("multiple_choice"),
  options: json("options"),
  priority: int("priority").default(50),
  status: mysqlEnum("status", ["pending", "asked", "answered", "skipped", "expired"]).default("pending"),
  askedAt: timestamp("asked_at"),
  answeredAt: timestamp("answered_at"),
  answer: json("answer"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type SuitabilityQuestion = typeof suitabilityQuestionsQueue.$inferSelect;

// ─── SUITABILITY HOUSEHOLD LINKS (Family/household grouping) ──────────────
export const suitabilityHouseholdLinks = mysqlTable("suitability_household_links", {
  id: varchar("id", { length: 36 }).primaryKey(),
  primaryUserId: int("primary_user_id").notNull(),
  linkedUserId: int("linked_user_id").notNull(),
  relationship: mysqlEnum("relationship", ["spouse", "partner", "dependent", "parent", "sibling", "other"]).notNull(),
  sharedDimensions: json("shared_dimensions"),
  isActive: mysqlBoolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type SuitabilityHouseholdLink = typeof suitabilityHouseholdLinks.$inferSelect;

// ─── FILE UPLOADS (6-stage pipeline) ──────────────────────────────────────
export const fileUploads = mysqlTable("file_uploads", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: int("user_id").notNull(),
  organizationId: int("organization_id"),
  connectionId: varchar("connection_id", { length: 36 }),
  filename: varchar("filename", { length: 512 }).notNull(),
  mimeType: varchar("mime_type", { length: 128 }),
  sizeBytes: bigint("size_bytes", { mode: "number" }),
  storageUrl: text("storage_url"),
  storageKey: varchar("storage_key", { length: 512 }),
  stage: mysqlEnum("stage", ["uploaded", "validated", "parsed", "enriched", "indexed", "complete", "failed"]).default("uploaded"),
  stageError: text("stage_error"),
  category: mysqlEnum("category", ["personal_docs", "financial_products", "regulations", "training", "artifacts", "skills", "carrier_report", "client_data", "compliance"]).default("personal_docs"),
  visibility: mysqlEnum("visibility", ["private", "professional", "management", "admin"]).default("private"),
  metadata: json("metadata"),
  parsedContent: json("parsed_content"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type FileUpload = typeof fileUploads.$inferSelect;

// ─── FILE CHUNKS (Parsed segments for RAG) ────────────────────────────────
export const fileChunks = mysqlTable("file_chunks", {
  id: varchar("id", { length: 36 }).primaryKey(),
  fileId: varchar("file_id", { length: 36 }).notNull(),
  chunkIndex: int("chunk_index").notNull(),
  content: text("content").notNull(),
  contentType: mysqlEnum("content_type", ["text", "table", "image_description", "header", "metadata"]).default("text"),
  tokenCount: int("token_count"),
  embedding: json("embedding"),
  metadata: json("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type FileChunk = typeof fileChunks.$inferSelect;

// ─── FILE DERIVED ENRICHMENTS (Extracted insights from files) ─────────────
export const fileDerivedEnrichments = mysqlTable("file_derived_enrichments", {
  id: varchar("id", { length: 36 }).primaryKey(),
  fileId: varchar("file_id", { length: 36 }).notNull(),
  userId: int("user_id").notNull(),
  enrichmentType: mysqlEnum("enrichment_type", ["suitability_signal", "risk_indicator", "product_match", "compliance_flag", "financial_metric", "life_event"]).notNull(),
  dimensionKey: varchar("dimension_key", { length: 64 }),
  extractedValue: json("extracted_value"),
  confidence: float("confidence"),
  appliedToProfile: mysqlBoolean("applied_to_profile").default(false),
  appliedAt: timestamp("applied_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type FileDerivedEnrichment = typeof fileDerivedEnrichments.$inferSelect;

// ─── ANALYTICAL MODELS (Model registry) ───────────────────────────────────
export const analyticalModels = mysqlTable("analytical_models", {
  id: varchar("id", { length: 36 }).primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  description: text("description"),
  layer: mysqlEnum("layer", ["platform", "organization", "manager", "professional", "user"]).notNull(),
  category: mysqlEnum("category", ["risk", "suitability", "compliance", "engagement", "financial", "behavioral", "market", "operational"]).notNull(),
  inputSchema: json("input_schema"),
  outputSchema: json("output_schema"),
  dependencies: json("dependencies"),
  version: varchar("version", { length: 20 }).default("1.0.0"),
  isActive: mysqlBoolean("is_active").default(true),
  executionType: mysqlEnum("execution_type", ["llm", "statistical", "rule_based", "hybrid"]).default("hybrid"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type AnalyticalModel = typeof analyticalModels.$inferSelect;

// ─── MODEL RUNS (Execution history) ──────────────────────────────────────
export const modelRuns = mysqlTable("model_runs", {
  id: varchar("id", { length: 36 }).primaryKey(),
  modelId: varchar("model_id", { length: 36 }).notNull(),
  triggeredBy: mysqlEnum("triggered_by", ["schedule", "event", "manual", "dependency"]).notNull(),
  triggerSource: varchar("trigger_source", { length: 128 }),
  inputData: json("input_data"),
  outputData: json("output_data"),
  status: mysqlEnum("status", ["pending", "running", "completed", "failed", "cancelled"]).default("pending"),
  errorMessage: text("error_message"),
  durationMs: int("duration_ms"),
  affectedUserIds: json("affected_user_ids"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});
export type ModelRun = typeof modelRuns.$inferSelect;

// ─── MODEL OUTPUT RECORDS (Individual results per user/entity) ────────────
export const modelOutputRecords = mysqlTable("model_output_records", {
  id: varchar("id", { length: 36 }).primaryKey(),
  runId: varchar("run_id", { length: 36 }).notNull(),
  modelId: varchar("model_id", { length: 36 }).notNull(),
  entityType: mysqlEnum("entity_type", ["user", "organization", "team", "platform"]).default("user"),
  entityId: int("entity_id"),
  outputType: varchar("output_type", { length: 64 }).notNull(),
  outputValue: json("output_value"),
  confidence: float("confidence"),
  previousValue: json("previous_value"),
  delta: json("delta"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type ModelOutputRecord = typeof modelOutputRecords.$inferSelect;

// ─── MODEL SCHEDULES (Cron-based execution) ──────────────────────────────
export const modelSchedules = mysqlTable("model_schedules", {
  id: varchar("id", { length: 36 }).primaryKey(),
  modelId: varchar("model_id", { length: 36 }).notNull(),
  cronExpression: varchar("cron_expression", { length: 64 }).notNull(),
  timezone: varchar("timezone", { length: 64 }).default("UTC"),
  isActive: mysqlBoolean("is_active").default(true),
  lastRunAt: timestamp("last_run_at"),
  nextRunAt: timestamp("next_run_at"),
  filterCriteria: json("filter_criteria"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type ModelSchedule = typeof modelSchedules.$inferSelect;

// ─── GENERATED DOCUMENTS (Export/report generation) ──────────────────────
export const generatedDocuments = mysqlTable("generated_documents", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: int("user_id").notNull(),
  organizationId: int("organization_id"),
  templateSlug: varchar("template_slug", { length: 100 }).notNull(),
  title: varchar("title", { length: 512 }).notNull(),
  format: mysqlEnum("format", ["pdf", "docx", "xlsx", "csv", "json", "html"]).notNull(),
  storageUrl: text("storage_url"),
  storageKey: varchar("storage_key", { length: 512 }),
  inputData: json("input_data"),
  status: mysqlEnum("status", ["generating", "complete", "failed"]).default("generating"),
  errorMessage: text("error_message"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type GeneratedDocument = typeof generatedDocuments.$inferSelect;

// ─── PROPAGATION EVENTS (Cross-layer intelligence cascading) ─────────────
export const propagationEvents = mysqlTable("propagation_events", {
  id: varchar("id", { length: 36 }).primaryKey(),
  sourceLayer: mysqlEnum("source_layer", ["platform", "organization", "manager", "professional", "user"]).notNull(),
  targetLayer: mysqlEnum("target_layer", ["platform", "organization", "manager", "professional", "user"]).notNull(),
  eventType: mysqlEnum("event_type", ["insight", "alert", "recommendation", "compliance", "milestone", "risk_change", "opportunity"]).notNull(),
  sourceEntityId: int("source_entity_id"),
  targetEntityId: int("target_entity_id"),
  payload: json("payload"),
  priority: mysqlEnum("priority", ["critical", "high", "medium", "low"]).default("medium"),
  status: mysqlEnum("status", ["pending", "delivered", "acknowledged", "acted", "dismissed", "expired"]).default("pending"),
  deliveredAt: timestamp("delivered_at"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type PropagationEvent = typeof propagationEvents.$inferSelect;

// ─── PROPAGATION ACTIONS (Actions taken on propagated events) ────────────
export const propagationActions = mysqlTable("propagation_actions", {
  id: varchar("id", { length: 36 }).primaryKey(),
  eventId: varchar("event_id", { length: 36 }).notNull(),
  actorId: int("actor_id").notNull(),
  actionType: mysqlEnum("action_type", ["acknowledge", "act", "dismiss", "escalate", "snooze", "delegate"]).notNull(),
  notes: text("notes"),
  resultData: json("result_data"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type PropagationAction = typeof propagationActions.$inferSelect;

// ─── COACHING MESSAGES (AI-generated coaching/nudges) ────────────────────
export const coachingMessages = mysqlTable("coaching_messages", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: int("user_id").notNull(),
  organizationId: int("organization_id"),
  messageType: mysqlEnum("message_type", ["nudge", "celebration", "reminder", "education", "insight", "alert"]).notNull(),
  category: varchar("category", { length: 64 }),
  title: varchar("title", { length: 256 }).notNull(),
  content: text("content").notNull(),
  priority: mysqlEnum("priority", ["critical", "high", "medium", "low"]).default("medium"),
  triggerEvent: varchar("trigger_event", { length: 128 }),
  status: mysqlEnum("status", ["pending", "delivered", "read", "acted", "dismissed"]).default("pending"),
  deliveredAt: timestamp("delivered_at"),
  readAt: timestamp("read_at"),
  expiresAt: timestamp("expires_at"),
  metadata: json("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type CoachingMessage = typeof coachingMessages.$inferSelect;

// ─── PLATFORM LEARNINGS (System-wide pattern detection) ──────────────────
export const platformLearnings = mysqlTable("platform_learnings", {
  id: varchar("id", { length: 36 }).primaryKey(),
  learningType: mysqlEnum("learning_type", ["pattern", "anomaly", "trend", "correlation", "best_practice", "risk_factor"]).notNull(),
  category: varchar("category", { length: 64 }),
  description: text("description").notNull(),
  evidence: json("evidence"),
  confidence: float("confidence"),
  impactScore: float("impact_score"),
  applicableLayer: mysqlEnum("applicable_layer", ["platform", "organization", "manager", "professional", "user"]),
  actionRecommendation: text("action_recommendation"),
  status: mysqlEnum("status", ["detected", "validated", "applied", "rejected", "expired"]).default("detected"),
  appliedAt: timestamp("applied_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type PlatformLearning = typeof platformLearnings.$inferSelect;

// ─── EDUCATION TRIGGERS (Contextual education delivery) ──────────────────
export const educationTriggers = mysqlTable("education_triggers", {
  id: varchar("id", { length: 36 }).primaryKey(),
  triggerCondition: json("trigger_condition").notNull(),
  educationModuleId: int("education_module_id"),
  targetAudience: mysqlEnum("target_audience", ["all", "new_users", "professionals", "managers", "admins"]).default("all"),
  title: varchar("title", { length: 256 }).notNull(),
  content: text("content"),
  contentUrl: text("content_url"),
  deliveryMethod: mysqlEnum("delivery_method", ["in_app", "chat_injection", "notification", "email"]).default("in_app"),
  priority: int("priority").default(50),
  isActive: mysqlBoolean("is_active").default(true),
  timesTriggered: int("times_triggered").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type EducationTrigger = typeof educationTriggers.$inferSelect;


// ─── AUTH PROVIDER TOKENS (OAuth tokens for LinkedIn/Google) ─────────────
export const authProviderTokens = mysqlTable("auth_provider_tokens", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: int("user_id").notNull(),
  provider: mysqlEnum("provider", ["linkedin", "google"]).notNull(),
  accessTokenEncrypted: text("access_token_encrypted").notNull(),
  refreshTokenEncrypted: text("refresh_token_encrypted"),
  tokenExpiresAt: timestamp("token_expires_at"),
  scopesGranted: json("scopes_granted").notNull(),
  lastProfileFetchAt: timestamp("last_profile_fetch_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type AuthProviderToken = typeof authProviderTokens.$inferSelect;

// ─── AUTH ENRICHMENT LOG (Track data captured from each sign-in event) ───
export const authEnrichmentLog = mysqlTable("auth_enrichment_log", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: int("user_id").notNull(),
  provider: mysqlEnum("provider", ["linkedin", "google", "email", "apollo", "pdl", "manus"]).notNull(),
  eventType: mysqlEnum("event_type", ["initial_signup", "re_auth", "token_refresh", "manual_enrich", "periodic_refresh"]).notNull(),
  fieldsCaptured: json("fields_captured").notNull(),
  fieldsNew: json("fields_new").notNull(),
  fieldsUpdated: json("fields_updated").notNull(),
  rawResponseHash: varchar("raw_response_hash", { length: 64 }).notNull(),
  suitabilityDimensionsUpdated: json("suitability_dimensions_updated"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type AuthEnrichmentLogEntry = typeof authEnrichmentLog.$inferSelect;


// ═══════════════════════════════════════════════════════════════════════════
// ADDENDUM TABLES — Tasks #21-57: Every Criterion to 5.0
// ═══════════════════════════════════════════════════════════════════════════

// ─── Task #21: Prompt A/B Testing + Regression ───────────────────────────
export const promptExperimentResults = mysqlTable("prompt_experiment_results", {
  id: int("id").autoincrement().primaryKey(),
  experimentName: varchar("experiment_name", { length: 256 }).notNull(),
  variantAId: int("variant_a_id").notNull(),
  variantBId: int("variant_b_id").notNull(),
  totalSamples: int("total_samples").default(0),
  variantAPositive: int("variant_a_positive").default(0),
  variantBPositive: int("variant_b_positive").default(0),
  variantAAvgLatency: float("variant_a_avg_latency"),
  variantBAvgLatency: float("variant_b_avg_latency"),
  pValue: float("p_value"),
  significanceReached: mysqlBoolean("significance_reached").default(false),
  winnerId: int("winner_id"),
  autoPromoted: mysqlBoolean("auto_promoted").default(false),
  status: mysqlEnum("status", ["running", "completed", "cancelled"]).default("running"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});
export type PromptExperimentResult = typeof promptExperimentResults.$inferSelect;

export const promptGoldenTests = mysqlTable("prompt_golden_tests", {
  id: int("id").autoincrement().primaryKey(),
  promptText: text("prompt_text").notNull(),
  expectedResponsePattern: text("expected_response_pattern").notNull(),
  category: varchar("category", { length: 64 }).default("general"),
  complianceMustPass: mysqlBoolean("compliance_must_pass").default(true),
  minSimilarityScore: float("min_similarity_score").default(0.7),
  isActive: mysqlBoolean("is_active").default(true),
  lastTestedAt: timestamp("last_tested_at"),
  lastPassedAt: timestamp("last_passed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type PromptGoldenTest = typeof promptGoldenTests.$inferSelect;

export const promptRegressionRuns = mysqlTable("prompt_regression_runs", {
  id: int("id").autoincrement().primaryKey(),
  variantId: int("variant_id"),
  totalTests: int("total_tests").default(0),
  passedTests: int("passed_tests").default(0),
  avgSimilarity: float("avg_similarity"),
  compliancePassRate: float("compliance_pass_rate"),
  qualityDrop: mysqlBoolean("quality_drop").default(false),
  promotionBlocked: mysqlBoolean("promotion_blocked").default(false),
  runAt: timestamp("run_at").defaultNow().notNull(),
});
export type PromptRegressionRun = typeof promptRegressionRuns.$inferSelect;

// ─── Task #22: Compliance Pre-Screening ──────────────────────────────────
export const compliancePrescreening = mysqlTable("compliance_prescreening", {
  id: int("id").autoincrement().primaryKey(),
  messageId: int("message_id").notNull(),
  conversationId: int("conversation_id").notNull(),
  checkType: mysqlEnum("check_type", ["unsuitable_recommendation", "promissory_language", "unauthorized_practice", "concentration_risk", "missing_disclosure"]).notNull(),
  severity: mysqlEnum("severity", ["low", "medium", "high", "critical"]).default("low"),
  details: text("details"),
  actionTaken: mysqlEnum("action_taken", ["passed", "warning_injected", "held_for_review"]).default("passed"),
  reviewedBy: int("reviewed_by"),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type CompliancePrescreeningEntry = typeof compliancePrescreening.$inferSelect;

export const conversationComplianceScores = mysqlTable("conversation_compliance_scores", {
  id: int("id").autoincrement().primaryKey(),
  conversationId: int("conversation_id").notNull(),
  score: int("score").default(100),
  checksRun: int("checks_run").default(0),
  checksPassed: int("checks_passed").default(0),
  flaggedForReview: mysqlBoolean("flagged_for_review").default(false),
  lastUpdated: timestamp("last_updated").defaultNow().notNull(),
});
export type ConversationComplianceScore = typeof conversationComplianceScores.$inferSelect;

// ─── Task #23: Canary Deployments ────────────────────────────────────────
export const deploymentChecks = mysqlTable("deployment_checks", {
  id: int("id").autoincrement().primaryKey(),
  checkType: varchar("check_type", { length: 64 }).notNull(),
  passed: mysqlBoolean("passed").default(false),
  details: text("details"),
  durationMs: int("duration_ms"),
  runAt: timestamp("run_at").defaultNow().notNull(),
});
export type DeploymentCheck = typeof deploymentChecks.$inferSelect;

export const deploymentHistory = mysqlTable("deployment_history", {
  id: int("id").autoincrement().primaryKey(),
  version: varchar("version", { length: 64 }).notNull(),
  description: text("description"),
  testsPassed: int("tests_passed"),
  testsTotal: int("tests_total"),
  bundleSizeKb: int("bundle_size_kb"),
  rolloutPercentage: int("rollout_percentage").default(5),
  status: mysqlEnum("status", ["deploying", "canary", "rolling_out", "complete", "rolled_back"]).default("deploying"),
  errorRate: float("error_rate"),
  previousVersion: varchar("previous_version", { length: 64 }),
  deployedBy: int("deployed_by"),
  deployedAt: timestamp("deployed_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});
export type DeploymentHistoryEntry = typeof deploymentHistory.$inferSelect;

// ─── Task #24: Dynamic Knowledge Graph ───────────────────────────────────
export const knowledgeGraphEntities = mysqlTable("knowledge_graph_entities", {
  id: int("id").autoincrement().primaryKey(),
  entityType: mysqlEnum("entity_type", ["person", "company", "product", "concept", "regulation", "account"]).notNull(),
  canonicalName: varchar("canonical_name", { length: 512 }).notNull(),
  aliases: json("aliases"),
  metadata: json("metadata"),
  lastVerified: timestamp("last_verified"),
  confidence: float("confidence").default(1.0),
  source: varchar("source", { length: 128 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type KnowledgeGraphEntity = typeof knowledgeGraphEntities.$inferSelect;

export const knowledgeGraphEdges = mysqlTable("knowledge_graph_edges", {
  id: int("id").autoincrement().primaryKey(),
  fromEntityId: int("from_entity_id").notNull(),
  toEntityId: int("to_entity_id").notNull(),
  relationshipType: varchar("relationship_type", { length: 128 }).notNull(),
  weight: float("weight").default(1.0),
  validFrom: timestamp("valid_from"),
  validUntil: timestamp("valid_until"),
  source: varchar("source", { length: 128 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type KnowledgeGraphEdge = typeof knowledgeGraphEdges.$inferSelect;

export const entityResolutionRules = mysqlTable("entity_resolution_rules", {
  id: int("id").autoincrement().primaryKey(),
  pattern: varchar("pattern", { length: 512 }).notNull(),
  canonicalEntityId: int("canonical_entity_id").notNull(),
  confidence: float("confidence").default(0.9),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type EntityResolutionRule = typeof entityResolutionRules.$inferSelect;

// ─── Task #25: What-If Scenarios + Backtesting ──────────────────────────
export const modelScenarios = mysqlTable("model_scenarios", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  baseRunId: int("base_run_id"),
  modelType: varchar("model_type", { length: 64 }).notNull(),
  scenarioName: varchar("scenario_name", { length: 256 }).notNull(),
  adjustedParams: json("adjusted_params"),
  resultJson: json("result_json"),
  comparisonNotes: text("comparison_notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type ModelScenario = typeof modelScenarios.$inferSelect;

export const modelBacktests = mysqlTable("model_backtests", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  modelType: varchar("model_type", { length: 64 }).notNull(),
  historicalEvent: varchar("historical_event", { length: 128 }).notNull(),
  eventYear: int("event_year").notNull(),
  portfolioParams: json("portfolio_params"),
  resultJson: json("result_json"),
  maxDrawdown: float("max_drawdown"),
  recoveryMonths: int("recovery_months"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type ModelBacktest = typeof modelBacktests.$inferSelect;

// ─── Task #26: Adaptive Context Management ──────────────────────────────
export const contextAssemblyLog = mysqlTable("context_assembly_log", {
  id: int("id").autoincrement().primaryKey(),
  conversationId: int("conversation_id").notNull(),
  messageId: int("message_id"),
  layer: varchar("layer", { length: 64 }).notNull(),
  itemsConsidered: int("items_considered").default(0),
  itemsIncluded: int("items_included").default(0),
  itemsPruned: int("items_pruned").default(0),
  tokenBudget: int("token_budget"),
  tokensUsed: int("tokens_used"),
  complexityLevel: mysqlEnum("complexity_level", ["simple", "moderate", "complex"]).default("moderate"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type ContextAssemblyLogEntry = typeof contextAssemblyLog.$inferSelect;

// ─── Task #27: Error Handling ────────────────────────────────────────────
export const serverErrors = mysqlTable("server_errors", {
  id: int("id").autoincrement().primaryKey(),
  errorType: varchar("error_type", { length: 128 }).notNull(),
  message: text("message"),
  stack: text("stack"),
  componentName: varchar("component_name", { length: 256 }),
  userId: int("user_id"),
  url: varchar("url", { length: 1024 }),
  metadata: json("metadata"),
  resolved: mysqlBoolean("resolved").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type ServerError = typeof serverErrors.$inferSelect;

// ─── Task #29: Calculator Persistence ────────────────────────────────────
export const calculatorScenarios = mysqlTable("calculator_scenarios", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  calculatorType: varchar("calculator_type", { length: 64 }).notNull(),
  name: varchar("name", { length: 256 }).notNull(),
  inputsJson: json("inputs_json"),
  resultsJson: json("results_json"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type CalculatorScenario = typeof calculatorScenarios.$inferSelect;

// ─── Task #30: Predictive Insights + Benchmarks ─────────────────────────
export const predictiveTriggers = mysqlTable("predictive_triggers", {
  id: int("id").autoincrement().primaryKey(),
  triggerType: varchar("trigger_type", { length: 128 }).notNull(),
  conditionJson: json("condition_json"),
  actionType: varchar("action_type", { length: 64 }).notNull(),
  actionJson: json("action_json"),
  active: mysqlBoolean("active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type PredictiveTrigger = typeof predictiveTriggers.$inferSelect;

export const benchmarkAggregates = mysqlTable("benchmark_aggregates", {
  id: int("id").autoincrement().primaryKey(),
  dimension: varchar("dimension", { length: 128 }).notNull(),
  ageBracket: varchar("age_bracket", { length: 32 }),
  incomeBracket: varchar("income_bracket", { length: 32 }),
  percentile25: float("percentile_25"),
  percentile50: float("percentile_50"),
  percentile75: float("percentile_75"),
  sampleSize: int("sample_size").default(0),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type BenchmarkAggregate = typeof benchmarkAggregates.$inferSelect;

// ─── Task #31: Regulatory Change Monitor ─────────────────────────────────
export const regulatoryUpdates = mysqlTable("regulatory_updates", {
  id: int("id").autoincrement().primaryKey(),
  source: varchar("source", { length: 128 }).notNull(),
  title: varchar("title", { length: 512 }).notNull(),
  summary: text("summary"),
  relevanceScore: float("relevance_score"),
  categories: json("categories"),
  actionRequired: mysqlBoolean("action_required").default(false),
  reviewedBy: int("reviewed_by"),
  publishedAt: timestamp("published_at"),
  ingestedAt: timestamp("ingested_at").defaultNow().notNull(),
});
export type RegulatoryUpdate = typeof regulatoryUpdates.$inferSelect;

export const disclaimerVersions = mysqlTable("disclaimer_versions", {
  id: int("id").autoincrement().primaryKey(),
  topic: varchar("topic", { length: 128 }).notNull(),
  disclaimerText: text("disclaimer_text").notNull(),
  version: int("version").default(1),
  effectiveDate: timestamp("effective_date").defaultNow().notNull(),
  supersededBy: int("superseded_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type DisclaimerVersion = typeof disclaimerVersions.$inferSelect;

export const disclaimerAudit = mysqlTable("disclaimer_audit", {
  id: int("id").autoincrement().primaryKey(),
  conversationId: int("conversation_id").notNull(),
  disclaimerId: int("disclaimer_id").notNull(),
  disclaimerVersion: int("disclaimer_version").default(1),
  shownAt: timestamp("shown_at").defaultNow().notNull(),
});
export type DisclaimerAuditEntry = typeof disclaimerAudit.$inferSelect;

export const regulatoryAlerts = mysqlTable("regulatory_alerts", {
  id: int("id").autoincrement().primaryKey(),
  source: varchar("source", { length: 128 }).notNull(),
  filingType: varchar("filing_type", { length: 64 }),
  entity: varchar("entity", { length: 256 }),
  relevanceToUser: text("relevance_to_user"),
  summary: text("summary"),
  alertSent: mysqlBoolean("alert_sent").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type RegulatoryAlert = typeof regulatoryAlerts.$inferSelect;

// ─── Task #32: Role-Adaptive Onboarding ──────────────────────────────────
export const onboardingProgress = mysqlTable("onboarding_progress", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  path: mysqlEnum("path", ["advisor", "client", "admin"]).notNull(),
  currentStep: int("current_step").default(0),
  totalSteps: int("total_steps").default(5),
  completedSteps: json("completed_steps"),
  skippedBasics: mysqlBoolean("skipped_basics").default(false),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type OnboardingProgressEntry = typeof onboardingProgress.$inferSelect;

// ─── Task #33: Product Disqualification ──────────────────────────────────
export const productSuitabilityEvaluations = mysqlTable("product_suitability_evaluations", {
  id: int("id").autoincrement().primaryKey(),
  productId: int("product_id").notNull(),
  userId: int("user_id").notNull(),
  suitabilityScore: float("suitability_score"),
  evaluationDate: timestamp("evaluation_date").defaultNow().notNull(),
  qualifyingDimensions: json("qualifying_dimensions"),
  disqualifyingDimensions: json("disqualifying_dimensions"),
  status: mysqlEnum("status", ["qualified", "marginal", "disqualified", "needs_review"]).default("qualified"),
});
export type ProductSuitabilityEvaluation = typeof productSuitabilityEvaluations.$inferSelect;

// ─── Task #34: Dynamic Disclaimers + Tracking ────────────────────────────
export const disclaimerInteractions = mysqlTable("disclaimer_interactions", {
  id: int("id").autoincrement().primaryKey(),
  disclaimerId: int("disclaimer_id").notNull(),
  userId: int("user_id").notNull(),
  action: mysqlEnum("action", ["shown", "scrolled", "clicked", "acknowledged"]).default("shown"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type DisclaimerInteraction = typeof disclaimerInteractions.$inferSelect;

export const disclaimerTranslations = mysqlTable("disclaimer_translations", {
  id: int("id").autoincrement().primaryKey(),
  disclaimerId: int("disclaimer_id").notNull(),
  language: varchar("language", { length: 10 }).notNull(),
  translatedText: text("translated_text").notNull(),
  verifiedBy: int("verified_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type DisclaimerTranslation = typeof disclaimerTranslations.$inferSelect;

export const conversationTopics = mysqlTable("conversation_topics", {
  id: int("id").autoincrement().primaryKey(),
  conversationId: int("conversation_id").notNull(),
  messageId: int("message_id"),
  topic: varchar("topic", { length: 128 }).notNull(),
  previousTopic: varchar("previous_topic", { length: 128 }),
  disclaimerInjected: mysqlBoolean("disclaimer_injected").default(false),
  detectedAt: timestamp("detected_at").defaultNow().notNull(),
});
export type ConversationTopic = typeof conversationTopics.$inferSelect;

// ─── Task #35: Proactive Escalation + Video ──────────────────────────────
export const proactiveEscalationRules = mysqlTable("proactive_escalation_rules", {
  id: int("id").autoincrement().primaryKey(),
  triggerType: varchar("trigger_type", { length: 128 }).notNull(),
  conditionText: text("condition_text"),
  threshold: float("threshold"),
  active: mysqlBoolean("active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type ProactiveEscalationRule = typeof proactiveEscalationRules.$inferSelect;

export const professionalAvailability = mysqlTable("professional_availability", {
  id: int("id").autoincrement().primaryKey(),
  professionalId: int("professional_id").notNull(),
  dayOfWeek: int("day_of_week").notNull(),
  startTime: varchar("start_time", { length: 8 }).notNull(),
  endTime: varchar("end_time", { length: 8 }).notNull(),
  timezone: varchar("timezone", { length: 64 }).default("America/New_York"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type ProfessionalAvailabilityEntry = typeof professionalAvailability.$inferSelect;

export const consultationBookings = mysqlTable("consultation_bookings", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  professionalId: int("professional_id").notNull(),
  scheduledAt: timestamp("scheduled_at").notNull(),
  durationMinutes: int("duration_minutes").default(30),
  preBriefId: int("pre_brief_id"),
  status: mysqlEnum("status", ["scheduled", "confirmed", "in_progress", "completed", "cancelled"]).default("scheduled"),
  dailyRoomUrl: varchar("daily_room_url", { length: 512 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type ConsultationBooking = typeof consultationBookings.$inferSelect;

// ─── Task #36: Financial Literacy Detection ──────────────────────────────
export const userGuardrails = mysqlTable("user_guardrails", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  guardrailType: varchar("guardrail_type", { length: 64 }).notNull(),
  value: varchar("value", { length: 256 }).notNull(),
  reason: text("reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type UserGuardrail = typeof userGuardrails.$inferSelect;

// ─── Task #37: Dynamic Permissions + ABAC ────────────────────────────────
export const roleElevations = mysqlTable("role_elevations", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  fromRole: varchar("from_role", { length: 32 }).notNull(),
  toRole: varchar("to_role", { length: 32 }).notNull(),
  grantedBy: int("granted_by").notNull(),
  grantedAt: timestamp("granted_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  reason: text("reason"),
  revokedAt: timestamp("revoked_at"),
});
export type RoleElevation = typeof roleElevations.$inferSelect;

export const delegations = mysqlTable("delegations", {
  id: int("id").autoincrement().primaryKey(),
  delegatorId: int("delegator_id").notNull(),
  delegateId: int("delegate_id").notNull(),
  scope: json("scope"),
  grantedAt: timestamp("granted_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at"),
  active: mysqlBoolean("active").default(true),
});
export type Delegation = typeof delegations.$inferSelect;

export const accessPolicies = mysqlTable("access_policies", {
  id: int("id").autoincrement().primaryKey(),
  resourceType: varchar("resource_type", { length: 128 }).notNull(),
  requiredAttributes: json("required_attributes"),
  effect: mysqlEnum("effect", ["allow", "deny"]).default("allow"),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type AccessPolicy = typeof accessPolicies.$inferSelect;

// ─── Task #38: Key Rotation + Field Encryption ──────────────────────────
export const encryptionKeys = mysqlTable("encryption_keys", {
  id: int("id").autoincrement().primaryKey(),
  keyAlias: varchar("key_alias", { length: 128 }).notNull(),
  status: mysqlEnum("status", ["active", "rotating", "retired"]).default("active"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  rotatedAt: timestamp("rotated_at"),
  retiredAt: timestamp("retired_at"),
});
export type EncryptionKey = typeof encryptionKeys.$inferSelect;

export const encryptedFieldsRegistry = mysqlTable("encrypted_fields_registry", {
  id: int("id").autoincrement().primaryKey(),
  tableName: varchar("table_name", { length: 128 }).notNull(),
  columnName: varchar("column_name", { length: 128 }).notNull(),
  encryptionMethod: varchar("encryption_method", { length: 64 }).default("AES-256-GCM"),
  keyAlias: varchar("key_alias", { length: 128 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type EncryptedFieldsRegistryEntry = typeof encryptedFieldsRegistry.$inferSelect;

// ─── Task #39: Retention Enforcement ─────────────────────────────────────
export const retentionActionsLog = mysqlTable("retention_actions_log", {
  id: int("id").autoincrement().primaryKey(),
  dataType: varchar("data_type", { length: 128 }).notNull(),
  action: mysqlEnum("action", ["delete", "archive", "anonymize"]).notNull(),
  recordsAffected: int("records_affected").default(0),
  executedAt: timestamp("executed_at").defaultNow().notNull(),
});
export type RetentionActionLogEntry = typeof retentionActionsLog.$inferSelect;

export const orgRetentionPolicies = mysqlTable("org_retention_policies", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("org_id").notNull(),
  dataCategory: varchar("data_category", { length: 128 }).notNull(),
  retentionDays: int("retention_days").notNull(),
  action: mysqlEnum("action", ["delete", "archive", "anonymize"]).default("archive"),
  configuredBy: int("configured_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type OrgRetentionPolicy = typeof orgRetentionPolicies.$inferSelect;

// ─── Task #41: AI Boundaries ─────────────────────────────────────────────
export const userAiBoundaries = mysqlTable("user_ai_boundaries", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  boundaryType: varchar("boundary_type", { length: 64 }).notNull(),
  value: text("value").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type UserAiBoundary = typeof userAiBoundaries.$inferSelect;

// ─── Task #46: Field-Level Sharing ───────────────────────────────────────
export const fieldSharingControls = mysqlTable("field_sharing_controls", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  fieldName: varchar("field_name", { length: 128 }).notNull(),
  shareWithRole: varchar("share_with_role", { length: 32 }),
  grantedAt: timestamp("granted_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at"),
});
export type FieldSharingControl = typeof fieldSharingControls.$inferSelect;

// ─── Task #47: Per-Org Model + Token Budget ──────────────────────────────
export const orgAiConfig = mysqlTable("org_ai_config", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("org_id").notNull(),
  preferredModel: varchar("preferred_model", { length: 128 }),
  monthlyTokenBudget: int("monthly_token_budget"),
  tokensUsedThisMonth: int("tokens_used_this_month").default(0),
  customSystemPromptAdditions: text("custom_system_prompt_additions"),
  budgetAlertSent: mysqlBoolean("budget_alert_sent").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type OrgAiConfigEntry = typeof orgAiConfig.$inferSelect;

export const orgPromptCustomizations = mysqlTable("org_prompt_customizations", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("org_id").notNull(),
  promptText: text("prompt_text").notNull(),
  status: mysqlEnum("status", ["pending", "approved", "rejected"]).default("pending"),
  reviewedBy: int("reviewed_by"),
  approvedAt: timestamp("approved_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type OrgPromptCustomization = typeof orgPromptCustomizations.$inferSelect;

// ─── Task #48: Agent Templates ───────────────────────────────────────────
export const agentTemplates = mysqlTable("agent_templates", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 256 }).notNull(),
  description: text("description"),
  stepsJson: json("steps_json"),
  category: varchar("category", { length: 64 }),
  orgId: int("org_id"),
  isBuiltIn: mysqlBoolean("is_built_in").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type AgentTemplate = typeof agentTemplates.$inferSelect;

export const agentPerformance = mysqlTable("agent_performance", {
  id: int("id").autoincrement().primaryKey(),
  agentTemplateId: int("agent_template_id").notNull(),
  runs: int("runs").default(0),
  successes: int("successes").default(0),
  avgDurationMs: int("avg_duration_ms"),
  avgCostUsd: float("avg_cost_usd"),
  avgSatisfactionScore: float("avg_satisfaction_score"),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type AgentPerformanceEntry = typeof agentPerformance.$inferSelect;

// ─── Task #49: Compliance Prediction ─────────────────────────────────────
export const compliancePredictions = mysqlTable("compliance_predictions", {
  id: int("id").autoincrement().primaryKey(),
  agentActionId: int("agent_action_id"),
  predictedRiskScore: int("predicted_risk_score"),
  riskFactors: json("risk_factors"),
  predictionModelVersion: varchar("prediction_model_version", { length: 32 }),
  requiresApproval: mysqlBoolean("requires_approval").default(false),
  approved: mysqlBoolean("approved"),
  approvedBy: int("approved_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type CompliancePrediction = typeof compliancePredictions.$inferSelect;

// ─── Task #50: Graduated Autonomy ────────────────────────────────────────
export const agentAutonomyLevels = mysqlTable("agent_autonomy_levels", {
  id: int("id").autoincrement().primaryKey(),
  agentTemplateId: int("agent_template_id").notNull(),
  currentLevel: int("current_level").default(1),
  level1Runs: int("level_1_runs").default(0),
  level2Runs: int("level_2_runs").default(0),
  promotedAt: timestamp("promoted_at"),
  promotedBy: int("promoted_by"),
});
export type AgentAutonomyLevel = typeof agentAutonomyLevels.$inferSelect;

// ─── Task #52: Account Reconciliation ────────────────────────────────────
export const plaidWebhooksLog = mysqlTable("plaid_webhooks_log", {
  id: int("id").autoincrement().primaryKey(),
  webhookType: varchar("webhook_type", { length: 128 }).notNull(),
  itemId: varchar("item_id", { length: 256 }),
  payload: json("payload"),
  processedAt: timestamp("processed_at"),
  status: mysqlEnum("status", ["received", "processing", "processed", "failed"]).default("received"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type PlaidWebhookLogEntry = typeof plaidWebhooksLog.$inferSelect;

export const transactionCategories = mysqlTable("transaction_categories", {
  id: int("id").autoincrement().primaryKey(),
  transactionId: varchar("transaction_id", { length: 256 }).notNull(),
  userId: int("user_id").notNull(),
  aiCategory: varchar("ai_category", { length: 128 }),
  userOverrideCategory: varchar("user_override_category", { length: 128 }),
  confidence: float("confidence"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type TransactionCategory = typeof transactionCategories.$inferSelect;

export const reconciliationLog = mysqlTable("reconciliation_log", {
  id: int("id").autoincrement().primaryKey(),
  accountId: varchar("account_id", { length: 256 }).notNull(),
  expectedBalance: decimal("expected_balance", { precision: 18, scale: 2 }),
  actualBalance: decimal("actual_balance", { precision: 18, scale: 2 }),
  discrepancy: decimal("discrepancy", { precision: 18, scale: 2 }),
  resolved: mysqlBoolean("resolved").default(false),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type ReconciliationLogEntry = typeof reconciliationLog.$inferSelect;

// ─── Task #53: CRM Sync ─────────────────────────────────────────────────
export const crmSyncLog = mysqlTable("crm_sync_log", {
  id: int("id").autoincrement().primaryKey(),
  direction: mysqlEnum("direction", ["push", "pull"]).notNull(),
  crmProvider: varchar("crm_provider", { length: 128 }).notNull(),
  recordsSynced: int("records_synced").default(0),
  syncType: varchar("sync_type", { length: 64 }),
  status: mysqlEnum("status", ["started", "completed", "failed"]).default("started"),
  errorDetails: text("error_details"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type CrmSyncLogEntry = typeof crmSyncLog.$inferSelect;
export type InsertCrmSyncLogEntry = typeof crmSyncLog.$inferInsert;

export const carrierSubmissions = mysqlTable("carrier_submissions", {
  id: int("id").autoincrement().primaryKey(),
  quoteId: int("quote_id"),
  carrierId: int("carrier_id"),
  submissionMethod: mysqlEnum("submission_method", ["api", "pdf", "manual"]).default("manual"),
  status: mysqlEnum("status", ["draft", "submitted", "accepted", "rejected", "pending"]).default("draft"),
  submittedAt: timestamp("submitted_at"),
  responseReceivedAt: timestamp("response_received_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type CarrierSubmission = typeof carrierSubmissions.$inferSelect;

// ─── Task #54: Real-Time Market Streaming ────────────────────────────────
export const marketDataSubscriptions = mysqlTable("market_data_subscriptions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  symbol: varchar("symbol", { length: 16 }).notNull(),
  subscribedAt: timestamp("subscribed_at").defaultNow().notNull(),
});
export type MarketDataSubscription = typeof marketDataSubscriptions.$inferSelect;

export const marketEvents = mysqlTable("market_events", {
  id: int("id").autoincrement().primaryKey(),
  eventType: varchar("event_type", { length: 64 }).notNull(),
  symbol: varchar("symbol", { length: 16 }).notNull(),
  magnitude: float("magnitude"),
  details: text("details"),
  insightGenerated: mysqlBoolean("insight_generated").default(false),
  detectedAt: timestamp("detected_at").defaultNow().notNull(),
});
export type MarketEvent = typeof marketEvents.$inferSelect;

// ─── Task #55: Regulatory Impact Analysis ────────────────────────────────
export const regulatoryImpactAnalyses = mysqlTable("regulatory_impact_analyses", {
  id: int("id").autoincrement().primaryKey(),
  updateId: int("update_id").notNull(),
  impactLevel: mysqlEnum("impact_level", ["high", "medium", "low"]).default("low"),
  affectedAreas: json("affected_areas"),
  recommendedActions: json("recommended_actions"),
  generatedAt: timestamp("generated_at").defaultNow().notNull(),
});
export type RegulatoryImpactAnalysis = typeof regulatoryImpactAnalyses.$inferSelect;

export const complianceWeeklyBriefs = mysqlTable("compliance_weekly_briefs", {
  id: int("id").autoincrement().primaryKey(),
  weekStart: date("week_start").notNull(),
  briefJson: json("brief_json"),
  distributedAt: timestamp("distributed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type ComplianceWeeklyBrief = typeof complianceWeeklyBriefs.$inferSelect;

// ─── Task #56: Load Testing + Capacity ───────────────────────────────────
export const loadTestResults = mysqlTable("load_test_results", {
  id: int("id").autoincrement().primaryKey(),
  testDate: timestamp("test_date").defaultNow().notNull(),
  scenario: varchar("scenario", { length: 256 }).notNull(),
  concurrentUsers: int("concurrent_users"),
  requestsPerSecond: float("requests_per_second"),
  p95LatencyMs: int("p95_latency_ms"),
  errors: int("errors").default(0),
  notes: text("notes"),
});
export type LoadTestResult = typeof loadTestResults.$inferSelect;


// ═══════════════════════════════════════════════════════════════════════════
// CONSOLIDATION TABLES (v13→v15)
// ═══════════════════════════════════════════════════════════════════════════

// ─── Knowledge Base ──────────────────────────────────────────────────────
export const knowledgeArticles = mysqlTable("knowledge_articles", {
  id: int("id").autoincrement().primaryKey(),
  category: varchar("category", { length: 100 }).notNull(),
  subcategory: varchar("subcategory", { length: 100 }),
  title: varchar("title", { length: 500 }).notNull(),
  content: text("content").notNull(),
  contentType: mysqlEnum("content_type", ["process", "concept", "reference", "template", "faq", "policy", "guide"]).notNull().default("concept"),
  metadata: json("metadata"),
  version: int("version").notNull().default(1),
  effectiveDate: timestamp("effective_date"),
  expiryDate: timestamp("expiry_date"),
  source: mysqlEnum("source", ["manual", "ingested", "ai_generated", "conversation_mining"]).notNull().default("manual"),
  sourceUrl: text("source_url"),
  createdBy: int("created_by"),
  approvedBy: int("approved_by"),
  approvedAt: timestamp("approved_at"),
  usageCount: int("usage_count").notNull().default(0),
  avgHelpfulnessScore: float("avg_helpfulness_score").default(0),
  freshnessScore: float("freshness_score").default(100),
  lastUsedAt: timestamp("last_used_at"),
  active: mysqlBoolean("active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type KnowledgeArticle = typeof knowledgeArticles.$inferSelect;

export const knowledgeArticleVersions = mysqlTable("knowledge_article_versions", {
  id: int("id").autoincrement().primaryKey(),
  articleId: int("article_id").notNull(),
  version: int("version").notNull(),
  content: text("content").notNull(),
  changedBy: int("changed_by"),
  changedAt: timestamp("changed_at").defaultNow().notNull(),
  changeReason: text("change_reason"),
});
export type KnowledgeArticleVersion = typeof knowledgeArticleVersions.$inferSelect;

export const knowledgeArticleFeedback = mysqlTable("knowledge_article_feedback", {
  id: int("id").autoincrement().primaryKey(),
  articleId: int("article_id").notNull(),
  userId: int("user_id"),
  helpful: mysqlBoolean("helpful").notNull(),
  feedbackText: text("feedback_text"),
  context: text("context"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type KnowledgeArticleFeedback = typeof knowledgeArticleFeedback.$inferSelect;

export const knowledgeGaps = mysqlTable("knowledge_gaps", {
  id: int("id").autoincrement().primaryKey(),
  topicCluster: varchar("topic_cluster", { length: 200 }).notNull(),
  queryCount: int("query_count").notNull().default(1),
  sampleQueries: json("sample_queries"),
  suggestedArticleDraft: text("suggested_article_draft"),
  status: mysqlEnum("status", ["open", "in_progress", "resolved", "dismissed"]).notNull().default("open"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  resolvedAt: timestamp("resolved_at"),
});
export type KnowledgeGap = typeof knowledgeGaps.$inferSelect;

export const knowledgeIngestionJobs = mysqlTable("knowledge_ingestion_jobs", {
  id: int("id").autoincrement().primaryKey(),
  sourceType: mysqlEnum("source_type", ["document", "url", "conversation", "api", "template", "bulk"]).notNull(),
  sourceUrl: text("source_url"),
  sourceFilename: varchar("source_filename", { length: 500 }),
  status: mysqlEnum("status_col", ["pending", "processing", "completed", "failed"]).notNull().default("pending"),
  articlesCreated: int("articles_created").notNull().default(0),
  articlesUpdated: int("articles_updated").notNull().default(0),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  error: text("error"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type KnowledgeIngestionJob = typeof knowledgeIngestionJobs.$inferSelect;

// ─── Capability Modes ────────────────────────────────────────────────────
export const capabilityModes = mysqlTable("capability_modes", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  icon: varchar("icon", { length: 50 }),
  systemPromptAdditions: text("system_prompt_additions"),
  requiredKnowledgeCategories: json("required_knowledge_categories"),
  availableTools: json("available_tools"),
  availableModels: json("available_models"),
  defaultForRoles: json("default_for_roles"),
  active: mysqlBoolean("active").notNull().default(true),
  sortOrder: int("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type CapabilityMode = typeof capabilityModes.$inferSelect;

// ─── AI Tools Registry ───────────────────────────────────────────────────
export const aiTools = mysqlTable("ai_tools", {
  id: int("id").autoincrement().primaryKey(),
  toolName: varchar("tool_name", { length: 200 }).notNull(),
  toolType: mysqlEnum("tool_type", ["calculator", "model", "action", "query", "report"]).notNull(),
  description: text("description").notNull(),
  inputSchema: json("input_schema").notNull(),
  outputSchema: json("output_schema"),
  trpcProcedure: varchar("trpc_procedure", { length: 200 }).notNull(),
  requiresAuth: mysqlBoolean("requires_auth").notNull().default(true),
  requiresConfirmation: mysqlBoolean("requires_confirmation").notNull().default(false),
  usageCount: int("usage_count").notNull().default(0),
  successRate: float("success_rate").default(1.0),
  active: mysqlBoolean("active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type AiTool = typeof aiTools.$inferSelect;

export const aiToolCalls = mysqlTable("ai_tool_calls", {
  id: int("id").autoincrement().primaryKey(),
  toolId: int("tool_id").notNull(),
  conversationId: int("conversation_id"),
  messageId: int("message_id"),
  userId: int("user_id"),
  inputJson: json("input_json"),
  outputJson: json("output_json"),
  success: mysqlBoolean("success").notNull().default(true),
  latencyMs: int("latency_ms"),
  userModifiedInput: mysqlBoolean("user_modified_input").notNull().default(false),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type AiToolCall = typeof aiToolCalls.$inferSelect;

// ─── Study Progress ──────────────────────────────────────────────────────
export const studyProgress = mysqlTable("study_progress", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  certification: varchar("certification", { length: 100 }).notNull(),
  topicsCovered: json("topics_covered"),
  quizScores: json("quiz_scores"),
  weakAreas: json("weak_areas"),
  studyTimeMinutes: int("study_time_minutes").notNull().default(0),
  totalQuestionsAttempted: int("total_questions_attempted").notNull().default(0),
  totalQuestionsCorrect: int("total_questions_correct").notNull().default(0),
  currentDifficulty: mysqlEnum("current_difficulty", ["beginner", "intermediate", "advanced"]).notNull().default("beginner"),
  lastSessionAt: timestamp("last_session_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type StudyProgressRecord = typeof studyProgress.$inferSelect;


// ─── Export Jobs ────────────────────────────────────────────────────────────
export const exportJobs = mysqlTable("export_jobs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  orgId: int("org_id"),
  format: mysqlEnum("format", ["csv", "excel", "pdf", "docx", "json"]).notNull().default("csv"),
  entityType: varchar("entity_type", { length: 100 }).notNull(),
  filters: json("filters"),
  status: mysqlEnum("status", ["pending", "processing", "completed", "failed"]).notNull().default("pending"),
  fileUrl: text("file_url"),
  fileKey: text("file_key"),
  rowCount: int("row_count").default(0),
  errorMessage: text("error_message"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type ExportJob = typeof exportJobs.$inferSelect;

// ─── Document Templates ────────────────────────────────────────────────────
export const documentTemplates = mysqlTable("document_templates", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("org_id"),
  name: varchar("name", { length: 255 }).notNull(),
  category: mysqlEnum("category", ["compliance", "client_report", "proposal", "agreement", "disclosure", "meeting_notes", "review", "planning", "custom"]).notNull().default("custom"),
  description: text("description"),
  templateBody: text("template_body").notNull(),
  variables: json("variables"),
  outputFormat: mysqlEnum("output_format", ["pdf", "docx", "html"]).notNull().default("pdf"),
  isSystem: mysqlBoolean("is_system").notNull().default(false),
  active: mysqlBoolean("active").notNull().default(true),
  version: int("version").notNull().default(1),
  createdBy: int("created_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type DocumentTemplate = typeof documentTemplates.$inferSelect;

// ─── MFA Secrets ────────────────────────────────────────────────────────────
export const mfaSecrets = mysqlTable("mfa_secrets", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  secret: varchar("secret", { length: 255 }).notNull(),
  method: mysqlEnum("method", ["totp", "sms", "email"]).notNull().default("totp"),
  verified: mysqlBoolean("verified").notNull().default(false),
  enabled: mysqlBoolean("enabled").notNull().default(false),
  lastUsedAt: timestamp("last_used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type MfaSecret = typeof mfaSecrets.$inferSelect;

// ─── MFA Backup Codes ──────────────────────────────────────────────────────
export const mfaBackupCodes = mysqlTable("mfa_backup_codes", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  codeHash: varchar("code_hash", { length: 255 }).notNull(),
  used: mysqlBoolean("used").notNull().default(false),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type MfaBackupCode = typeof mfaBackupCodes.$inferSelect;

// ─── Model Cards ────────────────────────────────────────────────────────────
export const modelCards = mysqlTable("model_cards", {
  id: int("id").autoincrement().primaryKey(),
  modelName: varchar("model_name", { length: 255 }).notNull(),
  version: varchar("version", { length: 50 }).notNull().default("1.0"),
  description: text("description"),
  intendedUse: text("intended_use"),
  limitations: text("limitations"),
  trainingDataSummary: text("training_data_summary"),
  performanceMetrics: json("performance_metrics"),
  fairnessMetrics: json("fairness_metrics"),
  ethicalConsiderations: text("ethical_considerations"),
  updateFrequency: varchar("update_frequency", { length: 100 }),
  lastEvaluatedAt: timestamp("last_evaluated_at"),
  published: mysqlBoolean("published").notNull().default(false),
  createdBy: int("created_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type ModelCard = typeof modelCards.$inferSelect;

// ─── COI Disclosures ────────────────────────────────────────────────────────
export const coiDisclosures = mysqlTable("coi_disclosures", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  advisorId: int("advisor_id"),
  orgId: int("org_id"),
  disclosureType: mysqlEnum("disclosure_type", ["compensation", "affiliation", "ownership", "referral", "other"]).notNull(),
  description: text("description").notNull(),
  relatedProductId: int("related_product_id"),
  relatedRecommendationId: int("related_recommendation_id"),
  severity: mysqlEnum("severity", ["low", "medium", "high"]).notNull().default("medium"),
  status: mysqlEnum("status", ["pending", "disclosed", "acknowledged", "resolved"]).notNull().default("pending"),
  disclosedAt: timestamp("disclosed_at"),
  acknowledgedAt: timestamp("acknowledged_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type CoiDisclosure = typeof coiDisclosures.$inferSelect;

// ─── Recommendations Log ────────────────────────────────────────────────────
export const recommendationsLog = mysqlTable("recommendations_log", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  advisorId: int("advisor_id"),
  conversationId: int("conversation_id"),
  messageId: int("message_id"),
  productId: int("product_id"),
  recommendationType: mysqlEnum("recommendation_type", ["product", "strategy", "action", "allocation", "rebalance"]).notNull(),
  summary: text("summary").notNull(),
  reasoning: text("reasoning"),
  factors: json("factors"),
  confidenceScore: float("confidence_score"),
  suitabilityScore: float("suitability_score"),
  riskLevel: mysqlEnum("risk_level", ["low", "medium", "high", "very_high"]),
  disclaimers: json("disclaimers"),
  coiDisclosureIds: json("coi_disclosure_ids"),
  status: mysqlEnum("status", ["suggested", "accepted", "rejected", "implemented", "expired"]).notNull().default("suggested"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type RecommendationLog = typeof recommendationsLog.$inferSelect;

// ─── Report Templates ───────────────────────────────────────────────────────
export const reportTemplates = mysqlTable("report_templates", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("org_id"),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  category: mysqlEnum("category", ["portfolio_review", "financial_plan", "insurance_analysis", "tax_summary", "estate_plan", "quarterly_report", "annual_review", "custom"]).notNull().default("custom"),
  templateBody: text("template_body").notNull(),
  sections: json("sections"),
  branding: json("branding"),
  isSystem: mysqlBoolean("is_system").notNull().default(false),
  active: mysqlBoolean("active").notNull().default(true),
  createdBy: int("created_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type ReportTemplate = typeof reportTemplates.$inferSelect;

// ─── Report Jobs ────────────────────────────────────────────────────────────
export const reportJobs = mysqlTable("report_jobs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  orgId: int("org_id"),
  templateId: int("template_id").notNull(),
  clientId: int("client_id"),
  parameters: json("parameters"),
  status: mysqlEnum("status", ["pending", "generating", "completed", "failed"]).notNull().default("pending"),
  outputUrl: text("output_url"),
  outputKey: text("output_key"),
  outputFormat: mysqlEnum("output_format", ["pdf", "docx", "html"]).notNull().default("pdf"),
  errorMessage: text("error_message"),
  scheduledAt: timestamp("scheduled_at"),
  recurringCron: varchar("recurring_cron", { length: 100 }),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type ReportJob = typeof reportJobs.$inferSelect;

// ─── Paper Trades ───────────────────────────────────────────────────────────
export const paperTrades = mysqlTable("paper_trades", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  symbol: varchar("symbol", { length: 20 }).notNull(),
  tradeType: mysqlEnum("trade_type", ["buy", "sell"]).notNull(),
  quantity: decimal("quantity", { precision: 18, scale: 6 }).notNull(),
  price: decimal("price", { precision: 18, scale: 6 }).notNull(),
  totalValue: decimal("total_value", { precision: 18, scale: 2 }).notNull(),
  aiSuggested: mysqlBoolean("ai_suggested").notNull().default(false),
  aiReasoning: text("ai_reasoning"),
  actualPriceAtClose: decimal("actual_price_at_close", { precision: 18, scale: 6 }),
  pnl: decimal("pnl", { precision: 18, scale: 2 }),
  pnlPercent: float("pnl_percent"),
  status: mysqlEnum("status", ["open", "closed", "cancelled"]).notNull().default("open"),
  openedAt: timestamp("opened_at").defaultNow().notNull(),
  closedAt: timestamp("closed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type PaperTrade = typeof paperTrades.$inferSelect;

// ─── Prompt Interactions ────────────────────────────────────────────────────
export const promptInteractions = mysqlTable("prompt_interactions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  promptText: text("prompt_text").notNull(),
  promptCategory: varchar("prompt_category", { length: 100 }),
  source: mysqlEnum("source", ["suggested", "typed", "voice", "command_palette"]).notNull().default("typed"),
  wasSuggested: mysqlBoolean("was_suggested").notNull().default(false),
  wasClicked: mysqlBoolean("was_clicked").notNull().default(false),
  responseQualityScore: float("response_quality_score"),
  sessionContext: json("session_context"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type PromptInteraction = typeof promptInteractions.$inferSelect;

// ─── Consent Tracking ───────────────────────────────────────────────────────
export const consentTracking = mysqlTable("consent_tracking", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  consentType: mysqlEnum("consent_type", ["ai_chat", "voice", "doc_upload", "data_sharing", "marketing", "analytics", "third_party"]).notNull(),
  granted: mysqlBoolean("granted").notNull().default(false),
  grantedAt: timestamp("granted_at"),
  revokedAt: timestamp("revoked_at"),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  version: varchar("version", { length: 50 }).notNull().default("1.0"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type ConsentTrackingRecord = typeof consentTracking.$inferSelect;

// ─── Performance Metrics ────────────────────────────────────────────────────
export const performanceMetrics = mysqlTable("performance_metrics", {
  id: int("id").autoincrement().primaryKey(),
  metricName: varchar("metric_name", { length: 255 }).notNull(),
  metricCategory: mysqlEnum("metric_category", ["latency", "throughput", "error_rate", "availability", "ai_quality", "user_satisfaction"]).notNull(),
  value: float("value").notNull(),
  unit: varchar("unit", { length: 50 }),
  tags: json("tags"),
  slaTarget: float("sla_target"),
  slaMet: mysqlBoolean("sla_met"),
  recordedAt: timestamp("recorded_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type PerformanceMetric = typeof performanceMetrics.$inferSelect;

// ─── Browser Sessions ───────────────────────────────────────────────────────
export const browserSessions = mysqlTable("browser_sessions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  agentRunId: int("agent_run_id"),
  targetUrl: text("target_url").notNull(),
  status: mysqlEnum("status", ["initializing", "active", "completed", "failed", "timeout"]).notNull().default("initializing"),
  actionsLog: json("actions_log"),
  screenshots: json("screenshots"),
  domain: varchar("domain", { length: 255 }),
  allowed: mysqlBoolean("allowed").notNull().default(false),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  endedAt: timestamp("ended_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type BrowserSession = typeof browserSessions.$inferSelect;

// ─── Workflow Checkpoints ───────────────────────────────────────────────────
export const workflowCheckpoints = mysqlTable("workflow_checkpoints", {
  id: int("id").autoincrement().primaryKey(),
  workflowId: int("workflow_id").notNull(),
  agentRunId: int("agent_run_id"),
  stepIndex: int("step_index").notNull().default(0),
  stepName: varchar("step_name", { length: 255 }),
  state: json("state"),
  status: mysqlEnum("status", ["saved", "restored", "compensating", "compensated", "failed"]).notNull().default("saved"),
  compensationAction: text("compensation_action"),
  retryCount: int("retry_count").notNull().default(0),
  maxRetries: int("max_retries").notNull().default(3),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type WorkflowCheckpoint = typeof workflowCheckpoints.$inferSelect;


// ─── EXPONENTIAL ENGINE ─────────────────────────────────────────────────────
// Tracks user platform interactions to build progressively richer AI context

// Platform events: every meaningful user action
export const userPlatformEvents = mysqlTable("user_platform_events", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  eventType: varchar("event_type", { length: 64 }).notNull(), // page_visit, feature_use, button_click, setting_change, chat_topic, integration_connect, doc_upload
  featureKey: varchar("feature_key", { length: 128 }).notNull(), // e.g. "intelligence_hub", "voice_mode", "iul_calculator", "suitability"
  metadata: json("metadata"), // { page: "/intelligence", action: "run_model", duration_ms: 12000, ... }
  sessionId: varchar("session_id", { length: 64 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type UserPlatformEvent = typeof userPlatformEvents.$inferSelect;
export type InsertUserPlatformEvent = typeof userPlatformEvents.$inferInsert;

// Feature proficiency: aggregated per-user per-feature scores
export const userFeatureProficiency = mysqlTable("user_feature_proficiency", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  featureKey: varchar("feature_key", { length: 128 }).notNull(),
  featureLabel: varchar("feature_label", { length: 256 }).notNull(), // human-readable name
  category: varchar("category", { length: 64 }).notNull(), // navigation, tools, settings, integrations, ai_features
  totalInteractions: int("total_interactions").notNull().default(0),
  totalDurationMs: bigint("total_duration_ms", { mode: "number" }).notNull().default(0),
  proficiencyScore: float("proficiency_score").notNull().default(0), // 0-100 scale
  proficiencyLevel: mysqlEnum("proficiency_level", ["undiscovered", "novice", "familiar", "proficient", "expert"]).notNull().default("undiscovered"),
  firstUsedAt: timestamp("first_used_at"),
  lastUsedAt: timestamp("last_used_at"),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type UserFeatureProficiency = typeof userFeatureProficiency.$inferSelect;
export type InsertUserFeatureProficiency = typeof userFeatureProficiency.$inferInsert;

// Platform changelog: tracks new/updated features so AI can inform users
export const platformChangelog = mysqlTable("platform_changelog", {
  id: int("id").autoincrement().primaryKey(),
  version: varchar("version", { length: 32 }).notNull(),
  title: varchar("title", { length: 256 }).notNull(),
  description: text("description").notNull(),
  featureKeys: json("feature_keys"), // ["intelligence_hub", "voice_mode"] — affected features
  changeType: mysqlEnum("change_type", ["new_feature", "improvement", "fix", "removal"]).notNull(),
  impactedRoles: json("impacted_roles"), // ["user", "admin", "professional"] — who should know
  announcedAt: timestamp("announced_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type PlatformChangelog = typeof platformChangelog.$inferSelect;
export type InsertPlatformChangelog = typeof platformChangelog.$inferInsert;

// User changelog awareness: tracks which changelog entries each user has been informed about
export const userChangelogAwareness = mysqlTable("user_changelog_awareness", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  changelogId: int("changelog_id").notNull(),
  informedVia: mysqlEnum("informed_via", ["ai_chat", "notification", "changelog_page", "onboarding"]).notNull(),
  informedAt: timestamp("informed_at").defaultNow().notNull(),
});
export type UserChangelogAwareness = typeof userChangelogAwareness.$inferSelect;

// ─── SELF-DISCOVERY HISTORY ──────────────────────────────────────────────
// Tracks AI-generated follow-up exploration queries triggered by idle detection
export const selfDiscoveryHistory = mysqlTable("self_discovery_history", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  conversationId: int("conversation_id").notNull(),
  triggerMessageId: int("trigger_message_id"),
  lastUserQuery: text("last_user_query"),
  lastAiResponse: text("last_ai_response"),
  generatedQuery: text("generated_query").notNull(),
  direction: mysqlEnum("direction", ["deeper", "broader", "applied"]).notNull(),
  layerContext: varchar("layer_context", { length: 32 }),
  proficiencyLevel: varchar("proficiency_level", { length: 32 }),
  featureContext: json("feature_context"),
  status: mysqlEnum("status", ["generated", "sent", "dismissed", "completed"]).default("generated"),
  userEngaged: mysqlBoolean("user_engaged").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type SelfDiscoveryEntry = typeof selfDiscoveryHistory.$inferSelect;


// ─── INTEGRATION HEALTH CHECKS (Periodic health monitoring) ────────────────
export const integrationHealthChecks = mysqlTable("integration_health_checks", {
  id: varchar("id", { length: 36 }).primaryKey(),
  connectionId: varchar("connection_id", { length: 36 }).notNull(),
  providerId: varchar("provider_id", { length: 36 }).notNull(),
  checkType: mysqlEnum("check_type", ["connectivity", "auth", "data_freshness", "rate_limit", "schema_drift"]).notNull(),
  status: mysqlEnum("status", ["healthy", "degraded", "unhealthy", "unknown"]).notNull(),
  latencyMs: int("latency_ms"),
  responseCode: int("response_code"),
  errorMessage: text("error_message"),
  metadata: json("metadata"), // Additional check-specific data (e.g., rate limit remaining, data age)
  checkedAt: timestamp("checked_at").defaultNow().notNull(),
});
export type IntegrationHealthCheck = typeof integrationHealthChecks.$inferSelect;

// ─── INTEGRATION HEALTH SUMMARY (Aggregated health per connection) ─────────
export const integrationHealthSummary = mysqlTable("integration_health_summary", {
  id: varchar("id", { length: 36 }).primaryKey(),
  connectionId: varchar("connection_id", { length: 36 }).notNull(),
  overallStatus: mysqlEnum("overall_status", ["healthy", "degraded", "unhealthy", "unknown"]).default("unknown"),
  uptimePercent: decimal("uptime_percent", { precision: 5, scale: 2 }).default("0"),
  avgLatencyMs: int("avg_latency_ms"),
  checksTotal: int("checks_total").default(0),
  checksHealthy: int("checks_healthy").default(0),
  checksFailed: int("checks_failed").default(0),
  lastHealthyAt: timestamp("last_healthy_at"),
  lastUnhealthyAt: timestamp("last_unhealthy_at"),
  consecutiveFailures: int("consecutive_failures").default(0),
  dataFreshnessMinutes: int("data_freshness_minutes"),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type IntegrationHealthSummaryRow = typeof integrationHealthSummary.$inferSelect;

// ─── INTEGRATION IMPROVEMENT LOG (Agent-based continuous improvement) ──────
export const integrationImprovementLog = mysqlTable("integration_improvement_log", {
  id: varchar("id", { length: 36 }).primaryKey(),
  connectionId: varchar("connection_id", { length: 36 }),
  providerId: varchar("provider_id", { length: 36 }),
  actionType: mysqlEnum("action_type", [
    "auto_reconnect", "key_rotation_reminder", "rate_limit_backoff",
    "schema_migration", "data_quality_alert", "performance_optimization",
    "degradation_detected", "recovery_confirmed", "user_notification",
    "ai_context_updated", "feature_suggestion"
  ]).notNull(),
  severity: mysqlEnum("severity", ["info", "warning", "critical"]).default("info"),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  suggestedAction: text("suggested_action"),
  actionTaken: text("action_taken"),
  resolvedAt: timestamp("resolved_at"),
  resolvedBy: varchar("resolved_by", { length: 100 }),
  aiGenerated: mysqlBoolean("ai_generated").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type IntegrationImprovementLogEntry = typeof integrationImprovementLog.$inferSelect;

// ═══════════════════════════════════════════════════════════════════════════
// SNAPTRADE — Per-User Brokerage Connections
// ═══════════════════════════════════════════════════════════════════════════

// ─── SNAPTRADE USER REGISTRATIONS (Per-user SnapTrade identity) ──────────
export const snapTradeUsers = mysqlTable("snaptrade_users", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: int("user_id").notNull(),
  snapTradeUserId: varchar("snaptrade_user_id", { length: 200 }).notNull(),
  snapTradeUserSecretEncrypted: text("snaptrade_user_secret_encrypted").notNull(),
  status: mysqlEnum("status", ["active", "disabled", "deleted"]).default("active").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type SnapTradeUser = typeof snapTradeUsers.$inferSelect;

// ─── SNAPTRADE BROKERAGE CONNECTIONS (Per-user brokerage links) ──────────
export const snapTradeBrokerageConnections = mysqlTable("snaptrade_brokerage_connections", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: int("user_id").notNull(),
  snapTradeUserId: varchar("snaptrade_user_id", { length: 36 }).notNull(),
  brokerageAuthorizationId: varchar("brokerage_authorization_id", { length: 200 }).notNull(),
  brokerageName: varchar("brokerage_name", { length: 200 }),
  brokerageType: varchar("brokerage_type", { length: 100 }),
  status: mysqlEnum("status", ["active", "disabled", "error", "deleted"]).default("active").notNull(),
  disabledReason: text("disabled_reason"),
  lastSyncAt: timestamp("last_sync_at"),
  lastSyncStatus: mysqlEnum("last_sync_status", ["success", "partial", "failed"]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type SnapTradeBrokerageConnection = typeof snapTradeBrokerageConnections.$inferSelect;

// ─── SNAPTRADE ACCOUNTS (Brokerage accounts discovered per connection) ───
export const snapTradeAccounts = mysqlTable("snaptrade_accounts", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: int("user_id").notNull(),
  connectionId: varchar("connection_id", { length: 36 }).notNull(),
  snapTradeAccountId: varchar("snaptrade_account_id", { length: 200 }).notNull(),
  accountName: varchar("account_name", { length: 200 }),
  accountNumber: varchar("account_number", { length: 100 }),
  accountType: varchar("account_type", { length: 100 }),
  institutionName: varchar("institution_name", { length: 200 }),
  cashBalance: decimal("cash_balance", { precision: 18, scale: 4 }),
  marketValue: decimal("market_value", { precision: 18, scale: 4 }),
  totalValue: decimal("total_value", { precision: 18, scale: 4 }),
  currency: varchar("currency", { length: 10 }).default("USD"),
  lastSyncAt: timestamp("last_sync_at"),
  syncDataJson: json("sync_data_json"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type SnapTradeAccount = typeof snapTradeAccounts.$inferSelect;

// ─── SNAPTRADE POSITIONS (Holdings per account) ──────────────────────────
export const snapTradePositions = mysqlTable("snaptrade_positions", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: int("user_id").notNull(),
  accountId: varchar("account_id", { length: 36 }).notNull(),
  symbolTicker: varchar("symbol_ticker", { length: 20 }),
  symbolName: varchar("symbol_name", { length: 300 }),
  symbolType: varchar("symbol_type", { length: 50 }),
  units: decimal("units", { precision: 18, scale: 8 }),
  averagePrice: decimal("average_price", { precision: 18, scale: 4 }),
  currentPrice: decimal("current_price", { precision: 18, scale: 4 }),
  marketValue: decimal("market_value", { precision: 18, scale: 4 }),
  currency: varchar("currency", { length: 10 }).default("USD"),
  rawJson: json("raw_json"),
  lastSyncAt: timestamp("last_sync_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type SnapTradePosition = typeof snapTradePositions.$inferSelect;


// ─── PROFESSIONAL VERIFICATIONS ─────────────────────────────────────────
// DB table: professional_verifications
export const professionalVerifications = mysqlTable("professional_verifications", {
  id: int("id").autoincrement().primaryKey(),
  professionalId: int("professional_id").notNull(),
  verificationSource: mysqlEnum("verification_source", [
    "finra_brokercheck", "sec_iapd", "cfp_board", "nasba_cpaverify",
    "nipr_pdb", "nmls", "state_bar", "ibba", "martindale", "avvo"
  ]).notNull(),
  verificationStatus: mysqlEnum("verification_status", [
    "verified", "not_found", "flagged", "expired", "pending"
  ]).notNull(),
  externalId: varchar("external_id", { length: 100 }),
  externalUrl: varchar("external_url", { length: 500 }),
  rawData: json("raw_data"),
  disclosures: json("disclosures"),
  licenseStates: json("license_states"),
  licenseExpiration: timestamp("license_expiration"),
  verifiedAt: bigint("verified_at", { mode: "number" }).notNull(),
  expiresAt: bigint("expires_at", { mode: "number" }),
  verificationMethod: mysqlEnum("verification_method", [
    "api", "scrape", "manual", "n8n_workflow"
  ]).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type ProfessionalVerification = typeof professionalVerifications.$inferSelect;
export type InsertProfessionalVerification = typeof professionalVerifications.$inferInsert;

// ─── COI VERIFICATION BADGES ────────────────────────────────────────────
// DB table: coi_verification_badges
export const coiVerificationBadges = mysqlTable("coi_verification_badges", {
  id: int("id").autoincrement().primaryKey(),
  coiContactId: int("coi_contact_id"),
  professionalId: int("professional_id"),
  badgeType: mysqlEnum("badge_type", [
    "license_active", "cfp_certified", "cpa_active", "bar_good_standing",
    "nmls_authorized", "nipr_licensed", "cbi_certified", "no_disclosures",
    "fiduciary", "am_best_rated", "peer_rated"
  ]).notNull(),
  badgeLabel: varchar("badge_label", { length: 100 }),
  badgeData: json("badge_data"),
  confidenceScore: decimal("confidence_score", { precision: 3, scale: 2 }),
  sourceVerificationId: int("source_verification_id"),
  grantedAt: bigint("granted_at", { mode: "number" }).notNull(),
  expiresAt: bigint("expires_at", { mode: "number" }),
  active: mysqlBoolean("active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type CoiVerificationBadge = typeof coiVerificationBadges.$inferSelect;
export type InsertCoiVerificationBadge = typeof coiVerificationBadges.$inferInsert;

// ─── VERIFICATION SCHEDULES ─────────────────────────────────────────────
// DB table: verification_schedules
export const verificationSchedules = mysqlTable("verification_schedules", {
  id: int("id").autoincrement().primaryKey(),
  professionalId: int("professional_id").notNull(),
  verificationSource: mysqlEnum("verification_source", [
    "finra_brokercheck", "sec_iapd", "cfp_board", "nasba_cpaverify",
    "nipr_pdb", "nmls", "state_bar", "ibba", "martindale", "avvo"
  ]).notNull(),
  frequencyDays: int("frequency_days").notNull().default(30),
  lastRunAt: bigint("last_run_at", { mode: "number" }),
  nextRunAt: bigint("next_run_at", { mode: "number" }).notNull(),
  enabled: mysqlBoolean("enabled").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type VerificationSchedule = typeof verificationSchedules.$inferSelect;
export type InsertVerificationSchedule = typeof verificationSchedules.$inferInsert;

// ─── PREMIUM FINANCE RATES ──────────────────────────────────────────────
// DB table: premium_finance_rates
export const premiumFinanceRates = mysqlTable("premium_finance_rates", {
  id: int("id").autoincrement().primaryKey(),
  rateDate: date("rate_date").notNull(),
  sofr: decimal("sofr", { precision: 6, scale: 4 }),
  sofr30: decimal("sofr_30", { precision: 6, scale: 4 }),
  sofr90: decimal("sofr_90", { precision: 6, scale: 4 }),
  treasury10y: decimal("treasury_10y", { precision: 6, scale: 4 }),
  treasury30y: decimal("treasury_30y", { precision: 6, scale: 4 }),
  primeRate: decimal("prime_rate", { precision: 6, scale: 4 }),
  fetchedAt: bigint("fetched_at", { mode: "number" }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type PremiumFinanceRate = typeof premiumFinanceRates.$inferSelect;
export type InsertPremiumFinanceRate = typeof premiumFinanceRates.$inferInsert;

// ============================================================
// DATA SEEDING & PRODUCT INTELLIGENCE TABLES (Prompt 2)
// ============================================================

// --- Phase 1: Tax & Government Data Seeds ---

export const taxParameters = mysqlTable("tax_parameters", {
  id: int("id").autoincrement().primaryKey(),
  taxYear: int("tax_year").notNull(),
  parameterName: varchar("parameter_name", { length: 100 }).notNull(),
  parameterCategory: varchar("parameter_category", { length: 50 }).notNull(),
  filingStatus: varchar("filing_status", { length: 50 }).default("all"),
  valueJson: json("value_json").notNull(),
  sourceUrl: varchar("source_url", { length: 500 }),
  effectiveDate: varchar("effective_date", { length: 20 }).notNull(),
  expiryDate: varchar("expiry_date", { length: 20 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type TaxParameter = typeof taxParameters.$inferSelect;
export type InsertTaxParameter = typeof taxParameters.$inferInsert;

export const ssaParameters = mysqlTable("ssa_parameters", {
  id: int("id").autoincrement().primaryKey(),
  parameterYear: int("parameter_year").notNull(),
  parameterName: varchar("parameter_name", { length: 100 }).notNull(),
  valueJson: json("value_json").notNull(),
  sourceUrl: varchar("source_url", { length: 500 }),
  effectiveDate: varchar("effective_date", { length: 20 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type SsaParameter = typeof ssaParameters.$inferSelect;
export type InsertSsaParameter = typeof ssaParameters.$inferInsert;

export const ssaLifeTables = mysqlTable("ssa_life_tables", {
  id: int("id").autoincrement().primaryKey(),
  age: int("age").notNull(),
  sex: varchar("sex", { length: 10 }).notNull(),
  probabilityOfDeath: varchar("probability_of_death", { length: 20 }).notNull(),
  lifeExpectancy: varchar("life_expectancy", { length: 10 }).notNull(),
  tableYear: int("table_year").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type SsaLifeTable = typeof ssaLifeTables.$inferSelect;
export type InsertSsaLifeTable = typeof ssaLifeTables.$inferInsert;

export const medicareParameters = mysqlTable("medicare_parameters", {
  id: int("id").autoincrement().primaryKey(),
  parameterYear: int("parameter_year").notNull(),
  parameterName: varchar("parameter_name", { length: 100 }).notNull(),
  valueJson: json("value_json").notNull(),
  sourceUrl: varchar("source_url", { length: 500 }),
  effectiveDate: varchar("effective_date", { length: 20 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type MedicareParameter = typeof medicareParameters.$inferSelect;
export type InsertMedicareParameter = typeof medicareParameters.$inferInsert;

// --- Phase 2: Insurance Product & Carrier Data ---

export const insuranceCarriers = mysqlTable("insurance_carriers", {
  id: int("id").autoincrement().primaryKey(),
  carrierName: varchar("carrier_name", { length: 200 }).notNull(),
  carrierNameAliases: json("carrier_name_aliases"),
  amBestId: varchar("am_best_id", { length: 50 }),
  amBestFsr: varchar("am_best_fsr", { length: 10 }),
  amBestFsrNumeric: int("am_best_fsr_numeric"),
  amBestOutlook: varchar("am_best_outlook", { length: 20 }),
  spRating: varchar("sp_rating", { length: 10 }),
  moodysRating: varchar("moodys_rating", { length: 10 }),
  fitchRating: varchar("fitch_rating", { length: 10 }),
  naicId: varchar("naic_id", { length: 20 }),
  domicileState: varchar("domicile_state", { length: 2 }),
  companyType: varchar("company_type", { length: 20 }),
  yearFounded: int("year_founded"),
  totalAssetsBillions: varchar("total_assets_billions", { length: 20 }),
  statutorySurplusBillions: varchar("statutory_surplus_billions", { length: 20 }),
  complaintRatio: varchar("complaint_ratio", { length: 10 }),
  productLines: json("product_lines"),
  ratingLastUpdated: varchar("rating_last_updated", { length: 20 }),
  active: mysqlBoolean("active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type InsuranceCarrier = typeof insuranceCarriers.$inferSelect;
export type InsertInsuranceCarrier = typeof insuranceCarriers.$inferInsert;

export const insuranceProducts = mysqlTable("insurance_products", {
  id: int("id").autoincrement().primaryKey(),
  carrierId: int("carrier_id").notNull(),
  productName: varchar("product_name", { length: 200 }).notNull(),
  productType: varchar("product_type", { length: 50 }).notNull(),
  productCategory: varchar("product_category", { length: 30 }).notNull(),
  features: json("features"),
  minFaceAmount: varchar("min_face_amount", { length: 20 }),
  maxFaceAmount: varchar("max_face_amount", { length: 20 }),
  minIssueAge: int("min_issue_age"),
  maxIssueAge: int("max_issue_age"),
  underwritingTypes: json("underwriting_types"),
  ridersAvailable: json("riders_available"),
  stateAvailability: json("state_availability"),
  compulifeProductId: varchar("compulife_product_id", { length: 50 }),
  active: mysqlBoolean("active").default(true),
  lastRateUpdate: varchar("last_rate_update", { length: 20 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type InsuranceProduct = typeof insuranceProducts.$inferSelect;
export type InsertInsuranceProduct = typeof insuranceProducts.$inferInsert;

export const iulCreditingHistory = mysqlTable("iul_crediting_history", {
  id: int("id").autoincrement().primaryKey(),
  productId: int("product_id").notNull(),
  effectiveDate: varchar("effective_date", { length: 20 }).notNull(),
  indexStrategy: varchar("index_strategy", { length: 100 }).notNull(),
  capRate: varchar("cap_rate", { length: 10 }),
  participationRate: varchar("participation_rate", { length: 10 }),
  floorRate: varchar("floor_rate", { length: 10 }),
  spread: varchar("spread", { length: 10 }),
  multiplierBonus: varchar("multiplier_bonus", { length: 10 }),
  source: varchar("source", { length: 30 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type IulCreditingHistoryRow = typeof iulCreditingHistory.$inferSelect;
export type InsertIulCreditingHistory = typeof iulCreditingHistory.$inferInsert;

// --- Phase 3: Investment Intelligence ---

export const marketIndexHistory = mysqlTable("market_index_history", {
  id: int("id").autoincrement().primaryKey(),
  indexSymbol: varchar("index_symbol", { length: 20 }).notNull(),
  date: varchar("date", { length: 20 }).notNull(),
  openPrice: varchar("open_price", { length: 20 }),
  closePrice: varchar("close_price", { length: 20 }),
  dailyReturn: varchar("daily_return", { length: 20 }),
  totalReturnIndex: varchar("total_return_index", { length: 20 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type MarketIndexHistoryRow = typeof marketIndexHistory.$inferSelect;
export type InsertMarketIndexHistory = typeof marketIndexHistory.$inferInsert;

export const economicHistory = mysqlTable("economic_history", {
  id: int("id").autoincrement().primaryKey(),
  date: varchar("date", { length: 20 }).notNull(),
  metricName: varchar("metric_name", { length: 50 }).notNull(),
  value: varchar("value", { length: 20 }),
  source: varchar("source", { length: 50 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type EconomicHistoryRow = typeof economicHistory.$inferSelect;
export type InsertEconomicHistory = typeof economicHistory.$inferInsert;

// --- Phase 4: Estate & Planning Data ---

export const industryBenchmarks = mysqlTable("industry_benchmarks", {
  id: int("id").autoincrement().primaryKey(),
  benchmarkCategory: varchar("benchmark_category", { length: 100 }).notNull(),
  benchmarkName: varchar("benchmark_name", { length: 200 }).notNull(),
  benchmarkValue: varchar("benchmark_value", { length: 20 }),
  benchmarkUnit: varchar("benchmark_unit", { length: 50 }),
  reportingPeriod: varchar("reporting_period", { length: 20 }),
  source: varchar("source", { length: 100 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type IndustryBenchmark = typeof industryBenchmarks.$inferSelect;
export type InsertIndustryBenchmark = typeof industryBenchmarks.$inferInsert;

// --- Phase 5: Professional-Layer Data Seeds ---

export const nitrogenRiskProfiles = mysqlTable("nitrogen_risk_profiles", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  nitrogenRiskNumber: int("nitrogen_risk_number"),
  portfolioRiskNumber: int("portfolio_risk_number"),
  riskAlignmentScore: int("risk_alignment_score"),
  lastSyncedAt: bigint("last_synced_at", { mode: "number" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type NitrogenRiskProfile = typeof nitrogenRiskProfiles.$inferSelect;
export type InsertNitrogenRiskProfile = typeof nitrogenRiskProfiles.$inferInsert;

export const esignatureTracking = mysqlTable("esignature_tracking", {
  id: int("id").autoincrement().primaryKey(),
  professionalId: int("professional_id").notNull(),
  clientUserId: int("client_user_id"),
  envelopeId: varchar("envelope_id", { length: 100 }).notNull(),
  provider: varchar("provider", { length: 20 }).notNull(),
  documentType: varchar("document_type", { length: 100 }),
  status: varchar("status", { length: 20 }).notNull().default("created"),
  sentAt: bigint("sent_at", { mode: "number" }),
  signedAt: bigint("signed_at", { mode: "number" }),
  completedAt: bigint("completed_at", { mode: "number" }),
  relatedProductId: int("related_product_id"),
  relatedQuoteId: int("related_quote_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type EsignatureTrackingRow = typeof esignatureTracking.$inferSelect;
export type InsertEsignatureTracking = typeof esignatureTracking.$inferInsert;

// --- Phase 6: Client-Layer Expansion ---

export const plaidWebhookLog = mysqlTable("plaid_webhook_log", {
  id: int("id").autoincrement().primaryKey(),
  itemId: varchar("item_id", { length: 100 }),
  webhookType: varchar("webhook_type", { length: 50 }).notNull(),
  webhookCode: varchar("webhook_code", { length: 50 }).notNull(),
  errorCode: varchar("error_code", { length: 50 }),
  processedAt: bigint("processed_at", { mode: "number" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type PlaidWebhookLogRow = typeof plaidWebhookLog.$inferSelect;
export type InsertPlaidWebhookLog = typeof plaidWebhookLog.$inferInsert;

export const plaidHoldings = mysqlTable("plaid_holdings", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  accountId: varchar("account_id", { length: 100 }).notNull(),
  securityId: varchar("security_id", { length: 100 }),
  ticker: varchar("ticker", { length: 20 }),
  name: varchar("name", { length: 200 }),
  quantity: varchar("quantity", { length: 20 }),
  costBasis: varchar("cost_basis", { length: 20 }),
  currentValue: varchar("current_value", { length: 20 }),
  lastSynced: bigint("last_synced", { mode: "number" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type PlaidHolding = typeof plaidHoldings.$inferSelect;
export type InsertPlaidHolding = typeof plaidHoldings.$inferInsert;

export const creditProfiles = mysqlTable("credit_profiles", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  pullDate: varchar("pull_date", { length: 20 }).notNull(),
  creditScore: int("credit_score"),
  scoreModel: varchar("score_model", { length: 50 }),
  utilizationPercent: varchar("utilization_percent", { length: 10 }),
  totalDebt: varchar("total_debt", { length: 20 }),
  openAccounts: int("open_accounts"),
  derogatoryMarks: int("derogatory_marks"),
  hardInquiries: int("hard_inquiries"),
  oldestAccountYears: int("oldest_account_years"),
  consentId: int("consent_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type CreditProfile = typeof creditProfiles.$inferSelect;
export type InsertCreditProfile = typeof creditProfiles.$inferInsert;

// ─── FOUNDATION LAYER: SCRAPING ETHICS & RATE MANAGEMENT ────────────────

// Scraping audit log — every external request logged for accountability
export const scrapingAudit = mysqlTable("scraping_audit", {
  id: int("id").autoincrement().primaryKey(),
  provider: varchar("provider", { length: 100 }).notNull(),
  domain: varchar("domain", { length: 200 }).notNull(),
  endpoint: varchar("endpoint", { length: 500 }),
  method: mysqlEnum("method", ["GET", "POST", "PUT", "DELETE", "PATCH"]).default("GET"),
  statusCode: int("status_code"),
  responseTimeMs: int("response_time_ms"),
  rateLimitRemaining: int("rate_limit_remaining"),
  rateLimitReset: timestamp("rate_limit_reset"),
  userAgent: varchar("user_agent", { length: 500 }),
  robotsTxtChecked: mysqlBoolean("robots_txt_checked").default(false),
  robotsTxtAllowed: mysqlBoolean("robots_txt_allowed").default(true),
  cacheHit: mysqlBoolean("cache_hit").default(false),
  errorMessage: text("error_message"),
  requestHash: varchar("request_hash", { length: 64 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type ScrapingAudit = typeof scrapingAudit.$inferSelect;
export type InsertScrapingAudit = typeof scrapingAudit.$inferInsert;

// Scraping cache — aggressive caching to minimize external requests
export const scrapingCache = mysqlTable("scraping_cache", {
  id: int("id").autoincrement().primaryKey(),
  cacheKey: varchar("cache_key", { length: 256 }).notNull().unique(),
  provider: varchar("provider", { length: 100 }).notNull(),
  endpoint: varchar("endpoint", { length: 500 }),
  responseBody: text("response_body"),
  responseHeaders: json("response_headers"),
  statusCode: int("status_code"),
  ttlSeconds: int("ttl_seconds").default(86400),
  hitCount: int("hit_count").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
});

export type ScrapingCache = typeof scrapingCache.$inferSelect;
export type InsertScrapingCache = typeof scrapingCache.$inferInsert;

// Data freshness registry — tracks staleness of every data category
export const dataFreshnessRegistry = mysqlTable("data_freshness_registry", {
  id: int("id").autoincrement().primaryKey(),
  provider: varchar("provider", { length: 100 }).notNull(),
  dataCategory: varchar("data_category", { length: 100 }).notNull(),
  lastRefreshedAt: timestamp("last_refreshed_at"),
  nextRefreshAt: timestamp("next_refresh_at"),
  refreshIntervalHours: int("refresh_interval_hours").default(24),
  recordCount: int("record_count").default(0),
  status: mysqlEnum("status", ["fresh", "stale", "refreshing", "error", "paused"]).default("fresh"),
  consecutiveFailures: int("consecutive_failures").default(0),
  maxConsecutiveFailures: int("max_consecutive_failures").default(3),
  lastErrorMessage: text("last_error_message"),
  autoPaused: mysqlBoolean("auto_paused").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type DataFreshnessRegistry = typeof dataFreshnessRegistry.$inferSelect;
export type InsertDataFreshnessRegistry = typeof dataFreshnessRegistry.$inferInsert;

// Rate profiles — per-provider rate limiting configuration
export const rateProfiles = mysqlTable("rate_profiles", {
  id: int("id").autoincrement().primaryKey(),
  provider: varchar("provider", { length: 100 }).notNull().unique(),
  domain: varchar("domain", { length: 200 }).notNull(),
  currentRpm: int("current_rpm").notNull().default(10),
  discoveredLimit: int("discovered_limit"),
  staticMaximum: int("static_maximum").notNull().default(60),
  safetyFactor: decimal("safety_factor", { precision: 3, scale: 2 }).default("0.70"),
  dailyBudget: int("daily_budget").default(1000),
  dailyUsed: int("daily_used").default(0),
  dailyResetAt: timestamp("daily_reset_at"),
  successRate: decimal("success_rate", { precision: 5, scale: 2 }).default("100.00"),
  avgLatencyMs: int("avg_latency_ms"),
  lastThrottledAt: timestamp("last_throttled_at"),
  lastBlockedAt: timestamp("last_blocked_at"),
  isGovernment: mysqlBoolean("is_government").default(false),
  probeEnabled: mysqlBoolean("probe_enabled").default(false),
  enabled: mysqlBoolean("enabled").default(true),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type RateProfile = typeof rateProfiles.$inferSelect;
export type InsertRateProfile = typeof rateProfiles.$inferInsert;

// Rate signal log — tracks HTTP response signals for rate limit detection
export const rateSignalLog = mysqlTable("rate_signal_log", {
  id: int("id").autoincrement().primaryKey(),
  provider: varchar("provider", { length: 100 }).notNull(),
  signalType: mysqlEnum("signal_type", [
    "rate_limit_header", "retry_after", "http_429", "http_403",
    "latency_spike", "connection_reset", "timeout", "captcha_detected",
    "soft_block", "rate_reduction"
  ]).notNull(),
  signalData: json("signal_data"),
  httpStatus: int("http_status"),
  retryAfterSeconds: int("retry_after_seconds"),
  rateHeaders: json("rate_headers"),
  previousRpm: int("previous_rpm"),
  adjustedRpm: int("adjusted_rpm"),
  autoApplied: mysqlBoolean("auto_applied").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type RateSignalLog = typeof rateSignalLog.$inferSelect;
export type InsertRateSignalLog = typeof rateSignalLog.$inferInsert;

// ─── PHASE J: ADAPTIVE RATE MANAGEMENT ──────────────────────────────────

// Probe results — rate probing for undocumented limits
export const probeResults = mysqlTable("probe_results", {
  id: int("id").autoincrement().primaryKey(),
  domain: varchar("domain", { length: 200 }).notNull(),
  probeTimestamp: timestamp("probe_timestamp").defaultNow().notNull(),
  batchesCompleted: int("batches_completed").default(0),
  firstThrottleBatch: int("first_throttle_batch"),
  discoveredRpm: int("discovered_rpm"),
  confidence: decimal("confidence", { precision: 3, scale: 2 }),
  rawLog: json("raw_log"),
  approvedBy: int("approved_by"),
  applied: mysqlBoolean("applied").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type ProbeResult = typeof probeResults.$inferSelect;
export type InsertProbeResult = typeof probeResults.$inferInsert;

// Integration analysis log — AI auto-configuration for new sources
export const integrationAnalysisLog = mysqlTable("integration_analysis_log", {
  id: int("id").autoincrement().primaryKey(),
  sourceUrl: varchar("source_url", { length: 500 }).notNull(),
  domain: varchar("domain", { length: 200 }).notNull(),
  robotsTxt: text("robots_txt"),
  rateHeadersFound: json("rate_headers_found"),
  sourceClassification: varchar("source_classification", { length: 50 }),
  aiRecommendation: json("ai_recommendation"),
  adminAdjusted: mysqlBoolean("admin_adjusted").default(false),
  adminFinalConfig: json("admin_final_config"),
  approvedBy: int("approved_by"),
  approvedAt: timestamp("approved_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type IntegrationAnalysisLog = typeof integrationAnalysisLog.$inferSelect;
export type InsertIntegrationAnalysisLog = typeof integrationAnalysisLog.$inferInsert;

// Extraction plans — multi-day data extraction scheduling
export const extractionPlans = mysqlTable("extraction_plans", {
  id: int("id").autoincrement().primaryKey(),
  planName: varchar("plan_name", { length: 200 }).notNull(),
  planType: mysqlEnum("plan_type", ["initial_seed", "scheduled_refresh", "on_demand", "ai_suggested"]).notNull(),
  totalRecords: int("total_records").default(0),
  estimatedDurationHours: decimal("estimated_duration_hours", { precision: 8, scale: 2 }),
  planJson: json("plan_json"),
  optimizationNotes: json("optimization_notes"),
  status: mysqlEnum("status", ["draft", "approved", "running", "completed", "paused", "failed"]).default("draft"),
  approvedBy: int("approved_by"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  recordsCompleted: int("records_completed").default(0),
  recordsFailed: int("records_failed").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type ExtractionPlan = typeof extractionPlans.$inferSelect;
export type InsertExtractionPlan = typeof extractionPlans.$inferInsert;

// Extraction plan jobs — individual jobs within a plan
export const extractionPlanJobs = mysqlTable("extraction_plan_jobs", {
  id: int("id").autoincrement().primaryKey(),
  planId: int("plan_id").notNull(),
  provider: varchar("provider", { length: 50 }).notNull(),
  jobType: varchar("job_type", { length: 50 }),
  scheduledDay: int("scheduled_day"),
  requestsAllocated: int("requests_allocated"),
  recordsTarget: int("records_target"),
  recordsCompleted: int("records_completed").default(0),
  status: mysqlEnum("status", ["pending", "running", "completed", "failed", "skipped"]).default("pending"),
  errorLog: json("error_log"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type ExtractionPlanJob = typeof extractionPlanJobs.$inferSelect;
export type InsertExtractionPlanJob = typeof extractionPlanJobs.$inferInsert;

// Rate recommendations — AI-generated rate adjustment suggestions
export const rateRecommendations = mysqlTable("rate_recommendations", {
  id: int("id").autoincrement().primaryKey(),
  provider: varchar("provider", { length: 50 }).notNull(),
  recommendationType: varchar("recommendation_type", { length: 50 }).notNull(),
  recommendationJson: json("recommendation_json").notNull(),
  confidence: decimal("confidence", { precision: 3, scale: 2 }),
  status: mysqlEnum("status", ["pending_review", "auto_applicable", "approved", "rejected", "applied"]).default("pending_review"),
  reviewedBy: int("reviewed_by"),
  appliedAt: timestamp("applied_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type RateRecommendation = typeof rateRecommendations.$inferSelect;
export type InsertRateRecommendation = typeof rateRecommendations.$inferInsert;

// Data value scores — prioritize high-value data refreshes
export const dataValueScores = mysqlTable("data_value_scores", {
  id: int("id").autoincrement().primaryKey(),
  provider: varchar("provider", { length: 50 }).notNull(),
  recordId: varchar("record_id", { length: 100 }).notNull(),
  currentScore: decimal("current_score", { precision: 8, scale: 2 }).default("0.00"),
  lastScoredAt: timestamp("last_scored_at"),
  refreshPriority: mysqlEnum("refresh_priority", ["critical", "high", "normal", "low", "dormant"]).default("normal"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type DataValueScore = typeof dataValueScores.$inferSelect;
export type InsertDataValueScore = typeof dataValueScores.$inferInsert;

// ============================================================
// PASSIVE ACTION PREFERENCES — per-user automation toggles
// ============================================================
export const passiveActionPreferences = mysqlTable("passive_action_preferences", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  source: varchar("source", { length: 100 }).notNull(),
  actionType: mysqlEnum("action_type", [
    "auto_refresh",
    "background_sync",
    "monitoring_alerts",
    "scheduled_reports",
    "anomaly_detection",
    "smart_enrichment",
  ]).notNull(),
  enabled: mysqlBoolean("enabled").default(false).notNull(),
  configJson: json("config_json"),
  lastTriggeredAt: timestamp("last_triggered_at"),
  triggerCount: int("trigger_count").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type PassiveActionPreference = typeof passiveActionPreferences.$inferSelect;
export type InsertPassiveActionPreference = typeof passiveActionPreferences.$inferInsert;

// Passive action execution log — track what happened
export const passiveActionLog = mysqlTable("passive_action_log", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  preferenceId: int("preference_id").notNull(),
  source: varchar("source", { length: 100 }).notNull(),
  actionType: varchar("action_type", { length: 50 }).notNull(),
  status: mysqlEnum("status", ["success", "failed", "skipped", "partial"]).notNull(),
  resultSummary: text("result_summary"),
  recordsAffected: int("records_affected").default(0),
  durationMs: int("duration_ms"),
  errorMessage: text("error_message"),
  executedAt: timestamp("executed_at").defaultNow().notNull(),
});
export type PassiveActionLogEntry = typeof passiveActionLog.$inferSelect;
export type InsertPassiveActionLogEntry = typeof passiveActionLog.$inferInsert;


// ─── AI TOOL EXECUTIONS (Track every tool call with auto-populated fields) ──
// DB table: ai_tool_executions
export const aiToolExecutions = mysqlTable("ai_tool_executions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  conversationId: int("conversation_id"),
  messageId: int("message_id"),
  toolName: varchar("tool_name", { length: 100 }).notNull(),
  toolArgs: json("tool_args").notNull(),
  toolResult: json("tool_result"),
  autoPopulatedFields: json("auto_populated_fields"),
  executionMs: int("execution_ms"),
  success: mysqlBoolean("success").default(true),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type AiToolExecution = typeof aiToolExecutions.$inferSelect;
export type InsertAiToolExecution = typeof aiToolExecutions.$inferInsert;

// ─── AI RESPONSE QUALITY (Monitor empty responses, retries, disclaimer counts) ──
// DB table: ai_response_quality
export const aiResponseQuality = mysqlTable("ai_response_quality", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  conversationId: int("conversation_id"),
  messageId: int("message_id"),
  responseEmpty: mysqlBoolean("response_empty").default(false),
  disclaimerCount: int("disclaimer_count").default(0),
  toolCallsAttempted: int("tool_calls_attempted").default(0),
  toolCallsCompleted: int("tool_calls_completed").default(0),
  retryCount: int("retry_count").default(0),
  latencyMs: int("latency_ms"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type AiResponseQualityEntry = typeof aiResponseQuality.$inferSelect;
export type InsertAiResponseQualityEntry = typeof aiResponseQuality.$inferInsert;
