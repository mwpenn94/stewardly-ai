/**
 * EmailTemplateBuilder — WYSIWYG email template builder with live HTML preview.
 * Adapted from stewardly-command-center for the WealthBridge platform.
 * Provides structured email composition with subject, preheader, heading, body, CTA, and footer.
 */
import { useState } from "react";
import { Eye, Code, Send, Copy, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export interface EmailTemplate {
  subject: string;
  preheader: string;
  heading: string;
  body: string;
  ctaText: string;
  ctaUrl: string;
  footerText: string;
}

const defaultTemplate: EmailTemplate = {
  subject: "",
  preheader: "",
  heading: "Welcome to Stewardly",
  body: "We are excited to share our latest financial planning insights and opportunities with you. Our team of advisors is here to help you build and protect your wealth.",
  ctaText: "Schedule a Review",
  ctaUrl: "#",
  footerText: "Stewardly Financial | Wealth Management & Advisory Services",
};

interface EmailTemplateBuilderProps {
  onSend?: (template: EmailTemplate) => void;
  initial?: Partial<EmailTemplate>;
}

export default function EmailTemplateBuilder({ onSend, initial }: EmailTemplateBuilderProps) {
  const [template, setTemplate] = useState<EmailTemplate>({ ...defaultTemplate, ...initial });
  const [view, setView] = useState<"edit" | "preview" | "html">("edit");

  const update = <K extends keyof EmailTemplate>(key: K, value: string) =>
    setTemplate((prev) => ({ ...prev, [key]: value }));

  const previewHtml = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:system-ui,-apple-system,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:20px;">
    ${template.preheader ? `<div style="display:none;font-size:1px;color:#f8fafc;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${template.preheader}</div>` : ""}
    <div style="background:linear-gradient(135deg,#c8a052,#a07830);color:white;padding:32px 24px;text-align:center;border-radius:12px 12px 0 0;">
      <h1 style="margin:0;font-size:24px;font-weight:700;letter-spacing:-0.02em;">${template.heading || "Email Heading"}</h1>
    </div>
    <div style="padding:32px 24px;background:white;border:1px solid #e2e8f0;border-top:0;">
      <p style="font-size:16px;line-height:1.7;color:#334155;margin:0 0 24px;">${template.body || "Email body text..."}</p>
      ${template.ctaText ? `
      <div style="text-align:center;margin:24px 0;">
        <a href="${template.ctaUrl || "#"}" style="display:inline-block;background:linear-gradient(135deg,#c8a052,#a07830);color:white;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">${template.ctaText}</a>
      </div>` : ""}
    </div>
    <div style="padding:20px 24px;background:#1a1a2e;text-align:center;font-size:12px;color:#94a3b8;border-radius:0 0 12px 12px;">
      ${template.footerText || ""}
    </div>
  </div>
</body>
</html>`;

  const handleCopyHtml = () => {
    navigator.clipboard.writeText(previewHtml);
    toast.success("HTML copied to clipboard");
  };

  const handleSend = () => {
    if (!template.subject) {
      toast.error("Please add a subject line");
      return;
    }
    onSend?.(template);
  };

  return (
    <div className="space-y-4">
      {/* View Toggle */}
      <div className="flex items-center gap-2 border-b border-border pb-3">
        <Button
          variant={view === "edit" ? "default" : "outline"}
          size="sm"
          onClick={() => setView("edit")}
          className="gap-1.5"
        >
          <Pencil className="w-3.5 h-3.5" /> Edit
        </Button>
        <Button
          variant={view === "preview" ? "default" : "outline"}
          size="sm"
          onClick={() => setView("preview")}
          className="gap-1.5"
        >
          <Eye className="w-3.5 h-3.5" /> Preview
        </Button>
        <Button
          variant={view === "html" ? "default" : "outline"}
          size="sm"
          onClick={() => setView("html")}
          className="gap-1.5"
        >
          <Code className="w-3.5 h-3.5" /> HTML
        </Button>
        <div className="flex-1" />
        <Button variant="outline" size="sm" onClick={handleCopyHtml} className="gap-1.5">
          <Copy className="w-3.5 h-3.5" /> Copy HTML
        </Button>
        {onSend && (
          <Button size="sm" onClick={handleSend} className="gap-1.5">
            <Send className="w-3.5 h-3.5" /> Send
          </Button>
        )}
      </div>

      {/* Edit View */}
      {view === "edit" && (
        <div className="grid gap-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="etb-subject">Subject Line</Label>
              <Input id="etb-subject" value={template.subject} onChange={(e) => update("subject", e.target.value)} placeholder="Your email subject..." />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="etb-preheader">Preheader Text</Label>
              <Input id="etb-preheader" value={template.preheader} onChange={(e) => update("preheader", e.target.value)} placeholder="Preview text shown in inbox..." />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="etb-heading">Email Heading</Label>
            <Input id="etb-heading" value={template.heading} onChange={(e) => update("heading", e.target.value)} placeholder="Main heading..." />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="etb-body">Body Content</Label>
            <Textarea id="etb-body" value={template.body} onChange={(e) => update("body", e.target.value)} placeholder="Email body text..." rows={6} />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="etb-cta-text">CTA Button Text</Label>
              <Input id="etb-cta-text" value={template.ctaText} onChange={(e) => update("ctaText", e.target.value)} placeholder="Call to action..." />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="etb-cta-url">CTA Button URL</Label>
              <Input id="etb-cta-url" value={template.ctaUrl} onChange={(e) => update("ctaUrl", e.target.value)} placeholder="https://..." />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="etb-footer">Footer Text</Label>
            <Input id="etb-footer" value={template.footerText} onChange={(e) => update("footerText", e.target.value)} placeholder="Company info, unsubscribe link..." />
          </div>
        </div>
      )}

      {/* Preview View */}
      {view === "preview" && (
        <div className="border border-border rounded-lg overflow-hidden bg-white">
          <iframe
            srcDoc={previewHtml}
            title="Email Preview"
            className="w-full min-h-[500px] border-0"
            sandbox="allow-same-origin"
          />
        </div>
      )}

      {/* HTML View */}
      {view === "html" && (
        <div className="relative">
          <pre className="bg-muted/50 border border-border rounded-lg p-4 text-xs overflow-auto max-h-[500px] text-foreground/80">
            <code>{previewHtml}</code>
          </pre>
        </div>
      )}
    </div>
  );
}
