/**
 * Exports Router
 * 
 * Provides endpoints for exporting data in multiple formats (CSV, Excel, PDF, DOCX, JSON).
 */
import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { exportData, type ExportColumn } from "../services/exportService";
import { addAuditEntry } from "../db";

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

  // Export conversations
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
});
