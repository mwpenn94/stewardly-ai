/**
 * MarketingAssets — Content library for email templates and marketing materials.
 * Phase 5 Command Center — provides marketing asset management.
 *
 * Wired to:
 *   - trpc.comms.templates (list all templates by category)
 *   - trpc.comms.template (get single template)
 *   - trpc.comms.generate (generate draft from template + variables)
 */
import { useState, useMemo } from "react";
import { SEOHead } from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Search, FileText, Mail, Copy, Eye, Loader2, Sparkles, FolderOpen, CheckCircle2 } from "lucide-react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import AppShell from "@/components/AppShell";
import { QueryErrorBanner } from "@/components/QueryErrorBanner";

const CATEGORIES = [
  { value: "all", label: "All Categories" },
  { value: "review_reminder", label: "Review Reminders" },
  { value: "market_update", label: "Market Updates" },
  { value: "birthday", label: "Birthday" },
  { value: "life_event", label: "Life Events" },
  { value: "onboarding", label: "Onboarding" },
  { value: "compliance", label: "Compliance" },
  { value: "general", label: "General" },
  { value: "referral_thank_you", label: "Referral Thank You" },
  { value: "annual_summary", label: "Annual Summary" },
] as const;

const CATEGORY_ICONS: Record<string, string> = {
  review_reminder: "📋",
  market_update: "📈",
  birthday: "🎂",
  life_event: "🎉",
  onboarding: "👋",
  compliance: "🔒",
  general: "📝",
  referral_thank_you: "🤝",
  annual_summary: "📊",
};

