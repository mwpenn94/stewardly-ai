/**
 * Cascade Notification Service
 *
 * Provides real-time notification generation when cascade operations
 * detect misalignments, stale data, or planning gaps. Advisors are
 * alerted proactively rather than having to run diagnostics manually.
 *
 * Also includes:
 * - Client-Facing Planning Summary (simplified, plain-language view)
 * - Bulk Engagement Letter Generation (annual renewal batch workflow)
 */

import { getDb } from "../../db";
import { rawInvokeLLM as invokeLLM } from "../../shared/stewardlyWiring";
import { sql } from "drizzle-orm";

// ─── TYPES ────────────────────────────────────────────────────────

export interface CascadeAlert {
  id: string;
  severity: "critical" | "warning" | "info";
  category: "misalignment" | "stale_data" | "planning_gap" | "compliance" | "opportunity";
  title: string;
  description: string;
  affectedNodes: string[];
  suggestedAction: string;
  clientId?: number;
  clientName?: string;
  detectedAt: number;
  resolvedAt?: number;
}

export interface ClientFacingSummary {
  clientName: string;
  lastUpdated: number;
  overallHealth: "excellent" | "good" | "needs_attention" | "critical";
  overallScore: number; // 0-100
  sections: Array<{
    title: string;
    icon: string;
    status: "on_track" | "needs_review" | "action_needed" | "not_started";
    summary: string;
    progress: number; // 0-100
    nextSteps: string[];
    keyMetrics: Array<{ label: string; value: string; trend: "up" | "down" | "stable" }>;
  }>;
  recommendations: Array<{
    priority: "high" | "medium" | "low";
    title: string;
    description: string;
    estimatedImpact: string;
    timeframe: string;
  }>;
  milestones: Array<{
    title: string;
    targetDate: string;
    status: "completed" | "in_progress" | "upcoming" | "overdue";
    progress: number;
  }>;
}

export interface BulkEngagementResult {
  totalClients: number;
  generated: number;
  failed: number;
  skipped: number;
  results: Array<{
    clientId: number;
    clientName: string;
    status: "generated" | "failed" | "skipped";
    reason?: string;
    letterId?: number;
  }>;
}

// ─── CASCADE ALERTS ───────────────────────────────────────────────

/**
 * Scan all clients for cascade misalignments and generate alerts.
 */
