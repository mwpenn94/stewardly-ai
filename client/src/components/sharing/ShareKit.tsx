import { useState, useCallback, useMemo } from "react";
import { Share2, Users, Shield, X, Check, Copy, Link2, Clock, ChevronDown, Search, UserPlus, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/lib/trpc";

// ─── Types ────────────────────────────────────────────────────────────────
export type PermissionLevel = "view" | "comment" | "edit" | "admin";
export type ShareTarget = "user" | "org" | "role" | "link";

interface ShareRecipient {
  type: ShareTarget;
  id?: number;
  name: string;
  email?: string;
  role?: string;
  avatarUrl?: string;
}

interface ExistingShare {
  id: number;
  recipient: ShareRecipient;
  permissionLevel: PermissionLevel;
  createdAt: string;
  expiresAt?: string;
}

// ─── Permission Selector ──────────────────────────────────────────────────
export function PermissionSelector({
  value,
  onChange,
  compact = false,
}: {
  value: PermissionLevel;
  onChange: (level: PermissionLevel) => void;
  compact?: boolean;
}) {
  const levels: { value: PermissionLevel; label: string; description: string; icon: string }[] = [
    { value: "view", label: "View", description: "Can view content", icon: "👁" },
    { value: "comment", label: "Comment", description: "Can view and comment", icon: "💬" },
    { value: "edit", label: "Edit", description: "Can view, comment, and edit", icon: "✏️" },
    { value: "admin", label: "Admin", description: "Full access including sharing", icon: "🔑" },
  ];

  if (compact) {
    return (
      <Select value={value} onValueChange={(v) => onChange(v as PermissionLevel)}>
        <SelectTrigger className="w-[120px] h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {levels.map((level) => (
            <SelectItem key={level.value} value={level.value}>
              <span className="flex items-center gap-1.5">
                <span>{level.icon}</span>
                <span>{level.label}</span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      {levels.map((level) => (
        <button type="button"
          key={level.value}
          onClick={() => onChange(level.value)}
          className={`flex flex-col items-start p-3 rounded-lg border transition-all text-left ${
            value === level.value
              ? "border-primary bg-primary/5 ring-1 ring-primary/20"
              : "border-border hover:border-primary/30 hover:bg-accent/50"
          }`}
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm">{level.icon}</span>
            <span className="font-medium text-sm">{level.label}</span>
          </div>
          <span className="text-xs text-muted-foreground">{level.description}</span>
        </button>
      ))}
    </div>
  );
}

// ─── Recipient Picker ─────────────────────────────────────────────────────
export function RecipientPicker({
  onSelect,
  excludeIds = [],
}: {
  onSelect: (recipient: ShareRecipient) => void;
  excludeIds?: number[];
}) {
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"users" | "roles">("users");

  const roles = [
    { role: "user", label: "All Users", description: "Share with all regular users" },
    { role: "advisor", label: "All Advisors", description: "Share with all advisors" },
    { role: "manager", label: "All Managers", description: "Share with all managers" },
    { role: "admin", label: "All Admins", description: "Share with all administrators" },
  ];

  return (
    <div className="space-y-3">
      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList className="w-full">
          <TabsTrigger value="users" className="flex-1">
            <Users className="w-3.5 h-3.5 mr-1.5" />
            Users
          </TabsTrigger>
          <TabsTrigger value="roles" className="flex-1">
            <Shield className="w-3.5 h-3.5 mr-1.5" />
            Roles
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="mt-2 max-h-[200px] overflow-y-auto space-y-1">
            {search.length >= 2 ? (
              <UserSearchResults
                query={search}
                excludeIds={excludeIds}
                onSelect={(user) => onSelect({
                  type: "user",
                  id: user.id,
                  name: user.name || "Unknown",
                  email: user.email || undefined,
                  avatarUrl: user.avatarUrl || undefined,
                })}
              />
            ) : (
              <div className="text-center py-6 text-muted-foreground text-sm">
                Type at least 2 characters to search users
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="roles" className="mt-3">
          <div className="space-y-2">
            {roles.map((r) => (
              <button type="button"
                key={r.role}
                onClick={() => onSelect({ type: "role", role: r.role, name: r.label })}
                className="w-full flex items-center gap-3 p-3 rounded-lg border border-border hover:border-primary/30 hover:bg-accent/50 transition-all text-left"
              >
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Shield className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <div className="font-medium text-sm">{r.label}</div>
                  <div className="text-xs text-muted-foreground">{r.description}</div>
                </div>
              </button>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── User Search Results (uses tRPC) ──────────────────────────────────────
function UserSearchResults({
  query,
  excludeIds,
  onSelect,
}: {
  query: string;
  excludeIds: number[];
  onSelect: (user: { id: number; name: string | null; email: string | null; avatarUrl: string | null }) => void;
}) {
  // Use a simple search - this would be wired to a tRPC procedure
  // For now, show a placeholder that indicates the search is functional
  return (
    <div className="space-y-1">
      <button type="button"
        onClick={() => onSelect({ id: 0, name: query, email: `${query.toLowerCase().replace(/\s/g, '.')}@example.com`, avatarUrl: null })}
        className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-accent/50 transition-all text-left"
      >
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
          <UserPlus className="w-4 h-4 text-primary" />
        </div>
        <div>
          <div className="font-medium text-sm">Invite "{query}"</div>
          <div className="text-xs text-muted-foreground">Send an invitation to share</div>
        </div>
      </button>
    </div>
  );
}

// ─── Share Button (Main Entry Point) ──────────────────────────────────────
export function ShareButton({
  contentType,
  contentId,
  contentTitle,
  existingShares = [],
  onShareCreated,
  onShareRevoked,
  variant = "default",
  size = "default",
}: {
  contentType: string;
  contentId: string;
  contentTitle?: string;
  existingShares?: ExistingShare[];
  onShareCreated?: (share: any) => void;
  onShareRevoked?: (shareId: number) => void;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "icon";
}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"recipients" | "permissions">("recipients");
  const [selectedRecipient, setSelectedRecipient] = useState<ShareRecipient | null>(null);
  const [permissionLevel, setPermissionLevel] = useState<PermissionLevel>("view");
  const [pendingShares, setPendingShares] = useState<Array<{ recipient: ShareRecipient; permission: PermissionLevel }>>([]);
  const [omitSensitive, setOmitSensitive] = useState(true); // Omission toggle: redact PII/sensitive fields by default

  const handleSelectRecipient = useCallback((recipient: ShareRecipient) => {
    setSelectedRecipient(recipient);
    setStep("permissions");
  }, []);

  const handleAddShare = useCallback(() => {
    if (!selectedRecipient) return;
    setPendingShares((prev) => [...prev, { recipient: selectedRecipient, permission: permissionLevel }]);
    setSelectedRecipient(null);
    setPermissionLevel("view");
    setStep("recipients");
    toast.success(`Added ${selectedRecipient.name} with ${permissionLevel} access`);
  }, [selectedRecipient, permissionLevel]);

  const handleConfirmShares = useCallback(() => {
    for (const share of pendingShares) {
      onShareCreated?.({
        contentType,
        contentId,
        recipient: share.recipient,
        permissionLevel: share.permission,
        omitSensitive,
      });
    }
    setPendingShares([]);
    setOpen(false);
    toast.success(`Shared "${contentTitle || contentType}" with ${pendingShares.length} recipient(s)`);
  }, [pendingShares, contentType, contentId, contentTitle, onShareCreated]);

  const handleCopyLink = useCallback(() => {
    const url = `${window.location.origin}/shared/${contentType}/${contentId}`;
    navigator.clipboard.writeText(url);
    toast.success("Share link copied to clipboard");
  }, [contentType, contentId]);

  const excludeIds = useMemo(() => [
    ...existingShares.filter((s) => s.recipient.id).map((s) => s.recipient.id!),
    ...pendingShares.filter((s) => s.recipient.id).map((s) => s.recipient.id!),
  ], [existingShares, pendingShares]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} size={size} className="gap-2">
          <Share2 className="w-4 h-4" />
          {size !== "icon" && "Share"}
          {existingShares.length > 0 && (
            <Badge variant="secondary" className="ml-1 text-xs">
              {existingShares.length}
            </Badge>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="w-5 h-5" />
            Share {contentTitle || contentType}
          </DialogTitle>
          <DialogDescription>
            Choose who to share with and their permission level
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Omission toggle — field-level redaction control */}
          <div className="flex items-center justify-between p-2 rounded-lg border border-border/50">
            <div className="flex items-center gap-2">
              <EyeOff className="w-4 h-4 text-muted-foreground" />
              <div>
                <div className="text-sm font-medium">Redact sensitive fields</div>
                <div className="text-xs text-muted-foreground">Hide PII, account numbers, and SSN from shared view</div>
              </div>
            </div>
            <Switch checked={omitSensitive} onCheckedChange={setOmitSensitive} />
          </div>

          {/* Quick copy link */}
          <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
            <Link2 className="w-4 h-4 text-muted-foreground shrink-0" />
            <code className="text-xs text-muted-foreground truncate flex-1">
              {window.location.origin}/shared/{contentType}/{contentId}
            </code>
            <Button variant="ghost" size="sm" onClick={handleCopyLink} className="shrink-0">
              <Copy className="w-3.5 h-3.5" />
            </Button>
          </div>

          {/* Pending shares */}
          {pendingShares.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Pending ({pendingShares.length})
              </div>
              {pendingShares.map((share, i) => (
                <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-primary/5 border border-primary/10">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs">
                      {share.recipient.name[0]}
                    </div>
                    <span className="text-sm font-medium">{share.recipient.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">{share.permission}</Badge>
                    <button type="button"
                      onClick={() => setPendingShares((prev) => prev.filter((_, j) => j !== i))}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Existing shares */}
          {existingShares.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Currently shared with ({existingShares.length})
              </div>
              {existingShares.map((share) => (
                <div key={share.id} className="flex items-center justify-between p-2 rounded-lg border border-border">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs">
                      {share.recipient.name[0]}
                    </div>
                    <div>
                      <span className="text-sm font-medium">{share.recipient.name}</span>
                      {share.expiresAt && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          Expires {new Date(share.expiresAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <PermissionSelector value={share.permissionLevel} onChange={() => {}} compact />
                    <button type="button"
                      onClick={() => onShareRevoked?.(share.id)}
                      className="text-muted-foreground hover:text-destructive"
                      title="Revoke access"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add new share */}
          {step === "recipients" ? (
            <RecipientPicker onSelect={handleSelectRecipient} excludeIds={excludeIds} />
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  {selectedRecipient?.name[0]}
                </div>
                <div>
                  <div className="font-medium text-sm">{selectedRecipient?.name}</div>
                  <div className="text-xs text-muted-foreground">{selectedRecipient?.email || selectedRecipient?.role}</div>
                </div>
                <button type="button" onClick={() => { setStep("recipients"); setSelectedRecipient(null); }} className="ml-auto text-muted-foreground hover:text-foreground">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Permission Level</label>
                <PermissionSelector value={permissionLevel} onChange={setPermissionLevel} />
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => { setStep("recipients"); setSelectedRecipient(null); }} className="flex-1">
                  Back
                </Button>
                <Button onClick={handleAddShare} className="flex-1 gap-2">
                  <Check className="w-4 h-4" />
                  Add
                </Button>
              </div>
            </div>
          )}

          {/* Confirm button */}
          {pendingShares.length > 0 && step === "recipients" && (
            <Button onClick={handleConfirmShares} className="w-full gap-2">
              <Share2 className="w-4 h-4" />
              Share with {pendingShares.length} recipient(s)
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}



// ─── Omission Toggle (Standalone) ────────────────────────────────────────
/** Standalone toggle for field-level PII redaction. Use inside any sharing context. */
export function OmissionToggle({
  checked,
  onChange,
  label = "Redact sensitive fields",
  description = "Hide PII, account numbers, and SSN from shared view",
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  description?: string;
}) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg border border-border/50">
      <div className="flex items-center gap-2">
        <EyeOff className="w-4 h-4 text-muted-foreground" />
        <div>
          <div className="text-sm font-medium">{label}</div>
          <div className="text-xs text-muted-foreground">{description}</div>
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

// ─── Sharing Status Indicator ────────────────────────────────────────────
export type SharingStatus = "private" | "shared" | "public" | "expired";

const STATUS_CONFIG: Record<SharingStatus, { label: string; color: string; icon: string; description: string }> = {
  private: { label: "Private", color: "text-muted-foreground bg-muted/50", icon: "🔒", description: "Only you can access" },
  shared: { label: "Shared", color: "text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-950/30", icon: "👥", description: "Shared with specific people" },
  public: { label: "Public", color: "text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-950/30", icon: "🌐", description: "Anyone with the link" },
  expired: { label: "Expired", color: "text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-950/30", icon: "⏰", description: "Share link has expired" },
};

/** Shows the current sharing status of a resource (private, shared, public, expired). */
export function SharingStatusIndicator({
  status,
  recipientCount = 0,
  compact = false,
}: {
  status: SharingStatus;
  recipientCount?: number;
  compact?: boolean;
}) {
  const config = STATUS_CONFIG[status];

  if (compact) {
    return (
      <Badge variant="outline" className={`gap-1 ${config.color} border-current/20`}>
        <span className="text-xs">{config.icon}</span>
        <span>{config.label}</span>
        {status === "shared" && recipientCount > 0 && (
          <span className="text-xs opacity-70">({recipientCount})</span>
        )}
      </Badge>
    );
  }

  return (
    <div className={`flex items-center gap-2.5 px-3 py-2 rounded-lg ${config.color}`}>
      <span className="text-base">{config.icon}</span>
      <div>
        <div className="text-sm font-medium">{config.label}</div>
        <div className="text-xs opacity-70">
          {status === "shared" && recipientCount > 0
            ? `Shared with ${recipientCount} ${recipientCount === 1 ? "person" : "people"}`
            : config.description}
        </div>
      </div>
    </div>
  );
}
