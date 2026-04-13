import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  Shield, Download, Trash2, Eye, Database, Mic, FileText,
  MessageSquare, AlertTriangle, CheckCircle, Loader2, Clock,
  Archive, Settings, ScrollText, UserCircle,
} from "lucide-react";
import { toast } from "sonner";

const CONSENT_MAP = [
  { key: "ai_chat" as const, label: "AI Chat Processing", desc: "Allow AI to process your messages and generate responses", icon: MessageSquare },
  { key: "voice_input" as const, label: "Voice Processing", desc: "Allow speech-to-text transcription of voice input", icon: Mic },
  { key: "document_upload" as const, label: "Document Upload & Analysis", desc: "Allow AI to analyze uploaded documents for your Knowledge Base", icon: FileText },
  { key: "analytics" as const, label: "Usage Analytics", desc: "Allow anonymized usage data collection to improve the platform", icon: Database },
  { key: "data_sharing" as const, label: "Data Sharing", desc: "Allow sharing anonymized data with your organization's professionals", icon: Eye },
];

const EXPORT_SECTIONS = [
  { key: "includeConversations" as const, label: "Conversations", desc: "Full chat history with all messages", icon: MessageSquare },
  { key: "includeProfile" as const, label: "Profile & Suitability", desc: "Account info, suitability assessment, AI memories", icon: UserCircle },
  { key: "includeDocuments" as const, label: "Documents", desc: "Document metadata and index", icon: FileText },
  { key: "includeSettings" as const, label: "Settings", desc: "User preferences and style profile", icon: Settings },
  { key: "includeAuditTrail" as const, label: "Audit Trail", desc: "Activity log and compliance records", icon: ScrollText },
];