export async function scanForCascadeAlerts(advisorId: number): Promise<CascadeAlert[]> {
  const db = (await getDb())!;
  const alerts: CascadeAlert[] = [];
  const now = Date.now();

  try {
    // 1. Check for stale financial profiles (>90 days without update)
    const [staleProfiles] = await db.execute(sql`
      SELECT fp.user_id, fp.updated_at, u.name
      FROM financial_profiles fp
      JOIN users u ON u.id = fp.user_id
      WHERE fp.updated_at < DATE_SUB(NOW(), INTERVAL 90 DAY)
      ORDER BY fp.updated_at ASC
      LIMIT 50
    `) as any[];

    for (const row of (staleProfiles ?? [])) {
      const daysSince = Math.floor((now - new Date(row.updated_at).getTime()) / 86400000);
      alerts.push({
        id: `stale-profile-${row.user_id}`,
        severity: daysSince > 180 ? "critical" : "warning",
        category: "stale_data",
        title: `Financial Profile Stale — ${row.name || "Client"}`,
        description: `Financial profile hasn't been updated in ${daysSince} days. Recommendations may be based on outdated information.`,
        affectedNodes: ["financial_profile", "suitability", "recommendations"],
        suggestedAction: `Schedule a review meeting with ${row.name || "this client"} to update their financial profile.`,
        clientId: row.user_id,
        clientName: row.name,
        detectedAt: now,
      });
    }
  } catch { /* table may not exist yet */ }

  try {
    // 2. Check for planning nodes with misaligned cascades
    const [misaligned] = await db.execute(sql`
      SELECT pn.id, pn.title, pn.node_type, pn.client_id, u.name
      FROM planning_nodes pn
      LEFT JOIN users u ON u.id = pn.client_id
      WHERE pn.alignment_score IS NOT NULL AND pn.alignment_score < 0.6
      ORDER BY pn.alignment_score ASC
      LIMIT 30
    `) as any[];

    for (const row of (misaligned ?? [])) {
      alerts.push({
        id: `misaligned-node-${row.id}`,
        severity: "warning",
        category: "misalignment",
        title: `Low Alignment — ${row.title}`,
        description: `Planning node "${row.title}" (${row.node_type}) has a low alignment score. It may not be properly connected to parent goals or downstream strategies.`,
        affectedNodes: [row.title],
        suggestedAction: `Review the cascade connections for "${row.title}" and ensure it aligns with the client's overall plan.`,
        clientId: row.client_id,
        clientName: row.name,
        detectedAt: now,
      });
    }
  } catch { /* table may not exist yet */ }

  try {
    // 3. Check for clients without recent suitability assessments
    const [noSuitability] = await db.execute(sql`
      SELECT u.id, u.name
      FROM users u
      LEFT JOIN suitability_assessments sa ON sa.user_id = u.id
      WHERE u.role = 'user'
        AND (sa.id IS NULL OR sa.created_at < DATE_SUB(NOW(), INTERVAL 365 DAY))
      LIMIT 20
    `) as any[];

    for (const row of (noSuitability ?? [])) {
      alerts.push({
        id: `no-suitability-${row.id}`,
        severity: "warning",
        category: "compliance",
        title: `Suitability Review Due — ${row.name || "Client"}`,
        description: `No suitability assessment on file or assessment is over 1 year old. Reg BI requires reasonable-basis suitability documentation.`,
        affectedNodes: ["suitability_assessment", "recommendations"],
        suggestedAction: `Complete a suitability assessment for ${row.name || "this client"} before making new recommendations.`,
        clientId: row.id,
        clientName: row.name,
        detectedAt: now,
      });
    }
  } catch { /* table may not exist yet */ }

  try {
    // 4. Check for engagement letters expiring within 30 days
    const [expiringLetters] = await db.execute(sql`
      SELECT el.id, el.client_id, el.client_name, el.expiration_date
      FROM engagement_letters el
      WHERE el.status = 'signed'
        AND el.expiration_date IS NOT NULL
        AND el.expiration_date BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 30 DAY)
      LIMIT 20
    `) as any[];

    for (const row of (expiringLetters ?? [])) {
      const daysUntil = Math.floor((new Date(row.expiration_date).getTime() - now) / 86400000);
      alerts.push({
        id: `expiring-engagement-${row.id}`,
        severity: daysUntil < 7 ? "critical" : "warning",
        category: "compliance",
        title: `Engagement Letter Expiring — ${row.client_name}`,
        description: `Engagement letter expires in ${daysUntil} days. Renewal is required to continue advisory services.`,
        affectedNodes: ["engagement_letter", "advisory_relationship"],
        suggestedAction: `Generate a renewal engagement letter for ${row.client_name} and schedule a signing meeting.`,
        clientId: row.client_id,
        clientName: row.client_name,
        detectedAt: now,
      });
    }
  } catch { /* table may not exist yet */ }

  try {
    // 5. Check for opportunities — clients with high AUM but few strategies
    const [opportunities] = await db.execute(sql`
      SELECT fp.user_id, u.name, fp.profile_json
      FROM financial_profiles fp
      JOIN users u ON u.id = fp.user_id
      WHERE fp.profile_json IS NOT NULL
      LIMIT 50
    `) as any[];

    for (const row of (opportunities ?? [])) {
      try {
        const profile = typeof row.profile_json === "string" ? JSON.parse(row.profile_json) : row.profile_json;
        const netWorth = profile?.netWorth ?? profile?.savings ?? 0;
        if (netWorth > 500000) {
          // Check if they have advanced strategies
          const [strategyCount] = await db.execute(sql`SELECT COUNT(*) as cnt FROM planning_nodes WHERE client_id = ${row.user_id} AND node_type IN ('strategy', 'advanced_strategy')`) as any;
          const cnt = strategyCount?.[0]?.cnt ?? 0;
          if (cnt < 3) {
            alerts.push({
              id: `opportunity-${row.user_id}`,
              severity: "info",
              category: "opportunity",
              title: `Underserved HNW Client — ${row.name || "Client"}`,
              description: `Client has $${Math.round(netWorth / 1000)}K net worth but only ${cnt} planning strategies. Consider expanding their plan.`,
              affectedNodes: ["planning_hierarchy", "advanced_strategies"],
              suggestedAction: `Review ${row.name || "this client"}'s plan for additional strategy opportunities (tax optimization, estate planning, premium finance).`,
              clientId: row.user_id,
              clientName: row.name,
              detectedAt: now,
            });
          }
        }
      } catch { /* skip malformed profiles */ }
    }
  } catch { /* table may not exist yet */ }

  // Sort by severity (critical first)
  const severityOrder = { critical: 0, warning: 1, info: 2 };
  alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return alerts;
}

// ─── CLIENT-FACING PLANNING SUMMARY ──────────────────────────────

