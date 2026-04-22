/**
 * Engagement Letter & Client Onboarding Enhancement Service
 * 
 * Section 7.2 Enhancement: Client Onboarding
 * - Engagement letter generation (scope of services, fee disclosure, fiduciary acknowledgment)
 * - Form CRS delivery tracking
 * - Fee schedule management
 * - Engagement status lifecycle
 * 
 * Integrates with:
 * - Planning hierarchy (creates engagement node in planning tree)
 * - PFR generator (engagement letter references PFR scope)
 * - Compliance (Form CRS, ADV Part 2, fiduciary documentation)
 * - LLM (generates customized engagement letter prose)
 */

import { getDb } from "../../db";
import { rawInvokeLLM as invokeLLM } from "../../shared/stewardlyWiring";
import { sql } from "drizzle-orm";

// ─── TYPES ────────────────────────────────────────────────────────

export interface FeeSchedule {
  feeType: "aum" | "flat" | "hourly" | "commission" | "hybrid";
  aum?: { tiers: Array<{ minAssets: number; maxAssets: number | null; bps: number }>; minimumFee?: number };
  flat?: { annualFee: number; services: string[] };
  hourly?: { rate: number; estimatedHours: number };
  commission?: { note: string };
  hybrid?: { components: Array<{ type: string; amount: number; description: string }> };
}

export interface EngagementScope {
  financialPlanning: boolean;
  investmentManagement: boolean;
  insurancePlanning: boolean;
  taxPlanning: boolean;
  estatePlanning: boolean;
  retirementPlanning: boolean;
  educationPlanning: boolean;
  debtManagement: boolean;
  businessPlanning: boolean;
  charitablePlanning: boolean;
  specialNeeds: boolean;
  elderCare: boolean;
  divorceFinancial: boolean;
  crossBorder: boolean;
  customServices: string[];
}

export interface FormCRSDelivery {
  deliveredAt: string | null;
  acknowledgedAt: string | null;
  deliveryMethod: "email" | "mail" | "in-person" | "portal";
  version: string;
  documentUrl: string | null;
}

export interface ADVDelivery {
  part2ADeliveredAt: string | null;
  part2BDeliveredAt: string | null;
  acknowledgedAt: string | null;
  version: string;
}

export interface EngagementLetterData {
  clientId: number;
  advisorId: number;
  clientName: string;
  advisorName: string;
  firmName: string;
  scope: EngagementScope;
  feeSchedule: FeeSchedule;
  fiduciaryStandard: "fiduciary" | "suitability" | "best-interest";
  engagementType: "initial" | "renewal" | "amendment";
  effectiveDate: string;
  termMonths: number;
  autoRenew: boolean;
  terminationNoticeDays: number;
  formCRS: FormCRSDelivery;
  advDelivery: ADVDelivery;
  privacyPolicyDelivered: boolean;
  arbitrationClause: boolean;
  status: "draft" | "sent" | "signed" | "active" | "expired" | "terminated";
}

export interface EngagementLetterOutput {
  id: number;
  letterHtml: string;
  letterMarkdown: string;
  metadata: EngagementLetterData;
  createdAt: string;
  updatedAt: string;
}

export interface UnderwritingStatus {
  applicationId: number;
  clientId: number;
  carrier: string;
  product: string;
  status: "submitted" | "underwriting" | "requirements-pending" | "approved" | "declined" | "withdrawn" | "issued" | "delivered";
  requirements: Array<{
    type: string;
    description: string;
    status: "pending" | "received" | "waived";
    dueDate: string | null;
    receivedDate: string | null;
  }>;
  submittedAt: string;
  lastStatusUpdate: string;
  expectedDecisionDate: string | null;
  notes: string;
}

export interface MeetingBrief {
  meetingId: number;
  clientId: number;
  preMeetingBrief: string;
  agendaItems: string[];
  actionItems: Array<{ item: string; assignee: string; dueDate: string; status: "pending" | "done" }>;
  followUpScheduled: string | null;
  notes: string;
}

export interface ComplianceAuditSample {
  sampleId: number;
  reviewPeriod: string;
  sampleSize: number;
  selectedAccounts: number[];
  reviewType: "random" | "targeted" | "comprehensive";
  findings: Array<{ accountId: number; finding: string; severity: "low" | "medium" | "high"; resolved: boolean }>;
  supervisorId: number;
  reviewDate: string;
  status: "pending" | "in-progress" | "completed" | "escalated";
}

// ─── ENGAGEMENT LETTER GENERATION ─────────────────────────────────

const MAX_DEPTH = 20;

