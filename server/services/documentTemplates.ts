/**
 * Document Templates Service
 * 
 * Provides 9 pre-built document templates for financial advisory workflows.
 * Each template defines structure, required fields, and LLM generation prompts.
 */
import { invokeLLM } from "../_core/llm";

// ─── Template Definitions ───────────────────────────────────────────────────

export interface TemplateField {
  key: string;
  label: string;
  type: "text" | "number" | "date" | "select" | "textarea" | "boolean";
  required: boolean;
  placeholder?: string;
  options?: string[];
  defaultValue?: string | number | boolean;
}

export interface TemplateSection {
  id: string;
  title: string;
  description: string;
  prompt: string; // LLM prompt fragment for generating this section
}

export interface DocumentTemplate {
  id: string;
  name: string;
  description: string;
  category: "compliance" | "advisory" | "reporting" | "client";
  fields: TemplateField[];
  sections: TemplateSection[];
  disclaimers: string[];
}

export interface GeneratedDocument {
  templateId: string;
  title: string;
  sections: { id: string; title: string; content: string }[];
  disclaimers: string[];
  generatedAt: number;
  metadata: Record<string, unknown>;
}

// ─── 9 Templates ────────────────────────────────────────────────────────────

const templates: DocumentTemplate[] = [
  {
    id: "financial-plan-summary",
    name: "Financial Plan Summary",
    description: "Comprehensive financial plan overview with goals, strategies, and projections",
    category: "advisory",
    fields: [
      { key: "clientName", label: "Client Name", type: "text", required: true },
      { key: "planDate", label: "Plan Date", type: "date", required: true },
      { key: "planHorizon", label: "Planning Horizon (years)", type: "number", required: true, defaultValue: 30 },
      { key: "riskTolerance", label: "Risk Tolerance", type: "select", required: true, options: ["Conservative", "Moderate", "Aggressive", "Very Aggressive"] },
      { key: "goals", label: "Financial Goals", type: "textarea", required: true, placeholder: "List primary financial goals..." },
      { key: "currentAssets", label: "Total Current Assets ($)", type: "number", required: true },
      { key: "annualIncome", label: "Annual Income ($)", type: "number", required: true },
    ],
    sections: [
      { id: "executive-summary", title: "Executive Summary", description: "High-level overview of the financial plan", prompt: "Write a professional executive summary for a financial plan." },
      { id: "current-situation", title: "Current Financial Situation", description: "Analysis of current assets, liabilities, and cash flow", prompt: "Analyze the client's current financial situation." },
      { id: "goals-objectives", title: "Goals & Objectives", description: "Prioritized financial goals with timelines", prompt: "Outline the client's financial goals with realistic timelines." },
      { id: "investment-strategy", title: "Investment Strategy", description: "Recommended asset allocation and investment approach", prompt: "Recommend an investment strategy based on risk tolerance and goals." },
      { id: "risk-management", title: "Risk Management", description: "Insurance and risk mitigation recommendations", prompt: "Provide risk management recommendations." },
      { id: "action-plan", title: "Action Plan", description: "Specific next steps with deadlines", prompt: "Create a prioritized action plan with specific deadlines." },
    ],
    disclaimers: [
      "This financial plan is for informational purposes only and does not constitute financial advice.",
      "Past performance does not guarantee future results. All projections are estimates.",
      "Consult with a qualified financial advisor before making investment decisions.",
    ],
  },
  {
    id: "suitability-assessment",
    name: "Suitability Assessment Report",
    description: "12-dimension suitability analysis with compliance documentation",
    category: "compliance",
    fields: [
      { key: "clientName", label: "Client Name", type: "text", required: true },
      { key: "assessmentDate", label: "Assessment Date", type: "date", required: true },
      { key: "advisorName", label: "Advisor Name", type: "text", required: true },
      { key: "investmentObjective", label: "Investment Objective", type: "select", required: true, options: ["Capital Preservation", "Income", "Growth & Income", "Growth", "Speculation"] },
      { key: "timeHorizon", label: "Time Horizon", type: "select", required: true, options: ["Short-term (0-3 years)", "Medium-term (3-10 years)", "Long-term (10+ years)"] },
      { key: "liquidNetWorth", label: "Liquid Net Worth ($)", type: "number", required: true },
    ],
    sections: [
      { id: "client-profile", title: "Client Profile", description: "Demographics and financial background", prompt: "Summarize the client's profile for suitability purposes." },
      { id: "risk-assessment", title: "Risk Assessment", description: "12-dimension risk analysis", prompt: "Provide a 12-dimension risk assessment covering investment knowledge, risk tolerance, time horizon, liquidity needs, income stability, tax situation, estate considerations, insurance coverage, debt obligations, investment experience, financial goals, and special circumstances." },
      { id: "recommendation-basis", title: "Basis for Recommendation", description: "Why the recommendation is suitable", prompt: "Document the basis for the investment recommendation." },
      { id: "alternatives-considered", title: "Alternatives Considered", description: "Other options evaluated", prompt: "List alternatives that were considered and why they were not selected." },
    ],
    disclaimers: [
      "This suitability assessment is prepared in accordance with Regulation Best Interest (Reg BI).",
      "The assessment is based on information provided by the client and may not reflect all material facts.",
    ],
  },
  {
    id: "iul-illustration",
    name: "IUL Policy Illustration",
    description: "Indexed Universal Life insurance policy illustration with projections",
    category: "advisory",
    fields: [
      { key: "clientName", label: "Client Name", type: "text", required: true },
      { key: "age", label: "Current Age", type: "number", required: true },
      { key: "gender", label: "Gender", type: "select", required: true, options: ["Male", "Female"] },
      { key: "healthClass", label: "Health Class", type: "select", required: true, options: ["Preferred Plus", "Preferred", "Standard Plus", "Standard"] },
      { key: "faceAmount", label: "Face Amount ($)", type: "number", required: true },
      { key: "annualPremium", label: "Annual Premium ($)", type: "number", required: true },
      { key: "illustrationRate", label: "Illustration Rate (%)", type: "number", required: true, defaultValue: 6.5 },
    ],
    sections: [
      { id: "policy-overview", title: "Policy Overview", description: "Key policy features and benefits", prompt: "Describe the IUL policy features, indexing strategy, and key benefits." },
      { id: "premium-schedule", title: "Premium Schedule", description: "Planned premium payments", prompt: "Outline the premium payment schedule and flexibility options." },
      { id: "projected-values", title: "Projected Values", description: "Cash value and death benefit projections", prompt: "Project cash value and death benefit at guaranteed and illustrated rates." },
      { id: "living-benefits", title: "Living Benefits", description: "Policy loan and withdrawal options", prompt: "Explain living benefit options including policy loans and withdrawals." },
    ],
    disclaimers: [
      "This illustration is not a contract. It shows how the policy might perform under assumed conditions.",
      "Actual results will vary based on market performance and policy charges.",
      "The guaranteed values assume the minimum interest rate and maximum charges.",
    ],
  },
  {
    id: "premium-finance-proposal",
    name: "Premium Finance Proposal",
    description: "Premium financing strategy proposal with ROI analysis",
    category: "advisory",
    fields: [
      { key: "clientName", label: "Client Name", type: "text", required: true },
      { key: "loanAmount", label: "Loan Amount ($)", type: "number", required: true },
      { key: "interestRate", label: "Interest Rate (%)", type: "number", required: true },
      { key: "collateralType", label: "Collateral Type", type: "select", required: true, options: ["Cash", "Securities", "Real Estate", "Letter of Credit"] },
      { key: "policyPremium", label: "Annual Policy Premium ($)", type: "number", required: true },
      { key: "financingTerm", label: "Financing Term (years)", type: "number", required: true, defaultValue: 10 },
    ],
    sections: [
      { id: "strategy-overview", title: "Strategy Overview", description: "Premium financing concept and benefits", prompt: "Explain the premium financing strategy and its benefits for high-net-worth clients." },
      { id: "financial-analysis", title: "Financial Analysis", description: "ROI projections and cost analysis", prompt: "Provide a detailed financial analysis of the premium financing arrangement." },
      { id: "risk-factors", title: "Risk Factors", description: "Key risks and mitigation strategies", prompt: "Identify key risks of premium financing and mitigation strategies." },
      { id: "exit-strategy", title: "Exit Strategy", description: "Loan repayment and exit options", prompt: "Outline exit strategy options for the premium financing arrangement." },
    ],
    disclaimers: [
      "Premium financing involves significant risks including the risk of policy lapse if collateral requirements increase.",
      "Interest rates are variable and may increase, affecting the overall cost of the arrangement.",
      "This proposal is for discussion purposes only and is not a commitment to lend.",
    ],
  },
  {
    id: "annual-review",
    name: "Annual Review Report",
    description: "Yearly portfolio and financial plan review with recommendations",
    category: "reporting",
    fields: [
      { key: "clientName", label: "Client Name", type: "text", required: true },
      { key: "reviewPeriod", label: "Review Period", type: "text", required: true, placeholder: "e.g., Jan 2025 - Dec 2025" },
      { key: "portfolioValue", label: "Current Portfolio Value ($)", type: "number", required: true },
      { key: "returnYTD", label: "Year-to-Date Return (%)", type: "number", required: true },
      { key: "lifeChanges", label: "Life Changes This Year", type: "textarea", required: false, placeholder: "Marriage, new job, new child, etc." },
    ],
    sections: [
      { id: "performance-summary", title: "Performance Summary", description: "Portfolio performance vs benchmarks", prompt: "Summarize portfolio performance relative to benchmarks." },
      { id: "allocation-review", title: "Asset Allocation Review", description: "Current vs target allocation", prompt: "Review current asset allocation against target and recommend rebalancing." },
      { id: "goal-progress", title: "Goal Progress", description: "Progress toward financial goals", prompt: "Assess progress toward each financial goal." },
      { id: "recommendations", title: "Recommendations", description: "Action items for the coming year", prompt: "Provide specific recommendations for the coming year." },
    ],
    disclaimers: [
      "Past performance is not indicative of future results.",
      "This review is based on data available as of the review date.",
    ],
  },
  {
    id: "estate-plan-summary",
    name: "Estate Plan Summary",
    description: "Estate planning overview with trust structures and beneficiary designations",
    category: "client",
    fields: [
      { key: "clientName", label: "Client Name", type: "text", required: true },
      { key: "spouseName", label: "Spouse Name", type: "text", required: false },
      { key: "estimatedEstate", label: "Estimated Estate Value ($)", type: "number", required: true },
      { key: "numBeneficiaries", label: "Number of Beneficiaries", type: "number", required: true },
      { key: "hasTrust", label: "Has Existing Trust", type: "boolean", required: true, defaultValue: false },
      { key: "stateOfResidence", label: "State of Residence", type: "text", required: true },
    ],
    sections: [
      { id: "estate-overview", title: "Estate Overview", description: "Current estate structure", prompt: "Summarize the current estate structure and key assets." },
      { id: "trust-analysis", title: "Trust Analysis", description: "Trust recommendations and structures", prompt: "Analyze trust options and recommend appropriate structures." },
      { id: "tax-implications", title: "Tax Implications", description: "Estate and gift tax analysis", prompt: "Analyze estate and gift tax implications under current law." },
      { id: "beneficiary-plan", title: "Beneficiary Plan", description: "Beneficiary designations and distributions", prompt: "Outline the beneficiary designation plan." },
    ],
    disclaimers: [
      "This summary is for planning purposes only and does not constitute legal advice.",
      "Consult with an estate planning attorney for legal document preparation.",
      "Tax laws are subject to change and may affect estate planning strategies.",
    ],
  },
  {
    id: "client-onboarding",
    name: "Client Onboarding Package",
    description: "New client welcome package with account setup and expectations",
    category: "client",
    fields: [
      { key: "clientName", label: "Client Name", type: "text", required: true },
      { key: "advisorName", label: "Advisor Name", type: "text", required: true },
      { key: "firmName", label: "Firm Name", type: "text", required: true },
      { key: "serviceLevel", label: "Service Level", type: "select", required: true, options: ["Basic", "Premium", "Comprehensive", "Family Office"] },
      { key: "meetingFrequency", label: "Meeting Frequency", type: "select", required: true, options: ["Quarterly", "Semi-Annual", "Annual", "As Needed"] },
    ],
    sections: [
      { id: "welcome", title: "Welcome Letter", description: "Personalized welcome message", prompt: "Write a warm, professional welcome letter for a new financial advisory client." },
      { id: "service-overview", title: "Service Overview", description: "What to expect from the advisory relationship", prompt: "Describe the advisory services and what the client can expect." },
      { id: "next-steps", title: "Next Steps", description: "Account setup and initial actions", prompt: "Outline the onboarding next steps and initial actions required." },
      { id: "contact-info", title: "Contact Information", description: "How to reach the advisory team", prompt: "Provide contact information and communication preferences." },
    ],
    disclaimers: [
      "Advisory services are subject to the terms outlined in the advisory agreement.",
    ],
  },
  {
    id: "compliance-review",
    name: "Compliance Review Report",
    description: "Periodic compliance review with regulatory checklist",
    category: "compliance",
    fields: [
      { key: "reviewDate", label: "Review Date", type: "date", required: true },
      { key: "reviewerName", label: "Reviewer Name", type: "text", required: true },
      { key: "reviewPeriod", label: "Review Period", type: "text", required: true },
      { key: "firmName", label: "Firm Name", type: "text", required: true },
      { key: "regulatoryBody", label: "Primary Regulatory Body", type: "select", required: true, options: ["SEC", "FINRA", "State DOI", "Multiple"] },
    ],
    sections: [
      { id: "review-scope", title: "Review Scope", description: "What was reviewed and methodology", prompt: "Describe the scope and methodology of the compliance review." },
      { id: "findings", title: "Findings", description: "Key findings and observations", prompt: "Summarize key compliance findings and observations." },
      { id: "regulatory-checklist", title: "Regulatory Checklist", description: "Compliance status for key regulations", prompt: "Provide a regulatory compliance checklist covering Reg BI, Form CRS, ADV, AML, and cybersecurity." },
      { id: "remediation", title: "Remediation Plan", description: "Action items for identified issues", prompt: "Create a remediation plan for any compliance gaps identified." },
    ],
    disclaimers: [
      "This compliance review is an internal assessment and does not guarantee regulatory compliance.",
      "Firms should consult with compliance counsel for regulatory interpretations.",
    ],
  },
  {
    id: "case-design-summary",
    name: "Case Design Summary",
    description: "Insurance case design with product comparison and recommendation",
    category: "advisory",
    fields: [
      { key: "clientName", label: "Client Name", type: "text", required: true },
      { key: "caseType", label: "Case Type", type: "select", required: true, options: ["Life Insurance", "Disability", "Long-Term Care", "Annuity", "Multi-Product"] },
      { key: "needAmount", label: "Coverage Need ($)", type: "number", required: true },
      { key: "budget", label: "Annual Budget ($)", type: "number", required: true },
      { key: "healthRating", label: "Expected Health Rating", type: "select", required: true, options: ["Preferred Plus", "Preferred", "Standard Plus", "Standard", "Substandard"] },
      { key: "carriers", label: "Carriers Considered", type: "textarea", required: true, placeholder: "List carriers being compared..." },
    ],
    sections: [
      { id: "needs-analysis", title: "Needs Analysis", description: "Coverage need calculation", prompt: "Analyze the insurance coverage need based on client circumstances." },
      { id: "product-comparison", title: "Product Comparison", description: "Side-by-side carrier comparison", prompt: "Compare products from the specified carriers." },
      { id: "recommendation", title: "Recommendation", description: "Recommended product and rationale", prompt: "Provide a specific product recommendation with detailed rationale." },
      { id: "implementation", title: "Implementation Plan", description: "Application and underwriting steps", prompt: "Outline the implementation plan including application and underwriting." },
    ],
    disclaimers: [
      "Product illustrations are based on current rates and are subject to change.",
      "Final rates and coverage are subject to underwriting approval.",
      "This case design is for discussion purposes and does not guarantee coverage.",
    ],
  },
];

