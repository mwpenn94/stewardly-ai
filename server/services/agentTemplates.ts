/**
 * Task #48 — Agent Templates Service
 * Pre-built agent configurations for common financial advisory workflows
 */
import { getDb } from "../db";
import { eq, desc } from "drizzle-orm";

export interface AgentTemplate {
  id: string;
  name: string;
  description: string;
  category: "onboarding" | "advisory" | "compliance" | "research" | "operations" | "coaching";
  systemPrompt: string;
  tools: string[];
  knowledgeCategories: string[];
  capabilityMode: string;
  defaultParameters: Record<string, any>;
  estimatedDuration: string;
  complexity: "simple" | "moderate" | "complex";
  requiredRole: string;
}

const TEMPLATES: AgentTemplate[] = [
  {
    id: "new_client_onboarding",
    name: "New Client Onboarding",
    description: "Guide new clients through profile setup, risk assessment, and initial financial snapshot",
    category: "onboarding",
    systemPrompt: "You are an onboarding specialist. Guide the user through creating their financial profile step by step. Be warm, patient, and thorough. Collect: demographics, income, savings, goals, risk tolerance, insurance needs.",
    tools: ["suitability_assessment", "risk_profiler", "goal_planner"],
    knowledgeCategories: ["onboarding", "suitability", "products"],
    capabilityMode: "Onboarding",
    defaultParameters: { maxSteps: 8, requiresAllFields: false },
    estimatedDuration: "15-20 minutes",
    complexity: "simple",
    requiredRole: "user",
  },
  {
    id: "annual_review",
    name: "Annual Financial Review",
    description: "Comprehensive annual review of client's financial position, goals progress, and rebalancing needs",
    category: "advisory",
    systemPrompt: "You are conducting an annual financial review. Analyze the client's current position vs goals, identify gaps, suggest rebalancing, and update suitability profile if needed.",
    tools: ["portfolio_analyzer", "goal_tracker", "suitability_assessment", "product_comparator"],
    knowledgeCategories: ["advisory", "products", "compliance", "planning"],
    capabilityMode: "Financial Advisory",
    defaultParameters: { includeProjections: true, yearsToProject: 5 },
    estimatedDuration: "30-45 minutes",
    complexity: "complex",
    requiredRole: "advisor",
  },
  {
    id: "compliance_check",
    name: "Compliance Pre-Check",
    description: "Run compliance checks on a proposed recommendation before presenting to client",
    category: "compliance",
    systemPrompt: "You are a compliance officer reviewing a financial recommendation. Check suitability, disclosure requirements, conflict of interest, and regulatory compliance.",
    tools: ["compliance_checker", "suitability_validator", "disclosure_generator"],
    knowledgeCategories: ["compliance", "regulatory", "suitability"],
    capabilityMode: "Financial Advisory",
    defaultParameters: { strictMode: true },
    estimatedDuration: "5-10 minutes",
    complexity: "moderate",
    requiredRole: "advisor",
  },
  {
    id: "market_research",
    name: "Market Research Brief",
    description: "Generate a research brief on a specific market segment, product type, or economic trend",
    category: "research",
    systemPrompt: "You are a financial research analyst. Provide objective, data-driven analysis on the requested topic. Include market context, trends, risks, and opportunities.",
    tools: ["market_data_query", "trend_analyzer", "benchmark_comparator"],
    knowledgeCategories: ["research", "markets", "products"],
    capabilityMode: "Research",
    defaultParameters: { depth: "comprehensive", includeSources: true },
    estimatedDuration: "10-15 minutes",
    complexity: "moderate",
    requiredRole: "advisor",
  },
  {
    id: "study_session",
    name: "Certification Study Session",
    description: "Guided study session for financial certifications (Series 6/7, CFP, CFA, etc.)",
    category: "coaching",
    systemPrompt: "You are a study coach for financial certifications. Quiz the user, explain concepts, provide practice problems, and track progress. Adapt difficulty based on performance.",
    tools: ["quiz_generator", "progress_tracker", "concept_explainer"],
    knowledgeCategories: ["study", "certifications", "concepts"],
    capabilityMode: "Study",
    defaultParameters: { adaptiveDifficulty: true, questionsPerSession: 20 },
    estimatedDuration: "20-30 minutes",
    complexity: "moderate",
    requiredRole: "user",
  },
  {
    id: "client_outreach",
    name: "Client Outreach Prep",
    description: "Prepare for client outreach with talking points, recent activity summary, and suggested topics",
    category: "operations",
    systemPrompt: "You are preparing an advisor for a client meeting. Summarize the client's recent activity, flag any concerns, suggest discussion topics, and prepare talking points.",
    tools: ["client_summary", "activity_analyzer", "talking_points_generator"],
    knowledgeCategories: ["advisory", "products", "compliance"],
    capabilityMode: "Financial Advisory",
    defaultParameters: { includeRecentActivity: true, dayRange: 90 },
    estimatedDuration: "5-10 minutes",
    complexity: "simple",
    requiredRole: "advisor",
  },
];

export function listTemplates(category?: string): AgentTemplate[] {
  if (category) return TEMPLATES.filter(t => t.category === category);
  return [...TEMPLATES];
}

export function getTemplate(id: string): AgentTemplate | null {
  return TEMPLATES.find(t => t.id === id) ?? null;
}

export function getTemplatesForRole(role: string): AgentTemplate[] {
  const roleHierarchy: Record<string, string[]> = {
    admin: ["user", "advisor", "manager", "admin"],
    manager: ["user", "advisor", "manager"],
    advisor: ["user", "advisor"],
    professional: ["user", "advisor"],
    user: ["user"],
  };
  const allowedRoles = roleHierarchy[role] ?? ["user"];
  return TEMPLATES.filter(t => allowedRoles.includes(t.requiredRole));
}

export function suggestTemplate(query: string, role: string): AgentTemplate | null {
  const q = query.toLowerCase();
  const available = getTemplatesForRole(role);

  if (/\b(new client|onboard|get started|setup)\b/.test(q)) return available.find(t => t.id === "new_client_onboarding") ?? null;
  if (/\b(annual|review|rebalance|checkup)\b/.test(q)) return available.find(t => t.id === "annual_review") ?? null;
  if (/\b(compliance|check|regulatory|suitable)\b/.test(q)) return available.find(t => t.id === "compliance_check") ?? null;
  if (/\b(research|market|trend|analysis)\b/.test(q)) return available.find(t => t.id === "market_research") ?? null;
  if (/\b(study|exam|quiz|certification|series)\b/.test(q)) return available.find(t => t.id === "study_session") ?? null;
  if (/\b(outreach|meeting|prep|client call)\b/.test(q)) return available.find(t => t.id === "client_outreach") ?? null;

  return null;
}