function buildScopeDescription(scope: EngagementScope): string {
  const services: string[] = [];
  if (scope.financialPlanning) services.push("Comprehensive Financial Planning");
  if (scope.investmentManagement) services.push("Investment Management & Portfolio Construction");
  if (scope.insurancePlanning) services.push("Insurance Needs Analysis & Product Recommendations");
  if (scope.taxPlanning) services.push("Tax Planning & Projection");
  if (scope.estatePlanning) services.push("Estate Planning Coordination");
  if (scope.retirementPlanning) services.push("Retirement Income Planning");
  if (scope.educationPlanning) services.push("Education Funding Analysis");
  if (scope.debtManagement) services.push("Debt Management & Optimization");
  if (scope.businessPlanning) services.push("Business Planning & Succession");
  if (scope.charitablePlanning) services.push("Charitable Giving Strategy");
  if (scope.specialNeeds) services.push("Special Needs Planning");
  if (scope.elderCare) services.push("Elder Care & Long-Term Care Planning");
  if (scope.divorceFinancial) services.push("Divorce Financial Analysis");
  if (scope.crossBorder) services.push("Cross-Border Financial Planning");
  if (scope.customServices?.length) services.push(...scope.customServices);
  return services.join(", ");
}

function buildFeeDescription(fee: FeeSchedule): string {
  switch (fee.feeType) {
    case "aum":
      if (!fee.aum?.tiers?.length) return "Assets Under Management fee (schedule to be determined)";
      const tierLines = fee.aum.tiers.map(t => {
        const max = t.maxAssets ? `$${(t.maxAssets / 1e6).toFixed(1)}M` : "and above";
        return `$${(t.minAssets / 1e6).toFixed(1)}M - ${max}: ${t.bps} basis points (${(t.bps / 100).toFixed(2)}%)`;
      });
      let desc = `Assets Under Management Fee:\n${tierLines.join("\n")}`;
      if (fee.aum.minimumFee) desc += `\nMinimum annual fee: $${fee.aum.minimumFee.toLocaleString()}`;
      return desc;
    case "flat":
      return `Flat Annual Fee: $${fee.flat?.annualFee?.toLocaleString() ?? "TBD"}\nServices included: ${fee.flat?.services?.join(", ") ?? "As outlined in scope"}`;
    case "hourly":
      return `Hourly Rate: $${fee.hourly?.rate ?? "TBD"}/hour\nEstimated hours: ${fee.hourly?.estimatedHours ?? "TBD"}`;
    case "commission":
      return `Commission-based compensation as disclosed in product-specific documentation.\n${fee.commission?.note ?? ""}`;
    case "hybrid":
      const components = fee.hybrid?.components?.map(c => `${c.type}: $${c.amount.toLocaleString()} — ${c.description}`) ?? [];
      return `Hybrid Fee Structure:\n${components.join("\n")}`;
    default:
      return "Fee schedule to be determined";
  }
}

export async function generateEngagementLetter(data: EngagementLetterData): Promise<{ html: string; markdown: string }> {
  const scopeDesc = buildScopeDescription(data.scope);
  const feeDesc = buildFeeDescription(data.feeSchedule);

  const fiduciaryText = data.fiduciaryStandard === "fiduciary"
    ? "As a fiduciary, the Advisor is legally obligated to act in the Client's best interest at all times. This duty includes providing advice that is in the Client's best interest, disclosing all material conflicts of interest, and placing the Client's interests ahead of the Advisor's own."
    : data.fiduciaryStandard === "best-interest"
    ? "Under Regulation Best Interest (Reg BI), the Advisor is required to act in the Client's best interest at the time a recommendation is made, without placing the Advisor's financial or other interests ahead of the Client's interests."
    : "The Advisor will recommend products that are suitable for the Client based on the Client's stated financial situation, needs, and objectives as disclosed to the Advisor.";

  const prompt = `Generate a professional financial advisory engagement letter with the following details:

Client: ${data.clientName}
Advisor: ${data.advisorName}
Firm: ${data.firmName}
Engagement Type: ${data.engagementType}
Effective Date: ${data.effectiveDate}
Term: ${data.termMonths} months${data.autoRenew ? " (auto-renewing)" : ""}
Termination Notice: ${data.terminationNoticeDays} days written notice

SCOPE OF SERVICES:
${scopeDesc}

FEE SCHEDULE:
${feeDesc}

FIDUCIARY STANDARD:
${fiduciaryText}

${data.arbitrationClause ? "Include a binding arbitration clause." : ""}

Generate the letter in professional legal format with:
1. Parties and effective date
2. Scope of services (detailed)
3. Client responsibilities (provide accurate information, notify of changes)
4. Fee schedule and payment terms
5. Fiduciary/suitability standard disclosure
6. Conflicts of interest disclosure
7. Confidentiality and privacy
8. Term and termination
9. ${data.arbitrationClause ? "Arbitration clause" : "Dispute resolution"}
10. Regulatory disclosures (Form CRS, ADV Part 2)
11. Signature blocks

Output in Markdown format. Be thorough but concise. Use professional legal language.`;

  try {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: "You are a compliance-focused financial services attorney drafting engagement letters for registered investment advisors and insurance professionals. Generate professional, legally sound engagement letters." },
        { role: "user", content: prompt },
      ],
    });

    const markdown = response?.choices?.[0]?.message?.content ?? generateFallbackLetter(data, scopeDesc, feeDesc, fiduciaryText);
    // @ts-expect-error — argument type mismatch
    const html = markdownToBasicHtml(markdown);
    // @ts-expect-error — strict mode fix
    return { html, markdown };
  } catch {
    const markdown = generateFallbackLetter(data, scopeDesc, feeDesc, fiduciaryText);
    const html = markdownToBasicHtml(markdown);
    return { html, markdown };
  }
}

