/**
 * Task #49 — Compliance Prediction Service
 * Predictive compliance risk scoring and proactive violation detection
 */
import { invokeLLM } from "../_core/llm";

export interface ComplianceRiskFactor {
  factor: string;
  weight: number;
  currentScore: number;
  trend: "improving" | "stable" | "declining";
  details: string;
}

export interface CompliancePrediction {
  overallRisk: number; // 0-100
  riskLevel: "low" | "moderate" | "high" | "critical";
  factors: ComplianceRiskFactor[];
  predictedViolations: Array<{ type: string; probability: number; timeframe: string; mitigation: string }>;
  recommendations: string[];
  generatedAt: string;
}

export function calculateComplianceRisk(data: {
  suitabilityCompletionRate: number;
  disclosureRate: number;
  auditTrailCoverage: number;
  dataRetentionCompliance: number;
  piiProtectionScore: number;
  escalationResponseTime: number; // hours
  regulatoryUpdateLag: number; // days since last update
  clientComplaintRate: number;
}): CompliancePrediction {
  const factors: ComplianceRiskFactor[] = [
    {
      factor: "Suitability Documentation",
      weight: 0.2,
      currentScore: data.suitabilityCompletionRate,
      trend: data.suitabilityCompletionRate > 90 ? "improving" : data.suitabilityCompletionRate > 70 ? "stable" : "declining",
      details: `${data.suitabilityCompletionRate}% of recommendations have complete suitability documentation`,
    },
    {
      factor: "Disclosure Compliance",
      weight: 0.15,
      currentScore: data.disclosureRate,
      trend: data.disclosureRate > 95 ? "improving" : "stable",
      details: `${data.disclosureRate}% disclosure rate on AI-generated content`,
    },
    {
      factor: "Audit Trail Coverage",
      weight: 0.15,
      currentScore: data.auditTrailCoverage,
      trend: data.auditTrailCoverage > 98 ? "improving" : "declining",
      details: `${data.auditTrailCoverage}% of interactions have complete audit trails`,
    },
    {
      factor: "Data Retention",
      weight: 0.1,
      currentScore: data.dataRetentionCompliance,
      trend: "stable",
      details: `${data.dataRetentionCompliance}% compliance with retention policies`,
    },
    {
      factor: "PII Protection",
      weight: 0.15,
      currentScore: data.piiProtectionScore,
      trend: data.piiProtectionScore > 95 ? "improving" : "declining",
      details: `PII protection score: ${data.piiProtectionScore}/100`,
    },
    {
      factor: "Escalation Response",
      weight: 0.1,
      currentScore: Math.max(0, 100 - data.escalationResponseTime * 10),
      trend: data.escalationResponseTime < 2 ? "improving" : "declining",
      details: `Average escalation response time: ${data.escalationResponseTime}h`,
    },
    {
      factor: "Regulatory Currency",
      weight: 0.1,
      currentScore: Math.max(0, 100 - data.regulatoryUpdateLag * 2),
      trend: data.regulatoryUpdateLag < 7 ? "improving" : "declining",
      details: `${data.regulatoryUpdateLag} days since last regulatory update review`,
    },
    {
      factor: "Client Satisfaction",
      weight: 0.05,
      currentScore: Math.max(0, 100 - data.clientComplaintRate * 100),
      trend: data.clientComplaintRate < 0.02 ? "improving" : "declining",
      details: `Client complaint rate: ${(data.clientComplaintRate * 100).toFixed(1)}%`,
    },
  ];

  const overallRisk = 100 - factors.reduce((sum, f) => sum + f.currentScore * f.weight, 0);
  const riskLevel = overallRisk < 15 ? "low" : overallRisk < 35 ? "moderate" : overallRisk < 60 ? "high" : "critical";

  const predictedViolations: CompliancePrediction["predictedViolations"] = [];
  if (data.suitabilityCompletionRate < 80) {
    predictedViolations.push({
      type: "Suitability Gap",
      probability: (100 - data.suitabilityCompletionRate) / 100,
      timeframe: "Next 30 days",
      mitigation: "Complete suitability assessments for all active recommendations",
    });
  }
  if (data.regulatoryUpdateLag > 14) {
    predictedViolations.push({
      type: "Regulatory Non-Compliance",
      probability: Math.min(0.9, data.regulatoryUpdateLag / 60),
      timeframe: "Next 60 days",
      mitigation: "Review and apply latest regulatory updates",
    });
  }
  if (data.piiProtectionScore < 90) {
    predictedViolations.push({
      type: "Data Privacy Breach Risk",
      probability: (100 - data.piiProtectionScore) / 200,
      timeframe: "Next 90 days",
      mitigation: "Audit PII handling procedures and strengthen protections",
    });
  }

  const recommendations: string[] = [];
  for (const f of factors) {
    if (f.currentScore < 80) {
      recommendations.push(`Improve ${f.factor}: currently at ${f.currentScore}%, target 90%+`);
    }
  }

  return {
    overallRisk: Math.round(overallRisk * 10) / 10,
    riskLevel,
    factors,
    predictedViolations,
    recommendations,
    generatedAt: new Date().toISOString(),
  };
}

export async function getAIComplianceAssessment(context: string): Promise<string> {
  const resp = await invokeLLM({
    messages: [
      { role: "system", content: "You are a financial compliance expert. Assess the compliance posture described and provide specific, actionable recommendations. Be concise and prioritize by risk severity." },
      { role: "user", content: context },
    ],
  });
  return typeof resp.choices?.[0]?.message?.content === "string" ? resp.choices[0].message.content : "Unable to generate assessment";
}