// ─── Template Access ────────────────────────────────────────────────────────

export function getTemplates(): DocumentTemplate[] {
  return templates;
}

export function getTemplateById(id: string): DocumentTemplate | undefined {
  return templates.find((t) => t.id === id);
}

export function getTemplatesByCategory(category: DocumentTemplate["category"]): DocumentTemplate[] {
  return templates.filter((t) => t.category === category);
}

// ─── Document Generation ────────────────────────────────────────────────────

export async function generateDocument(
  templateId: string,
  fieldValues: Record<string, unknown>,
  userId?: number
): Promise<GeneratedDocument> {
  const template = getTemplateById(templateId);
  if (!template) throw new Error(`Template not found: ${templateId}`);

  // Validate required fields
  for (const field of template.fields) {
    if (field.required && (fieldValues[field.key] === undefined || fieldValues[field.key] === "")) {
      throw new Error(`Required field missing: ${field.label}`);
    }
  }

  // Build context from field values
  const context = template.fields
    .map((f) => `${f.label}: ${fieldValues[f.key] ?? "Not provided"}`)
    .join("\n");

  // Generate each section using LLM
  const generatedSections: { id: string; title: string; content: string }[] = [];

  for (const section of template.sections) {
    try {
      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `You are a professional financial document writer for Stewardly, a digital financial advisory platform. Generate the "${section.title}" section of a "${template.name}" document. Be professional, specific, and compliant with financial regulations. Use the provided client data to personalize the content. Do not include disclaimers in the section content — those are added separately.`,
          },
          {
            role: "user",
            content: `${section.prompt}\n\nClient Data:\n${context}\n\nSection Description: ${section.description}\n\nGenerate this section in professional prose. Use specific numbers and details from the client data where applicable.`,
          },
        ],
      });

      const content = (response.choices?.[0]?.message?.content as string) || `[Section "${section.title}" could not be generated]`;
      generatedSections.push({ id: section.id, title: section.title, content });
    } catch {
      generatedSections.push({
        id: section.id,
        title: section.title,
        content: `[Error generating section: ${section.title}. Please try again.]`,
      });
    }
  }

  return {
    templateId,
    title: `${template.name} — ${fieldValues.clientName || "Client"}`,
    sections: generatedSections,
    disclaimers: template.disclaimers,
    generatedAt: Date.now(),
    metadata: { ...fieldValues, userId, templateName: template.name },
  };
}
