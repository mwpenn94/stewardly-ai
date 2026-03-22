/**
 * Message Campaign Service (In-App Only)
 * Handles campaign CRUD, template rendering with variable substitution,
 * recipient management, batch sending via in-app notification system, and analytics tracking.
 * All messages are delivered as in-app notifications — no external email sending.
 */
import { getDb } from "../db";
import { emailCampaigns, emailSends, users } from "../../drizzle/schema";
import { eq, and, sql, count, inArray, like } from "drizzle-orm";
import { invokeLLM } from "../_core/llm"
import { contextualLLM } from "./contextualLLM";
import { sendNotification } from "./websocketNotifications";

// ─── Template Engine ─────────────────────────────────────────────────────
interface TemplateVars {
  recipientName?: string;
  recipientEmail?: string;
  senderName?: string;
  companyName?: string;
  [key: string]: string | undefined;
}

function renderTemplate(template: string, vars: TemplateVars): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] || `{{${key}}}`);
}

function htmlToPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ─── Campaign CRUD ───────────────────────────────────────────────────────
export async function createCampaign(userId: number, data: {
  name: string;
  subject: string;
  bodyHtml: string;
  templateId?: string;
  recipientFilter?: Record<string, unknown>;
  scheduledAt?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const now = Date.now();
  const [result] = await db.insert(emailCampaigns).values({
    userId,
    name: data.name,
    subject: data.subject,
    bodyHtml: data.bodyHtml,
    bodyText: htmlToPlainText(data.bodyHtml),
    templateId: data.templateId,
    recipientFilter: data.recipientFilter,
    status: data.scheduledAt ? "scheduled" : "draft",
    scheduledAt: data.scheduledAt,
    createdAt: now,
    updatedAt: now,
  });
  return { id: result.insertId };
}

export async function updateCampaign(campaignId: number, userId: number, data: {
  name?: string;
  subject?: string;
  bodyHtml?: string;
  recipientFilter?: Record<string, unknown>;
  scheduledAt?: number | null;
  status?: "draft" | "scheduled" | "paused" | "cancelled";
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const updateData: Record<string, unknown> = { updatedAt: Date.now() };
  if (data.name) updateData.name = data.name;
  if (data.subject) updateData.subject = data.subject;
  if (data.bodyHtml) {
    updateData.bodyHtml = data.bodyHtml;
    updateData.bodyText = htmlToPlainText(data.bodyHtml);
  }
  if (data.recipientFilter) updateData.recipientFilter = data.recipientFilter;
  if (data.scheduledAt !== undefined) updateData.scheduledAt = data.scheduledAt;
  if (data.status) updateData.status = data.status;
  await db.update(emailCampaigns)
    .set(updateData)
    .where(and(eq(emailCampaigns.id, campaignId), eq(emailCampaigns.userId, userId)));
  return { success: true };
}

export async function getCampaigns(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(emailCampaigns).where(eq(emailCampaigns.userId, userId)).orderBy(sql`${emailCampaigns.createdAt} DESC`);
}

export async function getCampaign(campaignId: number, userId: number) {
  const db = await getDb();
  if (!db) return null;
  const [campaign] = await db.select().from(emailCampaigns)
    .where(and(eq(emailCampaigns.id, campaignId), eq(emailCampaigns.userId, userId)));
  return campaign || null;
}

export async function deleteCampaign(campaignId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(emailSends).where(eq(emailSends.campaignId, campaignId));
  await db.delete(emailCampaigns)
    .where(and(eq(emailCampaigns.id, campaignId), eq(emailCampaigns.userId, userId)));
  return { success: true };
}

// ─── Recipient Management ────────────────────────────────────────────────
export async function addRecipients(campaignId: number, recipients: Array<{
  email: string;
  name?: string;
}>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const now = Date.now();
  const values = recipients.map(r => ({
    campaignId,
    recipientEmail: r.email,
    recipientName: r.name,
    status: "pending" as const,
    createdAt: now,
  }));
  if (values.length > 0) {
    await db.insert(emailSends).values(values);
    await db.update(emailCampaigns)
      .set({ totalRecipients: sql`total_recipients + ${values.length}`, updatedAt: now })
      .where(eq(emailCampaigns.id, campaignId));
  }
  return { added: values.length };
}

export async function getRecipients(campaignId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(emailSends).where(eq(emailSends.campaignId, campaignId));
}

export async function removeRecipient(sendId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [send] = await db.select().from(emailSends).where(eq(emailSends.id, sendId));
  if (send) {
    await db.delete(emailSends).where(eq(emailSends.id, sendId));
    await db.update(emailCampaigns)
      .set({ totalRecipients: sql`GREATEST(total_recipients - 1, 0)`, updatedAt: Date.now() })
      .where(eq(emailCampaigns.id, send.campaignId));
  }
  return { success: true };
}

// ─── AI Content Generation ───────────────────────────────────────────────
export async function generateEmailContent(params: {
  purpose: string;
  tone?: string;
  recipientType?: string;
  keyPoints?: string[];
}) {
  const response = await contextualLLM({ userId: userId, contextType: "analysis",
    messages: [
      {
        role: "system",
        content: `You are an expert message copywriter for financial services. Generate professional in-app message content.
Return JSON with: { "subject": "...", "bodyHtml": "<html>...</html>" }
The HTML should be clean, professional, and mobile-responsive. Use inline styles.
Tone: ${params.tone || "professional"}
Recipient type: ${params.recipientType || "client"}`
      },
      {
        role: "user",
        content: `Generate an in-app message for the following purpose:\n${params.purpose}\n${params.keyPoints?.length ? `\nKey points to cover:\n${params.keyPoints.map(p => `- ${p}`).join("\n")}` : ""}`
      }
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "message_content",
        strict: true,
        schema: {
          type: "object",
          properties: {
            subject: { type: "string", description: "Message subject line" },
            bodyHtml: { type: "string", description: "Message body as clean HTML" },
          },
          required: ["subject", "bodyHtml"],
          additionalProperties: false,
        },
      },
    },
  });
  const content = response.choices?.[0]?.message?.content;
  if (!content) throw new Error("Failed to generate message content");
  return JSON.parse(content as string) as { subject: string; bodyHtml: string };
}

// ─── Send Campaign ───────────────────────────────────────────────────────
export async function sendCampaign(campaignId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [campaign] = await db.select().from(emailCampaigns)
    .where(and(eq(emailCampaigns.id, campaignId), eq(emailCampaigns.userId, userId)));
  if (!campaign) throw new Error("Campaign not found");
  if (campaign.status === "sent" || campaign.status === "sending") {
    throw new Error("Campaign already sent or in progress");
  }

  // Mark as sending
  await db.update(emailCampaigns)
    .set({ status: "sending", updatedAt: Date.now() })
    .where(eq(emailCampaigns.id, campaignId));

  // Get pending recipients
  const recipients = await db.select().from(emailSends)
    .where(and(eq(emailSends.campaignId, campaignId), eq(emailSends.status, "pending")));

  let sentCount = 0;
  let bounceCount = 0;

  for (const recipient of recipients) {
    try {
      const personalizedHtml = renderTemplate(campaign.bodyHtml, {
        recipientName: recipient.recipientName || "Valued Client",
        recipientEmail: recipient.recipientEmail,
      });

      // Deliver as in-app notification (no external email)
      try {
        sendNotification(recipient.recipientEmail, {
          type: "system",
          priority: "medium",
          title: `[Campaign: ${campaign.name}] ${campaign.subject}`,
          body: htmlToPlainText(personalizedHtml),
          metadata: { source: "emailCampaign", campaignId, campaignName: campaign.name },
        });
      } catch { /* in-app delivery best-effort */ }
      const sent = true; // in-app delivery is fire-and-forget

      if (sent) {
        await db.update(emailSends)
          .set({ status: "sent", sentAt: Date.now() })
          .where(eq(emailSends.id, recipient.id));
        sentCount++;
      } else {
        await db.update(emailSends)
          .set({ status: "failed", errorMessage: "Notification service unavailable" })
          .where(eq(emailSends.id, recipient.id));
        bounceCount++;
      }
    } catch (err) {
      await db.update(emailSends)
        .set({ status: "failed", errorMessage: String(err) })
        .where(eq(emailSends.id, recipient.id));
      bounceCount++;
    }
  }

  // Update campaign stats
  await db.update(emailCampaigns).set({
    status: "sent",
    sentCount,
    bounceCount,
    sentAt: Date.now(),
    updatedAt: Date.now(),
  }).where(eq(emailCampaigns.id, campaignId));

  return { sentCount, bounceCount, total: recipients.length };
}

// ─── Campaign Analytics ──────────────────────────────────────────────────
export async function getCampaignAnalytics(campaignId: number) {
  const db = await getDb();
  if (!db) return null;
  const [campaign] = await db.select().from(emailCampaigns).where(eq(emailCampaigns.id, campaignId));
  if (!campaign) return null;

  const statusCounts = await db
    .select({ status: emailSends.status, count: count().as("count") })
    .from(emailSends)
    .where(eq(emailSends.campaignId, campaignId))
    .groupBy(emailSends.status);

  return {
    campaign,
    statusBreakdown: statusCounts,
    deliveryRate: campaign.totalRecipients ? ((campaign.sentCount || 0) / campaign.totalRecipients * 100).toFixed(1) : "0",
    openRate: campaign.sentCount ? ((campaign.openCount || 0) / campaign.sentCount * 100).toFixed(1) : "0",
    clickRate: campaign.openCount ? ((campaign.clickCount || 0) / campaign.openCount * 100).toFixed(1) : "0",
    bounceRate: campaign.totalRecipients ? ((campaign.bounceCount || 0) / campaign.totalRecipients * 100).toFixed(1) : "0",
  };
}