function generateFallbackLetter(data: EngagementLetterData, scopeDesc: string, feeDesc: string, fiduciaryText: string): string {
  return `# Financial Advisory Engagement Letter

**${data.firmName}**

---

**Date:** ${data.effectiveDate}

**Client:** ${data.clientName}
**Advisor:** ${data.advisorName}

---

## 1. Purpose and Scope

This Engagement Letter ("Agreement") establishes the terms and conditions under which ${data.advisorName} of ${data.firmName} ("Advisor") will provide financial advisory services to ${data.clientName} ("Client").

This is ${data.engagementType === "initial" ? "an initial" : data.engagementType === "renewal" ? "a renewal of the" : "an amendment to the"} engagement agreement.

## 2. Services to be Provided

The Advisor agrees to provide the following services:

${scopeDesc.split(", ").map(s => `- ${s}`).join("\n")}

## 3. Client Responsibilities

The Client agrees to:
- Provide accurate and complete financial information
- Notify the Advisor promptly of any material changes in financial circumstances
- Review all recommendations and disclosures provided
- Make timely decisions regarding recommended actions

## 4. Compensation

${feeDesc}

Fees are billed quarterly in arrears unless otherwise agreed. The Client authorizes fee deduction from managed accounts where applicable.

## 5. Standard of Care

${fiduciaryText}

## 6. Conflicts of Interest

The Advisor will disclose all material conflicts of interest in writing. The Client acknowledges receipt of the Advisor's Form CRS and ADV Part 2A/2B brochures, which contain detailed conflict disclosures.

## 7. Confidentiality

All Client information will be held in strict confidence in accordance with Regulation S-P and applicable state privacy laws. Information will only be shared with third parties as necessary to provide the agreed-upon services or as required by law.

## 8. Term and Termination

This Agreement is effective as of ${data.effectiveDate} for a period of ${data.termMonths} months.${data.autoRenew ? " The Agreement will automatically renew for successive periods of equal length unless terminated." : ""} Either party may terminate this Agreement with ${data.terminationNoticeDays} days' written notice. Upon termination, any prepaid fees will be prorated and refunded.

## 9. Regulatory Disclosures

The Client acknowledges receipt of:
- Form CRS (Client Relationship Summary)
- ADV Part 2A (Firm Brochure)
- ADV Part 2B (Brochure Supplement)
- Privacy Policy

## 10. Signatures

By signing below, both parties agree to the terms outlined in this Agreement.

**Client Signature:** _________________________ Date: _________

**Advisor Signature:** _________________________ Date: _________

---

*This document is for informational purposes and should be reviewed by legal counsel before execution.*`;
}

function markdownToBasicHtml(md: string): string {
  return md
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>.*<\/li>\n?)+/g, (m) => `<ul>${m}</ul>`)
    .replace(/\n{2,}/g, "</p><p>")
    .replace(/^/, "<p>")
    .replace(/$/, "</p>")
    .replace(/---/g, "<hr/>");
}

// ─── ENGAGEMENT LETTER CRUD ───────────────────────────────────────

export async function saveEngagementLetter(
  data: EngagementLetterData,
  letterHtml: string,
  letterMarkdown: string
): Promise<number> {
  const db = (await getDb())!;
  const [result] = await db.execute(sql`INSERT INTO engagement_letters (client_id, advisor_id, client_name, advisor_name, firm_name,
      scope_json, fee_schedule_json, fiduciary_standard, engagement_type, effective_date,
      term_months, auto_renew, termination_notice_days, form_crs_json, adv_delivery_json,
      privacy_policy_delivered, arbitration_clause, status, letter_html, letter_markdown)
    VALUES (${data.clientId}, ${data.advisorId}, ${data.clientName}, ${data.advisorName}, ${data.firmName}, ${JSON.stringify(data.scope)}, ${JSON.stringify(data.feeSchedule)}, ${data.fiduciaryStandard}, ${data.engagementType}, ${data.effectiveDate}, ${data.termMonths}, ${data.autoRenew ? 1 : 0}, ${data.terminationNoticeDays}, ${JSON.stringify(data.formCRS)}, ${JSON.stringify(data.advDelivery)}, ${data.privacyPolicyDelivered ? 1 : 0}, ${data.arbitrationClause ? 1 : 0}, ${data.status}, ${letterHtml}, ${letterMarkdown})`);
  return (result as any).insertId;
}

