/**
 * Exports Router
 * 
 * Provides endpoints for exporting data in multiple formats (CSV, Excel, PDF, DOCX, JSON).
 * Includes a comprehensive full-data export that bundles all user data into a ZIP archive.
 */
import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { exportData, type ExportColumn } from "../services/exportService";
import { addAuditEntry } from "../db";
import archiver from "archiver";
import { storagePut } from "../storage";
import { nanoid } from "nanoid";

const columnSchema = z.object({
  key: z.string(),
  label: z.string(),
  width: z.number().optional(),
  format: z.enum(["text", "number", "currency", "date", "percent"]).optional(),
});

export const exportsRouter = router({
  // Generic export endpoint
  exportData: protectedProcedure
    .input(z.object({
      title: z.string(),
      subtitle: z.string().optional(),
      columns: z.array(columnSchema),
      rows: z.array(z.record(z.string(), z.unknown())),
      format: z.enum(["csv", "excel", "pdf", "docx", "json"]),
    }))
    .mutation(async ({ input, ctx }) => {
      const result = await exportData({
        ...input,
        columns: input.columns as ExportColumn[],
        userId: ctx.user.id,
      });

      await addAuditEntry({
        userId: ctx.user.id,
        action: "export_generated",
        details: JSON.stringify({ format: input.format, title: input.title, rowCount: input.rows.length }),
      });

      return result;
    }),

  // Quick CSV export
  exportCSV: protectedProcedure
    .input(z.object({
      title: z.string(),
      columns: z.array(columnSchema),
      rows: z.array(z.record(z.string(), z.unknown())),
    }))
    .mutation(async ({ input, ctx }) => {
      return exportData({
        title: input.title,
        columns: input.columns as ExportColumn[],
        rows: input.rows,
        format: "csv",
        userId: ctx.user.id,
      });
    }),

  // Quick PDF export
  exportPDF: protectedProcedure
    .input(z.object({
      title: z.string(),
      subtitle: z.string().optional(),
      columns: z.array(columnSchema),
      rows: z.array(z.record(z.string(), z.unknown())),
    }))
    .mutation(async ({ input, ctx }) => {
      return exportData({
        title: input.title,
        subtitle: input.subtitle,
        columns: input.columns as ExportColumn[],
        rows: input.rows,
        format: "pdf",
        userId: ctx.user.id,
      });
    }),

  // Quick JSON export
  exportJSON: protectedProcedure
    .input(z.object({
      title: z.string(),
      columns: z.array(columnSchema),
      rows: z.array(z.record(z.string(), z.unknown())),
    }))
    .mutation(async ({ input, ctx }) => {
      return exportData({
        title: input.title,
        columns: input.columns as ExportColumn[],
        rows: input.rows,
        format: "json",
        userId: ctx.user.id,
      });
    }),

  // Export audit trail
  exportAuditTrail: protectedProcedure
    .input(z.object({
      format: z.enum(["csv", "pdf", "json"]),
      since: z.number().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { getAuditTrail } = await import("../db");
      const sinceDate = input.since ? new Date(input.since) : undefined;
      const entries = await getAuditTrail(ctx.user.id, 1000, sinceDate ? { since: sinceDate } : undefined);

      const columns: ExportColumn[] = [
        { key: "id", label: "ID", format: "number" },
        { key: "action", label: "Action", format: "text" },
        { key: "details", label: "Details", format: "text" },
        { key: "createdAt", label: "Timestamp", format: "date" },
      ];

      const rows = entries.map((e: Record<string, unknown>) => ({
        id: e.id,
        action: e.action,
        details: typeof e.details === "object" ? JSON.stringify(e.details) : String(e.details || ""),
        createdAt: e.createdAt,
      }));

      return exportData({
        title: "Audit Trail Export",
        subtitle: `Generated ${new Date().toISOString()}`,
        columns,
        rows,
        format: input.format,
        userId: ctx.user.id,
      });
    }),

  // Export conversations (metadata only)
  exportConversations: protectedProcedure
    .input(z.object({
      format: z.enum(["csv", "json"]),
    }))
    .mutation(async ({ input, ctx }) => {
      const { getUserConversations } = await import("../db");
      const conversations = await getUserConversations(ctx.user.id);

      const columns: ExportColumn[] = [
        { key: "id", label: "ID", format: "number" },
        { key: "title", label: "Title", format: "text" },
        { key: "mode", label: "Mode", format: "text" },
        { key: "messageCount", label: "Messages", format: "number" },
        { key: "createdAt", label: "Created", format: "date" },
      ];

      const rows = conversations.map((c: Record<string, unknown>) => ({
        id: c.id,
        title: c.title || "Untitled",
        mode: c.mode || "general",
        messageCount: c.messageCount || 0,
        createdAt: c.createdAt,
      }));

      return exportData({
        title: "Conversations Export",
        columns,
        rows,
        format: input.format,
        userId: ctx.user.id,
      });
    }),

  // ─── COMPREHENSIVE FULL DATA EXPORT (ZIP) ─────────────────────────
  // Bundles all user data: conversations with messages, suitability profile,
  // documents metadata, settings, and audit trail into a single ZIP archive.
  fullDataExport: protectedProcedure
    .input(z.object({
      includeConversations: z.boolean().default(true),
      includeProfile: z.boolean().default(true),
      includeDocuments: z.boolean().default(true),
      includeSettings: z.boolean().default(true),
      includeAuditTrail: z.boolean().default(true),
    }))
    .mutation(async ({ input, ctx }) => {
      const {
        getUserConversations, exportConversation, getUserDocuments,
        getUserSuitability, getAuditTrail, getUserMemories,
      } = await import("../db");

      const userId = ctx.user.id;
      const exportDate = new Date().toISOString().split("T")[0];
      const chunks: Buffer[] = [];

      // Build ZIP in memory
      const archive = archiver("zip", { zlib: { level: 6 } });
      archive.on("data", (chunk: Buffer) => chunks.push(chunk));
      const finalize = new Promise<void>((resolve, reject) => {
        archive.on("end", resolve);
        archive.on("error", reject);
      });

      // Add manifest
      const manifest: Record<string, unknown> = {
        exportedAt: new Date().toISOString(),
        userId,
        userName: ctx.user.name,
        platform: "Stewardly — AI-Powered Financial Stewardship",
        version: "1.0",
        sections: [],
      };

      // 1. Conversations with full message history
      if (input.includeConversations) {
        const conversations = await getUserConversations(userId);
        const convsWithMessages = [];

        for (const conv of conversations) {
          try {
            const full = await exportConversation(conv.id, userId);
            if (full) {
              convsWithMessages.push({
                id: conv.id,
                title: conv.title || "Untitled",
                mode: (conv as any).mode || "general",
                createdAt: conv.createdAt,
                updatedAt: conv.updatedAt,
                messageCount: (conv as any).messageCount || 0,
                messages: full.messages.map((m: any) => ({
                  role: m.role,
                  content: m.content,
                  createdAt: m.createdAt,
                  confidenceScore: m.confidenceScore,
                  complianceStatus: m.complianceStatus,
                })),
              });

              // Also create individual markdown file for each conversation
              const title = conv.title || "Untitled";
              const safeTitle = title.replace(/[^a-zA-Z0-9 _-]/g, "").substring(0, 50).trim();
              let md = `# ${title}\n\n_Exported ${exportDate}_\n\n---\n\n`;
              for (const m of full.messages) {
                const role = m.role === "user" ? "You" : m.role === "assistant" ? "Steward" : "System";
                const ts = m.createdAt ? new Date(m.createdAt).toLocaleString() : "";
                md += `### ${role}${ts ? ` — ${ts}` : ""}\n\n${m.content}\n\n---\n\n`;
              }
              archive.append(md, { name: `conversations/${safeTitle}-${conv.id}.md` });
            }
          } catch {
            // Skip conversations that fail to export
          }
        }

        archive.append(JSON.stringify(convsWithMessages, null, 2), {
          name: "conversations/all-conversations.json",
        });
        (manifest.sections as string[]).push("conversations");
      }

      // 2. Suitability profile
      if (input.includeProfile) {
        const suitability = await getUserSuitability(userId);
        const profile: Record<string, unknown> = {
          user: {
            id: userId,
            name: ctx.user.name,
            email: ctx.user.email,
            role: ctx.user.role,
          },
          suitability: suitability || null,
        };

        // Include memories
        try {
          const memories = await getUserMemories(userId);
          profile.memories = memories;
        } catch {
          profile.memories = [];
        }

        archive.append(JSON.stringify(profile, null, 2), {
          name: "profile/suitability-profile.json",
        });

        // Human-readable profile summary
        let profileMd = `# Your Stewardly Profile\n\n_Exported ${exportDate}_\n\n`;
        profileMd += `## Account\n\n- **Name:** ${ctx.user.name}\n- **Email:** ${ctx.user.email}\n- **Role:** ${ctx.user.role}\n\n`;
        if (suitability) {
          profileMd += `## Suitability Assessment\n\n`;
          profileMd += `- **Risk Tolerance:** ${(suitability as any).riskTolerance || "Not set"}\n`;
          profileMd += `- **Investment Horizon:** ${(suitability as any).investmentHorizon || "Not set"}\n`;
          profileMd += `- **Annual Income:** ${(suitability as any).annualIncome || "Not set"}\n`;
          profileMd += `- **Net Worth:** ${(suitability as any).netWorth || "Not set"}\n`;
          profileMd += `- **Completed:** ${(suitability as any).completedAt ? new Date((suitability as any).completedAt).toLocaleDateString() : "Not completed"}\n\n`;
          if ((suitability as any).financialGoals) {
            try {
              const goals = typeof (suitability as any).financialGoals === "string"
                ? JSON.parse((suitability as any).financialGoals)
                : (suitability as any).financialGoals;
              if (Array.isArray(goals) && goals.length > 0) {
                profileMd += `### Financial Goals\n\n`;
                goals.forEach((g: string, i: number) => { profileMd += `${i + 1}. ${g}\n`; });
                profileMd += "\n";
              }
            } catch { /* ignore parse errors */ }
          }
        } else {
          profileMd += `## Suitability Assessment\n\n_Not yet completed._\n\n`;
        }
        archive.append(profileMd, { name: "profile/profile-summary.md" });
        (manifest.sections as string[]).push("profile");
      }

      // 3. Documents metadata
      if (input.includeDocuments) {
        const docs = await getUserDocuments(userId);
        const docsSummary = docs.map((d: any) => ({
          id: d.id,
          filename: d.filename,
          category: d.category,
          visibility: d.visibility,
          status: d.status,
          fileUrl: d.fileUrl,
          mimeType: d.mimeType,
          createdAt: d.createdAt,
        }));
        archive.append(JSON.stringify(docsSummary, null, 2), {
          name: "documents/documents-metadata.json",
        });

        let docsMd = `# Your Documents\n\n_Exported ${exportDate}_\n\n`;
        docsMd += `| # | Filename | Category | Status | Created |\n|---|----------|----------|--------|--------|\n`;
        docsSummary.forEach((d: any, i: number) => {
          docsMd += `| ${i + 1} | ${d.filename} | ${d.category || "—"} | ${d.status} | ${d.createdAt ? new Date(d.createdAt).toLocaleDateString() : "—"} |\n`;
        });
        docsMd += `\n_Note: Document files are stored externally. URLs are included in the JSON export._\n`;
        archive.append(docsMd, { name: "documents/documents-index.md" });
        (manifest.sections as string[]).push("documents");
      }

      // 4. Settings
      if (input.includeSettings) {
        const settings = {
          userSettings: ctx.user.settings,
          styleProfile: ctx.user.styleProfile,
          suitabilityCompleted: ctx.user.suitabilityCompleted,
        };
        archive.append(JSON.stringify(settings, null, 2), {
          name: "settings/user-settings.json",
        });
        (manifest.sections as string[]).push("settings");
      }

      // 5. Audit trail
      if (input.includeAuditTrail) {
        try {
          const entries = await getAuditTrail(userId, 5000);
          const auditData = entries.map((e: any) => ({
            id: e.id,
            action: e.action,
            details: typeof e.details === "object" ? e.details : String(e.details || ""),
            createdAt: e.createdAt,
          }));
          archive.append(JSON.stringify(auditData, null, 2), {
            name: "audit/audit-trail.json",
          });
          (manifest.sections as string[]).push("audit");
        } catch {
          // Audit trail may not be available
        }
      }

      // Add manifest and README
      archive.append(JSON.stringify(manifest, null, 2), { name: "manifest.json" });

      const readme = `# Stewardly Data Export\n\n` +
        `Exported on: ${new Date().toLocaleString()}\n` +
        `User: ${ctx.user.name} (${ctx.user.email})\n\n` +
        `## Contents\n\n` +
        `- **conversations/** — Full conversation history with messages (JSON + Markdown)\n` +
        `- **profile/** — Suitability assessment, account info, and AI memories\n` +
        `- **documents/** — Document metadata and index\n` +
        `- **settings/** — User preferences and style profile\n` +
        `- **audit/** — Activity audit trail\n` +
        `- **manifest.json** — Export metadata\n\n` +
        `## Privacy Notice\n\n` +
        `This export contains your personal data from Stewardly. Handle it securely and ` +
        `do not share it with unauthorized parties. You may request deletion of your data ` +
        `at any time through the platform settings.\n`;
      archive.append(readme, { name: "README.md" });

      archive.finalize();
      await finalize;

      // Combine chunks and upload to S3
      const zipBuffer = Buffer.concat(chunks);
      const fileKey = `exports/${userId}-data-export-${exportDate}-${nanoid(8)}.zip`;
      const { url } = await storagePut(fileKey, zipBuffer, "application/zip");

      // Log the export
      await addAuditEntry({
        userId,
        action: "full_data_export",
        details: JSON.stringify({
          sections: manifest.sections,
          sizeBytes: zipBuffer.length,
          exportDate,
        }),
      });

      return {
        url,
        filename: `stewardly-data-export-${exportDate}.zip`,
        sizeBytes: zipBuffer.length,
        sections: manifest.sections as string[],
      };
    }),
});