export default function MarketingAssets({ embedded = false }: { embedded?: boolean } = {}) {
  const Shell = embedded ? (({ children }: any) => <>{children}</>) as any : AppShell;

  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [generateTemplateId, setGenerateTemplateId] = useState<string | null>(null);
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [generatedDraft, setGeneratedDraft] = useState<string | null>(null);

  const templatesQ = trpc.comms.templates.useQuery(
    category === "all" ? {} : { category: category as any },
    { retry: false },
  );

  const previewQ = trpc.comms.template.useQuery(
    { id: previewId! },
    { enabled: !!previewId },
  );

  const generateMut = trpc.comms.generate.useMutation({
    onSuccess: (data) => {
      setGeneratedDraft(typeof data === "string" ? data : JSON.stringify(data, null, 2));
      toast.success("Draft generated");
    },
    onError: (e) => toast.error(e.message),
  });

  const templates = templatesQ.data ?? [];

  const filtered = useMemo(() => {
    if (!search) return templates;
    const q = search.toLowerCase();
    return templates.filter((t: any) =>
      (t.name || "").toLowerCase().includes(q) ||
      (t.subject || "").toLowerCase().includes(q) ||
      (t.category || "").toLowerCase().includes(q)
    );
  }, [templates, search]);

  const handleGenerate = () => {
    if (!generateTemplateId) return;
    generateMut.mutate({
      templateId: generateTemplateId,
      variables,
    });
  };

  const handleCopyDraft = () => {
    if (generatedDraft) {
      navigator.clipboard.writeText(generatedDraft).then(() => toast.success("Copied to clipboard")).catch(() => toast.error("Copy failed"));
    }
  };

  return (
    <Shell title="Marketing Assets">
    <div className="relative container py-8 space-y-6">
      <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(ellipse at 70% 30%, oklch(0.65 0.15 280 / 0.12) 0%, transparent 60%)' }} />
      <SEOHead title="Marketing Assets" description="Content library for email templates and marketing materials" />

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/chat")}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <FolderOpen className="h-6 w-6 text-primary" /> Content Library
            </h1>
            <p className="text-sm text-muted-foreground">
              {templatesQ.isLoading ? "Loading..." : `${filtered.length} templates available`}
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-0 sm:min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search templates..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9" />
        </div>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-full sm:w-48 h-9">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIES.map((cat) => (
              <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <QueryErrorBanner query={templatesQ} label="templates" />

      {templatesQ.isLoading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
          <Loader2 className="w-5 h-5 animate-spin" /> Loading templates...
        </div>
      ) : filtered.length === 0 ? (
        <div className="border rounded-lg py-16 text-center text-sm text-muted-foreground space-y-2">
          <FileText className="h-8 w-8 mx-auto opacity-50" />
          <p>No templates found{search ? ` matching "${search}"` : ""}.</p>
          <p className="text-xs">Templates are organized by category — try selecting a different filter above.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((template: any) => (
            <Card key={template.id} className="hover:border-primary/30 transition-colors group">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{CATEGORY_ICONS[template.category] ?? "📄"}</span>
                    <CardTitle className="text-sm font-medium line-clamp-1">{template.name || template.id}</CardTitle>
                  </div>
                  <Badge variant="outline" className="text-[10px] shrink-0">
                    {(template.category || "general").replace(/_/g, " ")}
                  </Badge>
                </div>
                {template.subject && (
                  <CardDescription className="text-xs line-clamp-2 mt-1">{template.subject}</CardDescription>
                )}
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setPreviewId(template.id)}
                  >
                    <Eye className="h-3 w-3 mr-1" /> Preview
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => {
                      setGenerateTemplateId(template.id);
                      setVariables({});
                      setGeneratedDraft(null);
                      setGenerateOpen(true);
                    }}
                  >
                    <Sparkles className="h-3 w-3 mr-1" /> Generate
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Preview Dialog */}
      <Dialog open={!!previewId} onOpenChange={(open) => !open && setPreviewId(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-4 w-4" /> Template Preview
            </DialogTitle>
            <DialogDescription>
              {previewQ.data?.name || previewId}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            {previewQ.isLoading ? (
              <div className="flex items-center gap-2 py-8 justify-center text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading...
              </div>
            ) : previewQ.data ? (
              <>
                {previewQ.data.subject && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Subject</Label>
                    <p className="font-medium">{previewQ.data.subject}</p>
                  </div>
                )}
                {previewQ.data.body && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Body</Label>
                    <div className="mt-1 p-3 bg-muted/30 rounded-md text-xs whitespace-pre-wrap max-h-60 overflow-y-auto">
                      {previewQ.data.body}
                    </div>
                  </div>
                )}
                {previewQ.data.variables && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Variables</Label>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {(Array.isArray(previewQ.data.variables) ? previewQ.data.variables : Object.keys(previewQ.data.variables)).map((v: string) => (
                        <Badge key={v} variant="secondary" className="text-[10px]">{`{{${v}}}`}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p className="text-muted-foreground text-center py-4">Template not found</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Generate Dialog */}
      <Dialog open={generateOpen} onOpenChange={setGenerateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" /> Generate Draft
            </DialogTitle>
            <DialogDescription>
              Fill in variables to generate a personalized draft
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid gap-3">
              {["clientName", "advisorName", "firmName", "date"].map((key) => (
                <div key={key}>
                  <Label className="text-xs">{key.replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase())}</Label>
                  <Input
                    value={variables[key] || ""}
                    onChange={(e) => setVariables(prev => ({ ...prev, [key]: e.target.value }))}
                    placeholder={`Enter ${key}`}
                    className="h-8 text-sm"
                  />
                </div>
              ))}
            </div>
            {generatedDraft && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Generated Draft</Label>
                <Textarea
                  value={generatedDraft}
                  readOnly
                  className="min-h-[120px] text-xs"
                />
                <Button size="sm" variant="outline" onClick={handleCopyDraft}>
                  <Copy className="h-3 w-3 mr-1" /> Copy
                </Button>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={handleGenerate} disabled={generateMut.isPending}>
              {generateMut.isPending ? (
                <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> Generating...</>
              ) : (
                <><CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Generate</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </Shell>
  );
}