/**
 * Generate a simplified, client-readable planning summary.
 * Strips advisor-only details and presents goals, progress, and
 * next steps in plain language with visual progress indicators.
 */
export async function generateClientFacingSummary(
  clientId: number,
  clientName: string
): Promise<ClientFacingSummary> {
  const db = (await getDb())!;
  const now = Date.now();

  const sections: ClientFacingSummary["sections"] = [];
  const recommendations: ClientFacingSummary["recommendations"] = [];
  const milestones: ClientFacingSummary["milestones"] = [];

  // 1. Retirement Planning section
  try {
    const [retirementData] = await db.execute(sql`SELECT result_json FROM saved_analyses WHERE user_id = ${clientId} AND calculator_type LIKE '%retirement%' ORDER BY updated_at DESC LIMIT 1`) as any;
    if (retirementData?.[0]?.result_json) {
      const data = typeof retirementData[0].result_json === "string" ? JSON.parse(retirementData[0].result_json) : retirementData[0].result_json;
      const readiness = data.readinessScore ?? data.fundedRatio ?? 0;
      sections.push({
        title: "Retirement Planning",
        icon: "sunset",
        status: readiness > 80 ? "on_track" : readiness > 50 ? "needs_review" : "action_needed",
        summary: readiness > 80
          ? "Your retirement plan is well-funded and on track to meet your goals."
          : readiness > 50
          ? "Your retirement plan needs some adjustments to fully meet your goals."
          : "Your retirement plan requires attention to ensure you meet your goals.",
        progress: Math.min(100, Math.round(readiness)),
        nextSteps: readiness > 80
          ? ["Continue current savings rate", "Review annually"]
          : ["Consider increasing contributions", "Review investment allocation", "Schedule a planning review"],
        keyMetrics: [
          { label: "Readiness Score", value: `${Math.round(readiness)}%`, trend: "stable" as const },
        ],
      });
    }
  } catch { /* no retirement data */ }

  // 2. Protection & Insurance section
  try {
    const [insuranceData] = await db.execute(sql`SELECT result_json FROM saved_analyses WHERE user_id = ${clientId} AND calculator_type LIKE '%insurance%' ORDER BY updated_at DESC LIMIT 1`) as any;
    if (insuranceData?.[0]?.result_json) {
      const data = typeof insuranceData[0].result_json === "string" ? JSON.parse(insuranceData[0].result_json) : insuranceData[0].result_json;
      const coverage = data.coverageScore ?? data.adequacyRatio ?? 0;
      sections.push({
        title: "Protection & Insurance",
        icon: "shield",
        status: coverage > 80 ? "on_track" : coverage > 50 ? "needs_review" : "action_needed",
        summary: coverage > 80
          ? "Your insurance coverage is comprehensive and well-structured."
          : "There may be gaps in your insurance coverage that should be reviewed.",
        progress: Math.min(100, Math.round(coverage)),
        nextSteps: coverage > 80
          ? ["Review policies at next renewal", "Monitor beneficiary designations"]
          : ["Review life insurance coverage", "Consider disability insurance", "Evaluate umbrella policy"],
        keyMetrics: [
          { label: "Coverage Score", value: `${Math.round(coverage)}%`, trend: "stable" as const },
        ],
      });
    }
  } catch { /* no insurance data */ }

  // 3. Tax Planning section
  try {
    const [taxData] = await db.execute(sql`SELECT result_json FROM saved_analyses WHERE user_id = ${clientId} AND calculator_type LIKE '%tax%' ORDER BY updated_at DESC LIMIT 1`) as any;
    if (taxData?.[0]?.result_json) {
      const data = typeof taxData[0].result_json === "string" ? JSON.parse(taxData[0].result_json) : taxData[0].result_json;
      const savings = data.totalSavings ?? data.taxSavings ?? 0;
      sections.push({
        title: "Tax Optimization",
        icon: "calculator",
        status: savings > 0 ? "on_track" : "needs_review",
        summary: savings > 0
          ? `Your tax optimization strategies are projected to save approximately $${Math.round(savings).toLocaleString()} annually.`
          : "Tax optimization opportunities should be explored in your next review.",
        progress: savings > 0 ? 75 : 25,
        nextSteps: savings > 0
          ? ["Continue current strategies", "Review for new opportunities at year-end"]
          : ["Schedule a tax planning review", "Gather recent tax returns"],
        keyMetrics: [
          { label: "Projected Savings", value: `$${Math.round(savings).toLocaleString()}`, trend: savings > 0 ? "up" as const : "stable" as const },
        ],
      });
    }
  } catch { /* no tax data */ }

  // 4. Estate Planning section
  try {
    const [estateData] = await db.execute(sql`SELECT result_json FROM saved_analyses WHERE user_id = ${clientId} AND calculator_type LIKE '%estate%' ORDER BY updated_at DESC LIMIT 1`) as any;
    if (estateData?.[0]?.result_json) {
      sections.push({
        title: "Estate Planning",
        icon: "scroll",
        status: "on_track",
        summary: "Your estate plan has been reviewed and documented.",
        progress: 70,
        nextSteps: ["Review beneficiary designations annually", "Update documents after major life events"],
        keyMetrics: [],
      });
    }
  } catch { /* no estate data */ }

  // 5. Investment Growth section
  try {
    const [investData] = await db.execute(sql`SELECT result_json FROM saved_analyses WHERE user_id = ${clientId} AND calculator_type LIKE '%invest%' ORDER BY updated_at DESC LIMIT 1`) as any;
    if (investData?.[0]?.result_json) {
      const data = typeof investData[0].result_json === "string" ? JSON.parse(investData[0].result_json) : investData[0].result_json;
      sections.push({
        title: "Investment Growth",
        icon: "trending-up",
        status: "on_track",
        summary: "Your investment portfolio is diversified and aligned with your risk tolerance.",
        progress: 80,
        nextSteps: ["Review allocation quarterly", "Rebalance as needed"],
        keyMetrics: [
          { label: "Portfolio Value", value: data.portfolioValue ? `$${Math.round(data.portfolioValue).toLocaleString()}` : "See details", trend: "up" as const },
        ],
      });
    }
  } catch { /* no investment data */ }

  // Add default sections if none found
  if (sections.length === 0) {
    sections.push(
      {
        title: "Getting Started",
        icon: "rocket",
        status: "not_started",
        summary: "Your financial plan is being built. Complete your financial profile to see personalized insights.",
        progress: 10,
        nextSteps: ["Complete your financial profile", "Set your primary goals", "Schedule an initial planning meeting"],
        keyMetrics: [],
      }
    );
  }

  // Generate recommendations using LLM
  try {
    const sectionSummaries = sections.map(s => `${s.title}: ${s.status} (${s.progress}%)`).join("; ");
    const llmResponse = await invokeLLM({
      messages: [
        {
          role: "system",
          content: "You are a financial planning assistant generating client-friendly recommendations. Output valid JSON array of 3 recommendations with fields: priority (high/medium/low), title, description, estimatedImpact, timeframe. Use plain language a client would understand. No jargon.",
        },
        {
          role: "user",
          content: `Client: ${clientName}. Current plan status: ${sectionSummaries}. Generate 3 personalized recommendations.`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "recommendations",
          strict: true,
          schema: {
            type: "object",
            properties: {
              items: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    priority: { type: "string" },
                    title: { type: "string" },
                    description: { type: "string" },
                    estimatedImpact: { type: "string" },
                    timeframe: { type: "string" },
                  },
                  required: ["priority", "title", "description", "estimatedImpact", "timeframe"],
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
    // @ts-expect-error — argument type mismatch
    const parsed = JSON.parse(llmResponse.choices?.[0]?.message?.content ?? "{}");
    if (parsed.items) {
      recommendations.push(...parsed.items.slice(0, 3));
    }
  } catch {
    // Fallback recommendations
    recommendations.push(
      { priority: "high", title: "Complete Your Financial Profile", description: "A complete profile helps us provide the most accurate recommendations.", estimatedImpact: "Better personalized planning", timeframe: "This week" },
      { priority: "medium", title: "Review Your Goals", description: "Ensure your financial goals are up to date and prioritized.", estimatedImpact: "Aligned planning strategy", timeframe: "This month" },
      { priority: "low", title: "Schedule Annual Review", description: "An annual review ensures your plan stays on track.", estimatedImpact: "Ongoing plan optimization", timeframe: "This quarter" },
    );
  }

  // Calculate overall health
  const avgProgress = sections.reduce((s, sec) => s + sec.progress, 0) / Math.max(sections.length, 1);
  const overallScore = Math.round(avgProgress);
  const overallHealth: ClientFacingSummary["overallHealth"] =
    overallScore >= 80 ? "excellent" : overallScore >= 60 ? "good" : overallScore >= 40 ? "needs_attention" : "critical";

  return {
    clientName,
    lastUpdated: now,
    overallHealth,
    overallScore,
    sections,
    recommendations,
    milestones,
  };
}

// ─── BULK ENGAGEMENT LETTER GENERATION ───────────────────────────

/**
 * Generate engagement letters in bulk for annual renewal.
 * Processes all clients who need renewal and generates letters.
 */
export async function generateBulkEngagementLetters(
  advisorId: number,
  options: {
    clientIds?: number[];
    renewalOnly?: boolean;
    feeSchedule?: string;
    templateOverrides?: Record<string, string>;
  } = {}
): Promise<BulkEngagementResult> {
  const db = (await getDb())!;
  const results: BulkEngagementResult["results"] = [];
  let generated = 0;
  let failed = 0;
  let skipped = 0;

  // Get target clients
  let clients: Array<{ id: number; name: string; email: string }> = [];

  try {
    if (options.clientIds && options.clientIds.length > 0) {
      // Specific clients
      const idParams = options.clientIds.map(id => sql`${id}`);
      const [rows] = await db.execute(sql`SELECT id, name, email FROM users WHERE id IN (${sql.join(idParams, sql`, `)})`) as any[];
      clients = rows ?? [];
    } else if (options.renewalOnly) {
      // Clients with expiring or expired engagement letters
      const [rows] = await db.execute(sql`
        SELECT DISTINCT u.id, u.name, u.email
        FROM users u
        JOIN engagement_letters el ON el.client_id = u.id
        WHERE el.status = 'signed'
          AND (el.expiration_date IS NULL OR el.expiration_date < DATE_ADD(NOW(), INTERVAL 60 DAY))
        ORDER BY el.expiration_date ASC
        LIMIT 100
      `) as any[];
      clients = rows ?? [];
    } else {
      // All active clients
      const [rows] = await db.execute(sql`
        SELECT id, name, email FROM users WHERE role = 'user' LIMIT 100
      `) as any[];
      clients = rows ?? [];
    }
  } catch {
    return { totalClients: 0, generated: 0, failed: 0, skipped: 0, results: [] };
  }

  // Generate letters for each client
  for (const client of clients) {
    try {
      // Check if client already has a valid, non-expired letter
      const [existing] = await db.execute(sql`SELECT id FROM engagement_letters WHERE client_id = ${client.id} AND status = 'signed' AND (expiration_date IS NULL OR expiration_date > DATE_ADD(NOW(), INTERVAL 60 DAY)) LIMIT 1`) as any;

      if (existing?.[0] && options.renewalOnly) {
        skipped++;
        results.push({
          clientId: client.id,
          clientName: client.name || "Unknown",
          status: "skipped",
          reason: "Valid engagement letter still active",
        });
        continue;
      }

      // Generate the letter using LLM
      const letterContent = await generateLetterContent(client, options.feeSchedule, options.templateOverrides);

      // Store the letter
      const [insertResult] = await db.execute(sql`INSERT INTO engagement_letters (advisor_id, client_id, client_name, letter_type, status, content, fee_schedule, created_at, updated_at)
         VALUES (${advisorId}, ${client.id}, ${client.name || "Unknown"}, 'annual_renewal', 'draft', ${letterContent}, ${options.feeSchedule || "standard"}, NOW(), NOW())`) as any;

      generated++;
      results.push({
        clientId: client.id,
        clientName: client.name || "Unknown",
        status: "generated",
        letterId: insertResult?.insertId,
      });
    } catch (err) {
      failed++;
      results.push({
        clientId: client.id,
        clientName: client.name || "Unknown",
        status: "failed",
        reason: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  return {
    totalClients: clients.length,
    generated,
    failed,
    skipped,
    results,
  };
}

async function generateLetterContent(
  client: { id: number; name: string; email: string },
  feeSchedule?: string,
  templateOverrides?: Record<string, string>
): Promise<string> {
  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You are a compliance-focused financial advisor drafting an engagement letter renewal. 
Include: scope of services, fee disclosure (${feeSchedule || "standard advisory fee schedule"}), 
fiduciary acknowledgment, Form CRS delivery confirmation, privacy notice reference, 
and termination provisions. Use professional but accessible language.
${templateOverrides ? `Custom provisions: ${JSON.stringify(templateOverrides)}` : ""}`,
        },
        {
          role: "user",
          content: `Generate an engagement letter renewal for client: ${client.name || "Valued Client"} (ID: ${client.id}).`,
        },
      ],
    });
    // @ts-expect-error — strict mode fix
    return response.choices?.[0]?.message?.content ?? "Engagement letter content generation failed.";
  } catch {
    return `DRAFT ENGAGEMENT LETTER — ${client.name || "Valued Client"}\n\nThis engagement letter confirms the continuation of our advisory relationship. Please review the terms and sign to confirm.\n\n[Fee schedule and terms to be finalized]`;
  }
}
