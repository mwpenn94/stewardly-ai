/**
 * Task #55 — Regulatory Impact Analysis Service
 * Assess impact of regulatory changes on products, processes, and compliance
 */
import { contextualLLM as invokeLLM } from "../shared/stewardlyWiring"
import { contextualLLM } from "./contextualLLM";

export interface RegulatoryChange {
  id: string;
  regulation: string;
  effectiveDate: string;
  summary: string;
  source: string;
  status: "proposed" | "final" | "effective" | "repealed";
}

export interface ImpactAssessment {
  changeId: string;
  regulation: string;
  overallImpact: "none" | "low" | "moderate" | "high" | "critical";
  affectedAreas: Array<{
    area: string;
    impact: "none" | "low" | "moderate" | "high";
    description: string;
    requiredActions: string[];
    deadline?: string;
  }>;
  complianceGaps: string[];
  estimatedEffort: string;
  recommendations: string[];
  generatedAt: string;
}

export function assessImpact(change: RegulatoryChange): ImpactAssessment {
  const reg = change.regulation.toLowerCase();
  const affectedAreas: ImpactAssessment["affectedAreas"] = [];

  // Suitability-related regulations
  if (/\b(suitability|best interest|reg bi|fiduciary)\b/.test(reg)) {
    affectedAreas.push({
      area: "Suitability Engine",
      impact: "high",
      description: "Suitability assessment criteria may need updating",
      requiredActions: ["Review suitability questionnaire", "Update scoring weights", "Retrain AI models"],
      deadline: change.effectiveDate,
    });
    affectedAreas.push({
      area: "Product Recommendations",
      impact: "high",
      description: "Recommendation logic may need adjustment",
      requiredActions: ["Audit recommendation algorithms", "Update disclosure language"],
    });
  }

  // Privacy-related regulations
  if (/\b(privacy|gdpr|ccpa|data protection|pii)\b/.test(reg)) {
    affectedAreas.push({
      area: "Data Handling",
      impact: "high",
      description: "Data collection, storage, and sharing practices may need changes",
      requiredActions: ["Audit data flows", "Update consent forms", "Review retention policies"],
      deadline: change.effectiveDate,
    });
    affectedAreas.push({
      area: "AI Training Data",
      impact: "moderate",
      description: "AI training data usage may be affected",
      requiredActions: ["Review data usage agreements", "Implement data minimization"],
    });
  }

  // AI-specific regulations
  if (/\b(ai|artificial intelligence|automated|algorithm|machine learning)\b/.test(reg)) {
    affectedAreas.push({
      area: "AI Transparency",
      impact: "high",
      description: "AI decision-making transparency requirements",
      requiredActions: ["Enhance explainability features", "Update AI badges", "Document model decisions"],
      deadline: change.effectiveDate,
    });
    affectedAreas.push({
      area: "Fairness Testing",
      impact: "moderate",
      description: "Bias testing and fairness requirements may change",
      requiredActions: ["Review fairness test suite", "Add new protected categories if needed"],
    });
  }

  // Default if no specific match
  if (affectedAreas.length === 0) {
    affectedAreas.push({
      area: "General Compliance",
      impact: "low",
      description: "General compliance review recommended",
      requiredActions: ["Review regulation text", "Assess applicability"],
    });
  }

  const maxImpact = affectedAreas.reduce((max, a) => {
    const levels = { none: 0, low: 1, moderate: 2, high: 3 };
    return levels[a.impact] > levels[max] ? a.impact : max;
  }, "none" as "none" | "low" | "moderate" | "high");

  return {
    changeId: change.id,
    regulation: change.regulation,
    overallImpact: maxImpact === "high" ? "critical" : maxImpact,
    affectedAreas,
    complianceGaps: affectedAreas.filter(a => a.impact === "high").map(a => `${a.area}: ${a.description}`),
    estimatedEffort: maxImpact === "high" ? "2-4 weeks" : maxImpact === "moderate" ? "1-2 weeks" : "< 1 week",
    recommendations: affectedAreas.flatMap(a => a.requiredActions),
    generatedAt: new Date().toISOString(),
  };
}

export async function getAIRegulatoryAnalysis(change: RegulatoryChange): Promise<string> {
  const resp = await contextualLLM({ userId: null, contextType: "compliance",
    messages: [
      { role: "system", content: "You are a financial regulatory expert. Analyze the regulatory change and provide a detailed impact assessment for a financial advisory AI platform. Be specific about compliance requirements and deadlines." },
      { role: "user", content: `Regulatory Change: ${change.regulation}\nEffective Date: ${change.effectiveDate}\nSummary: ${change.summary}\nStatus: ${change.status}` },
    ],
  });
  return typeof resp.choices?.[0]?.message?.content === "string" ? resp.choices[0].message.content : "Unable to generate analysis";
}