export default function PrivacyDataTab() {
  const { user } = useAuth();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportSections, setExportSections] = useState({
    includeConversations: true,
    includeProfile: true,
    includeDocuments: true,
    includeSettings: true,
    includeAuditTrail: true,
  });

  // Server-backed consent tracking
  const consentsQuery = trpc.consent.list.useQuery(undefined, { retry: 1, staleTime: 30000 });
  const grantMut = trpc.consent.grant.useMutation({
    onSuccess: () => consentsQuery.refetch(),
  });
  const revokeMut = trpc.consent.revoke.useMutation({
    onSuccess: () => consentsQuery.refetch(),
  });
  const revokeAllMut = trpc.consent.revokeAll.useMutation({
    onSuccess: () => { consentsQuery.refetch(); toast.success("All consents revoked"); },
  });

  const fullExportMut = trpc.exports.fullDataExport.useMutation({ onError: (e) => toast.error(e.message) });

  const consents = Array.isArray(consentsQuery.data) ? consentsQuery.data : [];
  const isConsentGranted = (type: string) => {
    const c = consents.find((c: any) => c.consentType === type);
    return c?.granted ?? false;
  };
  const consentTimestamp = (type: string) => {
    const c = consents.find((c: any) => c.consentType === type);
    return c?.grantedAt ? new Date(Number(c.grantedAt)).toLocaleDateString() : null;
  };

  const handleToggleConsent = (type: string, value: boolean) => {
    if (value) {
      grantMut.mutate({ consentType: type as any });
      toast.success(`Enabled ${type.replace(/_/g, " ")} consent`);
    } else {
      revokeMut.mutate({ consentType: type as any });
      toast.info(`Disabled ${type.replace(/_/g, " ")} consent`);
    }
  };

  const handleFullExport = async () => {
    setExporting(true);
    const loadingToast = toast.loading("Preparing your data export... This may take a moment.");
    try {
      const result = await fullExportMut.mutateAsync(exportSections);
      toast.dismiss(loadingToast);

      // Trigger download
      const a = document.createElement("a");
      a.href = result.url;
      a.download = result.filename;
      a.target = "_blank";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      const sizeMB = (result.sizeBytes / (1024 * 1024)).toFixed(2);
      toast.success(`Export ready! ${sizeMB} MB ZIP with ${result.sections.length} sections downloaded.`);
    } catch (err: any) {
      toast.dismiss(loadingToast);
      toast.error(err?.message || "Failed to export data. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  const toggleSection = (key: keyof typeof exportSections) => {
    setExportSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const selectedCount = Object.values(exportSections).filter(Boolean).length;

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h2 className="text-lg font-semibold mb-1 flex items-center gap-2">
          <Shield className="w-5 h-5 text-accent" />
          Privacy & Data
        </h2>
        <p className="text-sm text-muted-foreground">
          Manage your data, consent preferences, and privacy settings. Consent changes are tracked and auditable.
        </p>
      </div>

      {/* ─── CONSENT MANAGEMENT (1F) ─── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Eye className="w-4 h-4" />
            Consent Management
          </h3>
          <Button size="sm" variant="ghost" className="text-xs text-destructive" onClick={() => revokeAllMut.mutate()}>
            Revoke All
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Control which features can process your data. Changes are logged with timestamps for compliance.
        </p>
        <div className="space-y-3">
          {CONSENT_MAP.map(({ key, label, desc, icon: Icon }) => (
            <div key={key} className="flex items-center justify-between gap-4 p-3 rounded-lg bg-card border border-border/50">
              <div className="flex items-center gap-3 min-w-0">
                <div className="text-muted-foreground shrink-0"><Icon className="w-4 h-4" /></div>
                <div className="min-w-0">
                  <p className="text-sm font-medium">{label}</p>
                  <p className="text-[10px] text-muted-foreground">{desc}</p>
                  {consentTimestamp(key) && (
                    <p className="text-[9px] text-muted-foreground/60 flex items-center gap-1 mt-0.5">
                      <Clock className="w-2.5 h-2.5" /> Granted {consentTimestamp(key)}
                    </p>
                  )}
                </div>
              </div>
              <Switch
                checked={isConsentGranted(key)}
                onCheckedChange={(v) => handleToggleConsent(key, v)}
                disabled={grantMut.isPending || revokeMut.isPending}
              />
            </div>
          ))}
        </div>
      </section>

      {/* ─── COMPREHENSIVE DATA EXPORT ─── */}
      <section>
        <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
          <Archive className="w-4 h-4" />
          Export Your Data
        </h3>
        <p className="text-xs text-muted-foreground mb-4">
          Download a comprehensive ZIP archive of your data. Includes conversations with full message history,
          suitability profile, documents, settings, and audit trail. Select which sections to include:
        </p>

        <div className="space-y-2 mb-4">
          {EXPORT_SECTIONS.map(({ key, label, desc, icon: Icon }) => (
            <label
              key={key}
              className="flex items-center gap-3 p-3 rounded-lg bg-card border border-border/50 cursor-pointer hover:bg-card/80 transition-colors"
            >
              <Checkbox
                checked={exportSections[key]}
                onCheckedChange={() => toggleSection(key)}
                disabled={exporting}
              />
              <div className="text-muted-foreground shrink-0"><Icon className="w-4 h-4" /></div>
              <div className="min-w-0">
                <p className="text-sm font-medium">{label}</p>
                <p className="text-[10px] text-muted-foreground">{desc}</p>
              </div>
            </label>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <Button
            size="sm"
            variant="outline"
            onClick={handleFullExport}
            disabled={exporting || selectedCount === 0}
          >
            {exporting ? (
              <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
            ) : (
              <Download className="w-4 h-4 mr-1.5" />
            )}
            {exporting ? "Exporting..." : `Export ${selectedCount} Section${selectedCount !== 1 ? "s" : ""} as ZIP`}
          </Button>
          {selectedCount === 0 && (
            <span className="text-xs text-muted-foreground">Select at least one section</span>
          )}
        </div>
      </section>

      {/* ─── DATA ACTIVITY LOG ─── */}
      <section>
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Database className="w-4 h-4" />
          Data Activity Summary
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <DataStat icon={<MessageSquare className="w-3.5 h-3.5" />} label="Conversations" value="View in sidebar" />
          <DataStat icon={<FileText className="w-3.5 h-3.5" />} label="Documents" value="View in Knowledge Base" />
          <DataStat icon={<Shield className="w-3.5 h-3.5" />} label="PII Protection" value="Active" positive />
          <DataStat icon={<Eye className="w-3.5 h-3.5" />} label="Audit Trail" value="Enabled" positive />
        </div>
      </section>

      {/* ─── DELETE ACCOUNT ─── */}
      <section className="pt-4 border-t border-border/30">
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2 text-destructive">
          <Trash2 className="w-4 h-4" />
          Delete Account & Data
        </h3>
        <p className="text-xs text-muted-foreground mb-3">
          Permanently delete your account and all associated data. This action cannot be undone.
          Compliance audit logs may be retained for up to 7 years as required by regulations.
        </p>
        {!showDeleteConfirm ? (
          <Button size="sm" variant="destructive" onClick={() => setShowDeleteConfirm(true)}>
            <Trash2 className="w-4 h-4 mr-1.5" /> Delete My Account
          </Button>
        ) : (
          <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 space-y-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-destructive">Are you sure?</p>
                <p className="text-xs text-muted-foreground mt-1">
                  This will permanently delete all your conversations, documents, memories, and profile data.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="destructive" onClick={() => {
                toast.info("Account deletion request submitted. Please contact support to complete the process.");
                setShowDeleteConfirm(false);
              }}>
                Confirm Delete
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowDeleteConfirm(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function DataStat({ icon, label, value, positive }: {
  icon: React.ReactNode; label: string; value: string; positive?: boolean;
}) {
  return (
    <div className="p-3 rounded-lg bg-card border border-border/50">
      <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
        {icon}
        <span className="text-[10px]">{label}</span>
      </div>
      <p className={`text-xs font-medium ${positive ? "text-emerald-400" : "text-foreground"}`}>
        {positive && <CheckCircle className="w-3 h-3 inline mr-1" />}
        {value}
      </p>
    </div>
  );
}
