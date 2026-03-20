import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  Shield, Download, Trash2, Eye, Database, Mic, FileText,
  MessageSquare, AlertTriangle, CheckCircle, Loader2,
} from "lucide-react";
import { toast } from "sonner";

/**
 * Privacy & Data tab in Settings — data rights, consent management, data export/deletion.
 */
export default function PrivacyDataTab() {
  const { user } = useAuth();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Consent states from localStorage (per-source tracking - 1F)
  const [consents, setConsents] = useState(() => ({
    aiChat: localStorage.getItem("consent_ai_chat") === "true",
    voice: localStorage.getItem("consent_voice") === "true",
    docUpload: localStorage.getItem("consent_doc_upload") === "true",
    analytics: localStorage.getItem("consent_analytics") !== "false", // default true
  }));

  const updateConsent = (key: keyof typeof consents, value: boolean) => {
    setConsents(prev => ({ ...prev, [key]: value }));
    localStorage.setItem(`consent_${key === "aiChat" ? "ai_chat" : key === "docUpload" ? "doc_upload" : key}`, String(value));
    toast.success(`${value ? "Enabled" : "Disabled"} ${key === "aiChat" ? "AI chat" : key === "voice" ? "voice" : key === "docUpload" ? "document upload" : "analytics"} consent`);
  };

  const utils = trpc.useUtils();

  // Export all user data
  const handleExportData = async () => {
    setExporting(true);
    try {
      // Fetch conversations list
      const conversations = await utils.conversations.list.fetch();
      const exportData = {
        exportedAt: new Date().toISOString(),
        user: {
          name: user?.name,
          email: user?.email,
          role: user?.role,
          createdAt: user?.createdAt,
        },
        conversations: conversations?.map((c: any) => ({
          id: c.id,
          title: c.title,
          createdAt: c.createdAt,
          pinned: c.pinned,
        })) || [],
        consentSettings: consents,
        note: "For full conversation exports, use the Export option in each conversation's context menu.",
      };
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `stewardry-data-export-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Data exported successfully");
    } catch {
      toast.error("Failed to export data");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h2 className="text-lg font-semibold mb-1 flex items-center gap-2">
          <Shield className="w-5 h-5 text-accent" />
          Privacy & Data
        </h2>
        <p className="text-sm text-muted-foreground">
          Manage your data, consent preferences, and privacy settings.
        </p>
      </div>

      {/* ─── CONSENT MANAGEMENT (1F) ─── */}
      <section>
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Eye className="w-4 h-4" />
          Consent Management
        </h3>
        <p className="text-xs text-muted-foreground mb-4">
          Control which features can process your data. Disabling a consent will prevent that feature from working.
        </p>
        <div className="space-y-3">
          <ConsentRow
            icon={<MessageSquare className="w-4 h-4" />}
            label="AI Chat Processing"
            description="Allow AI to process your messages and generate responses"
            checked={consents.aiChat}
            onChange={(v) => updateConsent("aiChat", v)}
          />
          <ConsentRow
            icon={<Mic className="w-4 h-4" />}
            label="Voice Processing"
            description="Allow speech-to-text transcription of voice input"
            checked={consents.voice}
            onChange={(v) => updateConsent("voice", v)}
          />
          <ConsentRow
            icon={<FileText className="w-4 h-4" />}
            label="Document Upload & Analysis"
            description="Allow AI to analyze uploaded documents for your Knowledge Base"
            checked={consents.docUpload}
            onChange={(v) => updateConsent("docUpload", v)}
          />
          <ConsentRow
            icon={<Database className="w-4 h-4" />}
            label="Usage Analytics"
            description="Allow anonymized usage data collection to improve the platform"
            checked={consents.analytics}
            onChange={(v) => updateConsent("analytics", v)}
          />
        </div>
      </section>

      {/* ─── DATA EXPORT ─── */}
      <section>
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Download className="w-4 h-4" />
          Export Your Data
        </h3>
        <p className="text-xs text-muted-foreground mb-3">
          Download a copy of your account data, including profile information and conversation metadata.
          Individual conversations can be exported from their context menu in the chat sidebar.
        </p>
        <Button size="sm" variant="outline" onClick={handleExportData} disabled={exporting}>
          {exporting ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Download className="w-4 h-4 mr-1.5" />}
          Export Account Data
        </Button>
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
                  Please export your data first if you want to keep a copy.
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

function ConsentRow({ icon, label, description, checked, onChange }: {
  icon: React.ReactNode; label: string; description: string;
  checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 p-3 rounded-lg bg-card border border-border/50">
      <div className="flex items-center gap-3 min-w-0">
        <div className="text-muted-foreground shrink-0">{icon}</div>
        <div className="min-w-0">
          <p className="text-sm font-medium">{label}</p>
          <p className="text-[10px] text-muted-foreground">{description}</p>
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
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
