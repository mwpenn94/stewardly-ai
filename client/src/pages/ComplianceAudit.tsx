/**
 * ComplianceAudit — Compliance audit trail and regulatory reporting dashboard.
 * Shows audit events, compliance scores, and regulatory filing status.
 */
import { useState } from "react";
import { SEOHead } from "@/components/SEOHead";
import { FinancialScoreCard } from "@/components/FinancialScoreCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Shield, Search, Download, CheckCircle2, AlertTriangle, XCircle, Clock, FileText, Eye } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";

const AUDIT_EVENTS = [
  { id: 1, time: "2026-04-05 10:15", action: "Client data accessed", user: "Sarah A.", category: "data_access", severity: "info", details: "Viewed client #1247 financial profile" },
  { id: 2, time: "2026-04-05 09:42", action: "Suitability check completed", user: "System", category: "compliance", severity: "success", details: "Auto-suitability passed for trade #8821" },
  { id: 3, time: "2026-04-05 08:30", action: "Failed login attempt", user: "Unknown", category: "security", severity: "warning", details: "3 failed attempts from IP 192.168.1.45" },
  { id: 4, time: "2026-04-04 16:00", action: "ADV Part 2 filing due", user: "System", category: "regulatory", severity: "critical", details: "SEC ADV Part 2 annual update due in 14 days" },
  { id: 5, time: "2026-04-04 14:22", action: "PII export requested", user: "Mike T.", category: "data_access", severity: "warning", details: "Exported 45 client records to CSV" },
  { id: 6, time: "2026-04-04 11:00", action: "Best execution review", user: "System", category: "compliance", severity: "success", details: "Q1 2026 best execution analysis completed" },
];

const severityIcon = { info: Eye, success: CheckCircle2, warning: AlertTriangle, critical: XCircle };
const severityColor = { info: "text-blue-400", success: "text-emerald-400", warning: "text-amber-400", critical: "text-red-400" };

export default function ComplianceAudit() {
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const filtered = AUDIT_EVENTS.filter(e => {
    if (search && !e.action.toLowerCase().includes(search.toLowerCase()) && !e.details.toLowerCase().includes(search.toLowerCase())) return false;
    if (categoryFilter !== "all" && e.category !== categoryFilter) return false;
    return true;
  });

  return (
    <div className="container max-w-5xl py-8 space-y-6">
      <SEOHead title="Compliance Audit" description="Audit trail and regulatory compliance dashboard" />

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/operations")}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><Shield className="h-6 w-6" /> Compliance Audit</h1>
            <p className="text-sm text-muted-foreground">Audit trail, regulatory filings, and compliance monitoring</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => toast.info("Audit export coming soon")}>
          <Download className="h-3.5 w-3.5 mr-1" /> Export Report
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <FinancialScoreCard title="Compliance Score" value={94} format="number" icon={Shield} trend="up" trendValue="+2 this month" />
        <FinancialScoreCard title="Audit Events (30d)" value={1247} format="number" icon={FileText} trend="flat" trendValue="Normal" />
        <FinancialScoreCard title="Open Findings" value={3} format="number" icon={AlertTriangle} trend="down" trendValue="-2 resolved" />
        <FinancialScoreCard title="Next Filing" value="14 days" icon={Clock} />
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search audit events..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-40 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="data_access">Data Access</SelectItem>
            <SelectItem value="compliance">Compliance</SelectItem>
            <SelectItem value="security">Security</SelectItem>
            <SelectItem value="regulatory">Regulatory</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {filtered.map(event => {
              const Icon = severityIcon[event.severity as keyof typeof severityIcon];
              return (
                <div key={event.id} className="flex items-start gap-3 p-4 hover:bg-muted/30 transition-colors">
                  <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${severityColor[event.severity as keyof typeof severityColor]}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{event.action}</span>
                      <Badge variant="outline" className="text-[10px] capitalize">{event.category}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{event.details}</p>
                    <p className="text-xs text-muted-foreground/70 mt-1">{event.user} • {event.time}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