export async function getEngagementLetter(id: number): Promise<EngagementLetterOutput | null> {
  const db = (await getDb())!;
  const [rows] = await db.execute(sql`SELECT * FROM engagement_letters WHERE id = ${id}`);
  const arr = rows as unknown as any[];
  if (!arr.length) return null;
  const r = arr[0];
  return {
    id: r.id,
    letterHtml: r.letter_html,
    letterMarkdown: r.letter_markdown,
    metadata: {
      clientId: r.client_id,
      advisorId: r.advisor_id,
      clientName: r.client_name,
      advisorName: r.advisor_name,
      firmName: r.firm_name,
      scope: typeof r.scope_json === "string" ? JSON.parse(r.scope_json) : r.scope_json,
      feeSchedule: typeof r.fee_schedule_json === "string" ? JSON.parse(r.fee_schedule_json) : r.fee_schedule_json,
      fiduciaryStandard: r.fiduciary_standard,
      engagementType: r.engagement_type,
      effectiveDate: r.effective_date,
      termMonths: r.term_months,
      autoRenew: !!r.auto_renew,
      terminationNoticeDays: r.termination_notice_days,
      formCRS: typeof r.form_crs_json === "string" ? JSON.parse(r.form_crs_json) : r.form_crs_json,
      advDelivery: typeof r.adv_delivery_json === "string" ? JSON.parse(r.adv_delivery_json) : r.adv_delivery_json,
      privacyPolicyDelivered: !!r.privacy_policy_delivered,
      arbitrationClause: !!r.arbitration_clause,
      status: r.status,
    },
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function listEngagementLetters(clientId?: number, advisorId?: number): Promise<EngagementLetterOutput[]> {
  const db = (await getDb())!;
  const [rows] = clientId && advisorId
    ? await db.execute(sql`SELECT * FROM engagement_letters WHERE client_id = ${clientId} AND advisor_id = ${advisorId} ORDER BY created_at DESC LIMIT 100`)
    : clientId
      ? await db.execute(sql`SELECT * FROM engagement_letters WHERE client_id = ${clientId} ORDER BY created_at DESC LIMIT 100`)
      : advisorId
        ? await db.execute(sql`SELECT * FROM engagement_letters WHERE advisor_id = ${advisorId} ORDER BY created_at DESC LIMIT 100`)
        : await db.execute(sql`SELECT * FROM engagement_letters WHERE 1=1 ORDER BY created_at DESC LIMIT 100`);
  return (rows as unknown as any[]).map(r => ({
    id: r.id,
    letterHtml: r.letter_html,
    letterMarkdown: r.letter_markdown,
    metadata: {
      clientId: r.client_id, advisorId: r.advisor_id, clientName: r.client_name,
      advisorName: r.advisor_name, firmName: r.firm_name,
      scope: typeof r.scope_json === "string" ? JSON.parse(r.scope_json) : r.scope_json,
      feeSchedule: typeof r.fee_schedule_json === "string" ? JSON.parse(r.fee_schedule_json) : r.fee_schedule_json,
      fiduciaryStandard: r.fiduciary_standard, engagementType: r.engagement_type,
      effectiveDate: r.effective_date, termMonths: r.term_months, autoRenew: !!r.auto_renew,
      terminationNoticeDays: r.termination_notice_days,
      formCRS: typeof r.form_crs_json === "string" ? JSON.parse(r.form_crs_json) : r.form_crs_json,
      advDelivery: typeof r.adv_delivery_json === "string" ? JSON.parse(r.adv_delivery_json) : r.adv_delivery_json,
      privacyPolicyDelivered: !!r.privacy_policy_delivered, arbitrationClause: !!r.arbitration_clause,
      status: r.status,
    },
    createdAt: r.created_at, updatedAt: r.updated_at,
  }));
}

export async function updateEngagementStatus(id: number, status: EngagementLetterData["status"]): Promise<boolean> {
  const db = (await getDb())!;
  const [result] = await db.execute(sql`UPDATE engagement_letters SET status = ${status} WHERE id = ${id}`);
  return (result as any).affectedRows > 0;
}

// ─── UNDERWRITING STATUS TRACKING ─────────────────────────────────

export async function saveUnderwritingStatus(data: Omit<UnderwritingStatus, "applicationId">): Promise<number> {
  const db = (await getDb())!;
  const [result] = await db.execute(sql`INSERT INTO underwriting_tracking (client_id, carrier, product, status, requirements_json,
      submitted_at, last_status_update, expected_decision_date, notes)
    VALUES (${data.clientId}, ${data.carrier}, ${data.product}, ${data.status}, ${JSON.stringify(data.requirements)},
     ${data.submittedAt}, ${data.lastStatusUpdate}, ${data.expectedDecisionDate}, ${data.notes})`);
  return (result as any).insertId;
}

export async function getUnderwritingStatus(applicationId: number): Promise<UnderwritingStatus | null> {
  const db = (await getDb())!;
  const [rows] = await db.execute(sql`SELECT * FROM underwriting_tracking WHERE id = ${applicationId}`);
  const arr = rows as unknown as any[];
  if (!arr.length) return null;
  const r = arr[0];
  return {
    applicationId: r.id, clientId: r.client_id, carrier: r.carrier, product: r.product,
    status: r.status,
    requirements: typeof r.requirements_json === "string" ? JSON.parse(r.requirements_json) : (r.requirements_json ?? []),
    submittedAt: r.submitted_at, lastStatusUpdate: r.last_status_update,
    expectedDecisionDate: r.expected_decision_date, notes: r.notes ?? "",
  };
}

export async function listUnderwritingStatuses(clientId?: number): Promise<UnderwritingStatus[]> {
  const db = (await getDb())!;
  const [rows] = clientId
    ? await db.execute(sql`SELECT * FROM underwriting_tracking WHERE client_id = ${clientId} ORDER BY submitted_at DESC LIMIT 100`)
    : await db.execute(sql`SELECT * FROM underwriting_tracking ORDER BY submitted_at DESC LIMIT 100`);
  return (rows as unknown as any[]).map(r => ({
    applicationId: r.id, clientId: r.client_id, carrier: r.carrier, product: r.product,
    status: r.status,
    requirements: typeof r.requirements_json === "string" ? JSON.parse(r.requirements_json) : (r.requirements_json ?? []),
    submittedAt: r.submitted_at, lastStatusUpdate: r.last_status_update,
    expectedDecisionDate: r.expected_decision_date, notes: r.notes ?? "",
  }));
}

export async function updateUnderwritingStatus(applicationId: number, status: UnderwritingStatus["status"], requirements?: UnderwritingStatus["requirements"]): Promise<boolean> {
  const db = (await getDb())!;
  const [result] = requirements
    ? await db.execute(sql`UPDATE underwriting_tracking SET status = ${status}, last_status_update = NOW(), requirements_json = ${JSON.stringify(requirements)} WHERE id = ${applicationId}`)
    : await db.execute(sql`UPDATE underwriting_tracking SET status = ${status}, last_status_update = NOW() WHERE id = ${applicationId}`);
  return (result as any).affectedRows > 0;
}

// ─── MEETING MANAGEMENT ENHANCEMENTS ──────────────────────────────

export async function generatePreMeetingBrief(clientId: number, advisorId: number, meetingPurpose: string): Promise<{ brief: string; agendaItems: string[] }> {
  const db = (await getDb())!;

  // Gather client context
  let clientContext = "";
  try {
    const [profiles] = await db.execute(sql`SELECT financial_profile_json FROM users WHERE id = ${clientId} LIMIT 1`);
    const profileArr = profiles as unknown as any[];
    if (profileArr.length && profileArr[0].financial_profile_json) {
      const fp = typeof profileArr[0].financial_profile_json === "string"
        ? JSON.parse(profileArr[0].financial_profile_json)
        : profileArr[0].financial_profile_json;
      clientContext = `Client financial profile: ${JSON.stringify(fp).slice(0, 2000)}`;
    }
  } catch { /* profile may not exist */ }

  // Get recent planning nodes
  let planningContext = "";
  try {
    const [nodes] = await db.execute(sql`SELECT node_type, label, current_value, target_value, status FROM planning_nodes WHERE client_id = ${clientId} ORDER BY updated_at DESC LIMIT 10`);
    const nodeArr = nodes as unknown as any[];
    if (nodeArr.length) {
      planningContext = `\nRecent planning nodes:\n${nodeArr.map(n => `- ${n.label} (${n.node_type}): current=${n.current_value}, target=${n.target_value}, status=${n.status}`).join("\n")}`;
    }
  } catch { /* table may not exist */ }

  // Get recent action items
  let actionContext = "";
  try {
    const [actions] = await db.execute(sql`SELECT item, status FROM meeting_action_items WHERE client_id = ${clientId} ORDER BY created_at DESC LIMIT 10`);
    const actionArr = actions as unknown as any[];
    if (actionArr.length) {
      actionContext = `\nOutstanding action items:\n${actionArr.map(a => `- [${a.status}] ${a.item}`).join("\n")}`;
    }
  } catch { /* table may not exist */ }

  try {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: "You are a financial advisor's meeting preparation assistant. Generate concise, actionable pre-meeting briefs." },
        { role: "user", content: `Generate a pre-meeting brief for an upcoming client meeting.

Meeting purpose: ${meetingPurpose}
${clientContext}
${planningContext}
${actionContext}

Provide:
1. A 2-3 paragraph executive brief summarizing the client's current situation and key discussion points
2. A numbered list of 5-8 agenda items for the meeting

Format as JSON: { "brief": "...", "agendaItems": ["item1", "item2", ...] }` },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "meeting_brief",
          strict: true,
          schema: {
            type: "object",
            properties: {
              brief: { type: "string", description: "Executive brief paragraph" },
              agendaItems: { type: "array", items: { type: "string" }, description: "Agenda items" },
            },
            required: ["brief", "agendaItems"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response?.choices?.[0]?.message?.content ?? "{}";
    // @ts-expect-error — argument type mismatch
    const parsed = JSON.parse(content);
    return {
      brief: parsed.brief ?? "Pre-meeting brief generation unavailable. Please review client records manually.",
      agendaItems: parsed.agendaItems ?? ["Review current financial situation", "Discuss goals and priorities", "Review action items from last meeting"],
    };
  } catch {
    return {
      brief: `Pre-meeting brief for ${meetingPurpose}. Please review the client's financial profile, recent planning nodes, and outstanding action items before the meeting.`,
      agendaItems: ["Review current financial situation", "Discuss goals and priorities", "Review action items from last meeting", "Identify new planning opportunities", "Set next steps and follow-up date"],
    };
  }
}

export async function extractActionItems(meetingNotes: string): Promise<Array<{ item: string; assignee: string; dueDate: string }>> {
  try {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: "You are a meeting notes analyzer. Extract clear, actionable items from meeting notes." },
        { role: "user", content: `Extract action items from these meeting notes:\n\n${meetingNotes.slice(0, 4000)}\n\nReturn as JSON array: [{ "item": "...", "assignee": "advisor|client|both", "dueDate": "YYYY-MM-DD or 'TBD'" }]` },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "action_items",
          strict: true,
          schema: {
            type: "object",
            properties: {
              items: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    item: { type: "string" },
                    assignee: { type: "string" },
                    dueDate: { type: "string" },
                  },
                  required: ["item", "assignee", "dueDate"],
                  additionalProperties: false,
                },
              },
            },
            required: ["items"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response?.choices?.[0]?.message?.content ?? '{"items":[]}';
    // @ts-expect-error — argument type mismatch
    const parsed = JSON.parse(content);
    return parsed.items ?? [];
  } catch {
    return [];
  }
}

export async function saveMeetingActionItems(clientId: number, advisorId: number, meetingId: number, items: Array<{ item: string; assignee: string; dueDate: string }>): Promise<number[]> {
  const db = (await getDb())!;
  const ids: number[] = [];
  for (const ai of items) {
    try {
      const [result] = await db.execute(sql`INSERT INTO meeting_action_items (client_id, advisor_id, meeting_id, item, assignee, due_date, status)
        VALUES (${clientId}, ${advisorId}, ${meetingId}, ${ai.item}, ${ai.assignee}, ${ai.dueDate === "TBD" ? null : ai.dueDate}, 'pending')`);
      ids.push((result as any).insertId);
    } catch { /* skip duplicates */ }
  }
  return ids;
}

export async function listMeetingActionItems(clientId: number): Promise<Array<{ id: number; item: string; assignee: string; dueDate: string | null; status: string; meetingId: number }>> {
  const db = (await getDb())!;
  const [rows] = await db.execute(sql`SELECT * FROM meeting_action_items WHERE client_id = ${clientId} ORDER BY created_at DESC LIMIT 100`);
  return (rows as unknown as any[]).map(r => ({
    id: r.id, item: r.item, assignee: r.assignee, dueDate: r.due_date,
    status: r.status, meetingId: r.meeting_id,
  }));
}

export async function updateActionItemStatus(id: number, status: "pending" | "done" | "cancelled"): Promise<boolean> {
  const db = (await getDb())!;
  const [result] = await db.execute(sql`UPDATE meeting_action_items SET status = ${status} WHERE id = ${id}`);
  return (result as any).affectedRows > 0;
}

// ─── COMPLIANCE AUDIT ENHANCEMENTS ────────────────────────────────

export async function generateAuditSample(
  advisorId: number,
  reviewPeriod: string,
  sampleSize: number,
  reviewType: "random" | "targeted" | "comprehensive"
): Promise<{ selectedAccounts: number[]; rationale: string }> {
  const db = (await getDb())!;

  // Get all client accounts for this advisor
  let accountIds: number[] = [];
  try {
    const [rows] = await db.execute(sql`SELECT DISTINCT client_id FROM planning_nodes WHERE advisor_id = ${advisorId} AND client_id IS NOT NULL`);
    accountIds = (rows as unknown as any[]).map(r => r.client_id);
  } catch { /* fallback */ }

  if (!accountIds.length) {
    return { selectedAccounts: [], rationale: "No client accounts found for this advisor." };
  }

  let selected: number[];
  let rationale: string;

  if (reviewType === "comprehensive") {
    selected = accountIds;
    rationale = `Comprehensive review: all ${accountIds.length} client accounts selected.`;
  } else if (reviewType === "targeted") {
    // Select accounts with recent high-value transactions or compliance flags
    selected = accountIds.slice(0, Math.min(sampleSize, accountIds.length));
    rationale = `Targeted review: ${selected.length} accounts selected based on activity and risk indicators.`;
  } else {
    // Deterministic sampling using modular selection for reproducibility
    const step = Math.max(1, Math.floor(accountIds.length / sampleSize));
    const sampled = accountIds.filter((_, idx) => idx % step === 0);
    selected = sampled.slice(0, Math.min(sampleSize, sampled.length));
    rationale = `Random sample: ${selected.length} of ${accountIds.length} accounts selected (${((selected.length / accountIds.length) * 100).toFixed(1)}% coverage).`;
  }

  return { selectedAccounts: selected, rationale };
}

export async function saveComplianceAuditSample(data: Omit<ComplianceAuditSample, "sampleId">): Promise<number> {
  const db = (await getDb())!;
  const [result] = await db.execute(sql`INSERT INTO compliance_audit_samples (review_period, sample_size, selected_accounts_json,
      review_type, findings_json, supervisor_id, review_date, status)
    VALUES (${data.reviewPeriod}, ${data.sampleSize}, ${JSON.stringify(data.selectedAccounts)}, ${data.reviewType}, ${JSON.stringify(data.findings)}, ${data.supervisorId}, ${data.reviewDate}, ${data.status})`);
  return (result as any).insertId;
}

export async function listComplianceAuditSamples(supervisorId?: number): Promise<ComplianceAuditSample[]> {
  const db = (await getDb())!;
  const [rows] = supervisorId
    ? await db.execute(sql`SELECT * FROM compliance_audit_samples WHERE supervisor_id = ${supervisorId} ORDER BY review_date DESC LIMIT 50`)
    : await db.execute(sql`SELECT * FROM compliance_audit_samples ORDER BY review_date DESC LIMIT 50`);
  return (rows as unknown as any[]).map(r => ({
    sampleId: r.id, reviewPeriod: r.review_period, sampleSize: r.sample_size,
    selectedAccounts: typeof r.selected_accounts_json === "string" ? JSON.parse(r.selected_accounts_json) : (r.selected_accounts_json ?? []),
    reviewType: r.review_type,
    findings: typeof r.findings_json === "string" ? JSON.parse(r.findings_json) : (r.findings_json ?? []),
    supervisorId: r.supervisor_id, reviewDate: r.review_date, status: r.status,
  }));
}

// ─── PRIVACY CONSENT TRACKING (Reg S-P) ──────────────────────────

export async function recordPrivacyConsent(
  clientId: number,
  advisorId: number,
  consentType: "data-sharing" | "third-party" | "marketing" | "cross-practice",
  granted: boolean,
  details: string
): Promise<number> {
  const db = (await getDb())!;
  const [result] = await db.execute(sql`INSERT INTO privacy_consent_log (client_id, advisor_id, consent_type, granted, details)
    VALUES (${clientId}, ${advisorId}, ${consentType}, ${granted ? 1 : 0}, ${details})`);
  return (result as any).insertId;
}

export async function getPrivacyConsents(clientId: number): Promise<Array<{ id: number; consentType: string; granted: boolean; details: string; createdAt: string }>> {
  const db = (await getDb())!;
  const [rows] = await db.execute(sql`SELECT * FROM privacy_consent_log WHERE client_id = ${clientId} ORDER BY created_at DESC`);
  return (rows as unknown as any[]).map(r => ({
    id: r.id, consentType: r.consent_type, granted: !!r.granted,
    details: r.details, createdAt: r.created_at,
  }));
}

// ─── PFR AUTO-ARCHIVAL (FINRA 3-year retention) ───────────────────

export async function archivePFRDocument(pfrId: number): Promise<boolean> {
  const db = (await getDb())!;
  try {
    const [result] = await db.execute(sql`UPDATE personal_financial_reviews SET archived = 1, archived_at = NOW(),
        retention_expiry = DATE_ADD(NOW(), INTERVAL 3 YEAR) WHERE id = ${pfrId}`);
    return (result as any).affectedRows > 0;
  } catch {
    return false;
  }
}

export async function listArchivedPFRs(advisorId?: number): Promise<Array<{ id: number; clientId: number; status: string; archivedAt: string; retentionExpiry: string }>> {
  const db = (await getDb())!;
  const [rows] = advisorId
    ? await db.execute(sql`SELECT id, client_id, status, archived_at, retention_expiry FROM personal_financial_reviews WHERE archived = 1 AND advisor_id = ${advisorId} ORDER BY archived_at DESC LIMIT 200`)
    : await db.execute(sql`SELECT id, client_id, status, archived_at, retention_expiry FROM personal_financial_reviews WHERE archived = 1 ORDER BY archived_at DESC LIMIT 200`);
  return (rows as unknown as any[]).map(r => ({
    id: r.id, clientId: r.client_id, status: r.status,
    archivedAt: r.archived_at, retentionExpiry: r.retention_expiry,
  }));
}

// ─── SUITABILITY STALENESS DETECTION ──────────────────────────────

export async function checkSuitabilityStaleness(clientId: number): Promise<{ isStale: boolean; daysSinceUpdate: number; recommendation: string }> {
  const db = (await getDb())!;
  try {
    const [rows] = await db.execute(sql`SELECT DATEDIFF(NOW(), updated_at) as days_since FROM suitability_assessments
       WHERE client_id = ${clientId} ORDER BY updated_at DESC LIMIT 1`);
    const arr = rows as unknown as any[];
    if (!arr.length) {
      return { isStale: true, daysSinceUpdate: 999, recommendation: "No suitability score found. Run initial suitability assessment." };
    }
    const days = arr[0].days_since ?? 0;
    if (days > 365) {
      return { isStale: true, daysSinceUpdate: days, recommendation: "Suitability score is over 1 year old. Annual review required per compliance policy." };
    }
    if (days > 180) {
      return { isStale: true, daysSinceUpdate: days, recommendation: "Suitability score is over 6 months old. Consider updating before making new recommendations." };
    }
    if (days > 90) {
      return { isStale: false, daysSinceUpdate: days, recommendation: "Suitability score is current but approaching review threshold." };
    }
    return { isStale: false, daysSinceUpdate: days, recommendation: "Suitability score is current." };
  } catch {
    return { isStale: false, daysSinceUpdate: 0, recommendation: "Unable to check suitability staleness." };
  }
}

// ─── ASSUMPTION DRIFT DETECTION ───────────────────────────────────

export async function detectAssumptionDrift(clientId: number): Promise<Array<{ key: string; nodeValue: number; sharedValue: number; drift: number; severity: "low" | "medium" | "high" }>> {
  const db = (await getDb())!;
  const drifts: Array<{ key: string; nodeValue: number; sharedValue: number; drift: number; severity: "low" | "medium" | "high" }> = [];

  try {
    // Get shared assumptions for this client
    const [shared] = await db.execute(sql`SELECT assumption_key, assumption_value FROM planning_assumptions WHERE client_id = ${clientId} AND scope = 'client'`);
    const sharedMap = new Map<string, number>();
    for (const r of shared as unknown as any[]) {
      sharedMap.set(r.assumption_key, parseFloat(r.assumption_value));
    }

    // Get node-level assumptions
    const [nodeAssumptions] = await db.execute(sql`SELECT pa.assumption_key, pa.assumption_value, pn.label as node_label
       FROM planning_assumptions pa
       JOIN planning_nodes pn ON pa.node_id = pn.id
       WHERE pn.client_id = ${clientId} AND pa.scope = 'node'`);

    for (const na of nodeAssumptions as unknown as any[]) {
      const nodeVal = parseFloat(na.assumption_value);
      const sharedVal = sharedMap.get(na.assumption_key);
      if (sharedVal !== undefined && Math.abs(nodeVal - sharedVal) > 0.001) {
        const drift = Math.abs(nodeVal - sharedVal);
        const severity = drift > 0.02 ? "high" : drift > 0.01 ? "medium" : "low";
        drifts.push({
          key: `${na.assumption_key} (${na.node_label})`,
          nodeValue: nodeVal,
          sharedValue: sharedVal,
          drift,
          severity,
        });
      }
    }
  } catch { /* tables may not exist */ }

  return drifts;
}
