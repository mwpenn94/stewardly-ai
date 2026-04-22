/**
 * Shared Assumptions Service
 * 
 * Resolves calculator assumptions by walking the planning hierarchy:
 *   client → advisor → team → platform
 * 
 * Ensures all calculators use consistent inputs (inflation rate, return assumptions,
 * tax rates, etc.) unless explicitly overridden at a lower scope.
 * 
 * Addresses CFP Assessment §8.1 "Calculator assumption drift" silent failure mode.
 */
import { getDb } from "../../db";
import { sharedAssumptions } from "../../../drizzle/schema";
import { eq, and, isNull } from "drizzle-orm";

/** Standard assumption keys with sensible defaults */
export const DEFAULT_ASSUMPTIONS: Record<string, { value: number; label: string; source: string }> = {
  inflation_rate: { value: 3.0, label: "Annual Inflation Rate (%)", source: "20-year CPI average" },
  equity_return: { value: 8.5, label: "Equity Return Assumption (%)", source: "S&P 500 30-year average" },
  bond_return: { value: 4.0, label: "Bond Return Assumption (%)", source: "Bloomberg Agg 20-year" },
  risk_free_rate: { value: 4.5, label: "Risk-Free Rate (%)", source: "10-year Treasury yield" },
  tax_rate_federal: { value: 24.0, label: "Federal Tax Rate (%)", source: "Median effective rate" },
  tax_rate_state: { value: 5.0, label: "State Tax Rate (%)", source: "Median state rate" },
  social_security_cola: { value: 2.5, label: "SS COLA Assumption (%)", source: "SSA 20-year average" },
  life_expectancy_male: { value: 85, label: "Male Life Expectancy", source: "SSA actuarial tables" },
  life_expectancy_female: { value: 88, label: "Female Life Expectancy", source: "SSA actuarial tables" },
  disability_probability: { value: 25.0, label: "Disability Probability Before 65 (%)", source: "SSA data" },
  healthcare_inflation: { value: 6.0, label: "Healthcare Inflation (%)", source: "CMS projections" },
  college_inflation: { value: 5.0, label: "College Cost Inflation (%)", source: "College Board data" },
  estate_exemption: { value: 13610000, label: "Federal Estate Exemption ($)", source: "IRS 2024" },
  annual_gift_exclusion: { value: 18000, label: "Annual Gift Exclusion ($)", source: "IRS 2024" },
  ira_contribution_limit: { value: 7000, label: "IRA Contribution Limit ($)", source: "IRS 2024" },
  k401_contribution_limit: { value: 23000, label: "401(k) Contribution Limit ($)", source: "IRS 2024" },
  catch_up_contribution: { value: 7500, label: "Catch-Up Contribution ($)", source: "IRS 2024" },
  premium_finance_rate: { value: 6.5, label: "Premium Finance Rate (%)", source: "Market average" },
  policy_loan_rate: { value: 5.0, label: "Policy Loan Rate (%)", source: "Carrier average" },
  dividend_scale_interest: { value: 5.5, label: "Dividend Scale Interest (%)", source: "Top-10 carrier avg" },
};

/**
 * Resolve assumptions for a given scope, walking up the hierarchy.
 * Client overrides → Advisor overrides → Team overrides → Platform overrides → Defaults
 */
export async function resolveAssumptions(
  ownerId: number,
  clientId?: number,
  advisorId?: number,
  teamId?: number,
): Promise<Record<string, { value: number; label: string; source: string; scope: string }>> {
  const db = (await getDb())!;
  
  // Start with defaults
  const resolved: Record<string, { value: number; label: string; source: string; scope: string }> = {};
  for (const [key, def] of Object.entries(DEFAULT_ASSUMPTIONS)) {
    resolved[key] = { ...def, scope: "default" };
  }

  // Fetch all relevant assumptions in one query
  const allAssumptions = await db.select().from(sharedAssumptions).where(
    eq(sharedAssumptions.ownerId, ownerId)
  );

  // Apply in order: platform → team → advisor → client (later overrides earlier)
  const scopes: Array<{ scope: string; entityId?: number }> = [
    { scope: "platform" },
    ...(teamId ? [{ scope: "team", entityId: teamId }] : []),
    ...(advisorId ? [{ scope: "advisor", entityId: advisorId }] : []),
    ...(clientId ? [{ scope: "client", entityId: clientId }] : []),
  ];

  for (const s of scopes) {
    const matching = allAssumptions.filter(a => 
      a.scope === s.scope && 
      (s.entityId ? a.scopeEntityId === s.entityId : !a.scopeEntityId)
    );
    for (const a of matching) {
      resolved[a.assumptionKey] = {
        value: Number(a.assumptionValue),
        label: a.assumptionLabel || a.assumptionKey,
        source: a.source || `${a.scope} override`,
        scope: a.scope,
      };
    }
  }

  return resolved;
}

/**
 * Set or update an assumption at a specific scope level.
 */
export async function setAssumption(
  ownerId: number,
  scope: "platform" | "team" | "advisor" | "client",
  scopeEntityId: number | null,
  key: string,
  value: number,
  label?: string,
  source?: string,
): Promise<void> {
  const db = (await getDb())!;
  
  // Upsert: check if exists
  const existing = await db.select().from(sharedAssumptions).where(
    and(
      eq(sharedAssumptions.ownerId, ownerId),
      eq(sharedAssumptions.scope, scope),
      eq(sharedAssumptions.assumptionKey, key),
      scopeEntityId 
        ? eq(sharedAssumptions.scopeEntityId, scopeEntityId) 
        : isNull(sharedAssumptions.scopeEntityId)
    )
  );

  if (existing.length > 0) {
    await db.update(sharedAssumptions)
      .set({ 
        assumptionValue: String(value),
        ...(label && { assumptionLabel: label }),
        ...(source && { source }),
      })
      .where(eq(sharedAssumptions.id, existing[0].id));
  } else {
    await db.insert(sharedAssumptions).values({
      ownerId,
      scope,
      scopeEntityId,
      assumptionKey: key,
      assumptionValue: String(value),
      assumptionLabel: label || DEFAULT_ASSUMPTIONS[key]?.label || key,
      source: source || `${scope} override`,
    });
  }
}

/**
 * Get all assumptions at a specific scope (without hierarchy resolution).
 */
export async function getAssumptionsForScope(
  ownerId: number,
  scope: "platform" | "team" | "advisor" | "client",
  scopeEntityId?: number,
): Promise<Array<{ key: string; value: number; label: string; source: string }>> {
  const db = (await getDb())!;
  
  const rows = await db.select().from(sharedAssumptions).where(
    and(
      eq(sharedAssumptions.ownerId, ownerId),
      eq(sharedAssumptions.scope, scope),
      scopeEntityId 
        ? eq(sharedAssumptions.scopeEntityId, scopeEntityId) 
        : isNull(sharedAssumptions.scopeEntityId)
    )
  );

  return rows.map(r => ({
    key: r.assumptionKey,
    value: Number(r.assumptionValue),
    label: r.assumptionLabel || r.assumptionKey,
    source: r.source || "",
  }));
}
