/**
 * Embed Manager — /embed/{calculatorType}?advisorId={id}&theme={light|dark}
 * Stripped UI, advisor-attributed leads. Requires embed_compliance_approved=true.
 */
import { getDb } from "../../db";
import { logger } from "../../_core/logger";

const log = logger.child({ module: "embedManager" });

export interface EmbedConfig {
  advisorId: number;
  calculatorType: string;
  embedDomain: string;
  theme: string;
  customCta: string | null;
  enabled: boolean;
  complianceApproved: boolean;
}

export async function getEmbedConfig(advisorId: number, calculatorType: string): Promise<EmbedConfig | null> {
  const db = await getDb();
  if (!db) return null;

  try {
    const { embedConfigurations } = await import("../../../drizzle/schema");
    const { eq, and } = await import("drizzle-orm");

    const [config] = await db.select().from(embedConfigurations)
      .where(and(
        eq(embedConfigurations.advisorId, advisorId),
        eq(embedConfigurations.calculatorType, calculatorType),
      )).limit(1);

    if (!config) return null;

    return {
      advisorId: config.advisorId,
      calculatorType: config.calculatorType,
      embedDomain: config.embedDomain || "",
      theme: config.theme || "dark",
      customCta: config.customCta,
      enabled: config.enabled ?? true,
      complianceApproved: config.embedComplianceApproved ?? false,
    };
  } catch {
    return null;
  }
}

export function generateEmbedCode(baseUrl: string, advisorId: number, calculatorType: string, theme = "dark"): string {
  return `<iframe
  src="${baseUrl}/embed/${calculatorType}?advisorId=${advisorId}&theme=${theme}"
  width="100%"
  height="800"
  frameborder="0"
  style="border: none; border-radius: 8px;"
  title="Financial Calculator — Powered by Stewardly"
  allow="clipboard-write"
></iframe>
<p style="font-size: 11px; color: #888; margin-top: 4px;">
  Powered by <a href="${baseUrl}" target="_blank" rel="noopener">Stewardly</a> | Not investment advice
</p>`;
}

export async function trackEmbedLead(advisorId: number, calculatorType: string): Promise<void> {
  const db = await getDb();
  if (!db) return;

  try {
    const { embedConfigurations } = await import("../../../drizzle/schema");
    const { eq, and, sql } = await import("drizzle-orm");

    await db.update(embedConfigurations)
      .set({ leadsGenerated: sql`${embedConfigurations.leadsGenerated} + 1` })
      .where(and(
        eq(embedConfigurations.advisorId, advisorId),
        eq(embedConfigurations.calculatorType, calculatorType),
      ));
  } catch { /* non-critical */ }
}
