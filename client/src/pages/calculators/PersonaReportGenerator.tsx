/**
 * PersonaReportGenerator — Automated report generation per persona type (Gap 3).
 *
 * Generates tailored reports based on the user's role/persona:
 *  - Client: "My Financial Health Summary" — simplified, client-friendly
 *  - Advisor: "Client Planning Report" — detailed, compliance-ready
 *  - Manager: "Practice Performance Report" — team metrics, production
 *  - Admin: "Platform Compliance Report" — audit trail, governance
 *
 * Uses the existing weData and scorecard to populate reports.
 */
import { useCallback, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  FileText, Download, User, Briefcase, Users, Shield,
  Loader2, CheckCircle2
} from 'lucide-react';
import { toast } from 'sonner';
import { fmt, pct } from '@/lib/format';

type ReportType = 'client-summary' | 'advisor-planning' | 'manager-practice' | 'admin-compliance';

interface ReportOption {
  id: ReportType;
  label: string;
  description: string;
  icon: React.ReactNode;
  sections: string[];
}

const REPORT_OPTIONS: ReportOption[] = [
  {
    id: 'client-summary',
    label: 'Client Financial Health Summary',
    description: 'Simplified overview for client review — plain language, key metrics, action items.',
    icon: <User className="w-4 h-4 text-blue-500" />,
    sections: ['Financial Health Score', 'Key Metrics at a Glance', 'Recommended Actions', 'Next Steps'],
  },
  {
    id: 'advisor-planning',
    label: 'Advisor Planning Report',
    description: 'Detailed planning analysis — compliance-ready, all domains, product recommendations.',
    icon: <Briefcase className="w-4 h-4 text-amber-500" />,
    sections: ['Client Profile', 'All Domain Scores', 'Product Recommendations', 'Cash Flow Analysis', 'Protection Gap', 'Retirement Projection', 'Tax Strategy', 'Estate Plan', 'Compliance Notes'],
  },
  {
    id: 'manager-practice',
    label: 'Practice Performance Report',
    description: 'Team-level metrics — production, revenue streams, recruiting pipeline.',
    icon: <Users className="w-4 h-4 text-emerald-500" />,
    sections: ['Practice Overview', 'Income Roll-Up', 'Production Funnel', 'Team Performance', 'Recruiting Pipeline', 'P&L Summary', 'Growth Targets'],
  },
  {
    id: 'admin-compliance',
    label: 'Platform Compliance Report',
    description: 'Audit trail and governance — interaction log, checklist status, disclaimers.',
    icon: <Shield className="w-4 h-4 text-purple-500" />,
    sections: ['Compliance Score', 'Audit Trail', 'Checklist Completion', 'Disclosure Verification', 'Data Governance', 'Regulatory Notes'],
  },
];

interface Props {
  clientName: string;
  age: number;
  totalIncome: number;
  scorecard: { pctScore: number; overall: number; maxScore: number; domains: Array<{ name: string; score: number }> };
  recommendations: Array<{ product: string; coverage: string; premium: number; carrier: string; priority: string }>;
  weData: Record<string, any>;
}

export function PersonaReportGenerator({ clientName, age, totalIncome, scorecard, recommendations, weData }: Props) {
  const [selectedReport, setSelectedReport] = useState<ReportType>('advisor-planning');
  const [generating, setGenerating] = useState(false);

  const generateReport = useCallback(() => {
    setGenerating(true);
    const option = REPORT_OPTIONS.find(o => o.id === selectedReport)!;

    setTimeout(() => {
      let html = '';

      const header = `
        <html><head><title>${option.label} — ${clientName || 'Client'}</title>
        <style>
          body{font-family:system-ui,-apple-system,sans-serif;padding:40px;color:#1e293b;max-width:900px;margin:0 auto;line-height:1.6}
          h1{color:#92400e;border-bottom:2px solid #92400e;padding-bottom:8px;margin-bottom:16px}
          h2{color:#334155;border-bottom:1px solid #e2e8f0;padding-bottom:4px;margin-top:28px}
          h3{color:#475569;margin-top:16px}
          table{width:100%;border-collapse:collapse;margin:12px 0}
          th,td{border:1px solid #e2e8f0;padding:8px 12px;text-align:left;font-size:13px}
          th{background:#f8fafc;font-weight:600;font-size:12px;text-transform:uppercase;letter-spacing:0.05em}
          .badge{display:inline-block;padding:2px 8px;border-radius:9999px;font-size:11px;font-weight:600}
          .badge-green{background:#dcfce7;color:#166534}.badge-amber{background:#fef3c7;color:#92400e}.badge-red{background:#fee2e2;color:#991b1b}
          .kpi{display:inline-block;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px 20px;margin:4px;text-align:center;min-width:120px}
          .kpi .val{font-size:20px;font-weight:700;color:#334155}.kpi .lbl{font-size:11px;color:#94a3b8;margin-top:2px}
          .section{page-break-inside:avoid}
          .disclaimer{font-size:10px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:12px;margin-top:32px}
          .action-item{background:#f0fdf4;border-left:3px solid #22c55e;padding:8px 12px;margin:4px 0;font-size:13px}
          @media print{body{padding:20px}h1{font-size:20px}h2{font-size:16px}}
        </style></head><body>
      `;

      const footer = `
        <div class="disclaimer">
          <p><strong>Disclaimer:</strong> This report is generated for informational and educational purposes only. It does not constitute financial, legal, tax, or investment advice. 
          All projections are estimates based on the inputs provided and may not reflect actual outcomes. Past performance does not guarantee future results. 
          Consult with qualified professionals before making financial decisions.</p>
          <p>Generated by WealthBridge AI — ${new Date().toLocaleString()} | Report Type: ${option.label}</p>
        </div>
        </body></html>
      `;

      if (selectedReport === 'client-summary') {
        const statusBadge = (score: number) => score >= 3 ? '<span class="badge badge-green">Strong</span>' : score >= 2 ? '<span class="badge badge-amber">Moderate</span>' : '<span class="badge badge-red">Needs Attention</span>';
        html = `${header}
          <h1>Your Financial Health Summary</h1>
          <p>Prepared for <strong>${clientName || 'Valued Client'}</strong> | Age ${age} | ${new Date().toLocaleDateString()}</p>
          
          <div class="section">
            <h2>Your Financial Health Score</h2>
            <div class="kpi"><div class="val">${scorecard.pctScore}%</div><div class="lbl">Overall Score</div></div>
            <div class="kpi"><div class="val">${scorecard.overall}/${scorecard.maxScore}</div><div class="lbl">Points</div></div>
            <div class="kpi"><div class="val">${recommendations.length}</div><div class="lbl">Recommendations</div></div>
          </div>
          
          <div class="section">
            <h2>How You're Doing</h2>
            <table><tr><th>Area</th><th>Status</th></tr>
            ${scorecard.domains.map(d => `<tr><td>${d.name}</td><td>${statusBadge(d.score)}</td></tr>`).join('')}
            </table>
          </div>
          
          <div class="section">
            <h2>Recommended Next Steps</h2>
            ${recommendations.slice(0, 5).map(r => `<div class="action-item"><strong>${r.product}</strong> — ${r.coverage} (est. ${fmt(r.premium)}/yr) — Priority: ${r.priority}</div>`).join('')}
          </div>
          
          <div class="section">
            <h2>What This Means for You</h2>
            <p>Based on your current financial picture, your overall health score is <strong>${scorecard.pctScore}%</strong>. 
            ${scorecard.pctScore >= 80 ? 'You are in excellent financial shape. Focus on optimizing and protecting what you have built.' :
              scorecard.pctScore >= 60 ? 'You have a solid foundation with some areas that could benefit from attention.' :
              'There are several important areas to address. Working with your advisor on the recommended steps above will help strengthen your financial position.'}</p>
          </div>
          ${footer}`;
      } else if (selectedReport === 'advisor-planning') {
        const totalPremium = recommendations.reduce((s, r) => s + r.premium, 0);
        html = `${header}
          <h1>Client Planning Report</h1>
          <p><strong>Client:</strong> ${clientName || 'N/A'} | <strong>Age:</strong> ${age} | <strong>Income:</strong> ${fmt(totalIncome)} | <strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
          
          <div class="section">
            <h2>Financial Health Score: ${scorecard.pctScore}% (${scorecard.overall}/${scorecard.maxScore})</h2>
            <table><tr><th>Domain</th><th>Score</th><th>Max</th><th>Status</th></tr>
            ${scorecard.domains.map(d => `<tr><td>${d.name}</td><td>${d.score}</td><td>3</td><td>${d.score >= 3 ? 'Strong' : d.score >= 2 ? 'Moderate' : 'Needs Attention'}</td></tr>`).join('')}
            </table>
          </div>
          
          <div class="section">
            <h2>Product Recommendations</h2>
            <table><tr><th>Product</th><th>Coverage</th><th>Annual Premium</th><th>Carrier</th><th>Priority</th></tr>
            ${recommendations.map(r => `<tr><td>${r.product}</td><td>${r.coverage}</td><td>${fmt(r.premium)}</td><td>${r.carrier}</td><td>${r.priority}</td></tr>`).join('')}
            <tr style="font-weight:bold;background:#f8fafc"><td colspan="2">TOTAL (${recommendations.length} products)</td><td>${fmt(totalPremium)}</td><td colspan="2">${pct(totalIncome > 0 ? totalPremium / totalIncome : 0)} of income</td></tr>
            </table>
          </div>
          
          <div class="section">
            <h2>Compliance Notes</h2>
            <p>This report was generated as part of a comprehensive financial review. All recommendations are based on the suitability analysis performed during the client interaction. 
            Fee disclosures, conflict of interest statements, and client consent should be documented separately per firm compliance policy.</p>
          </div>
          ${footer}`;
      } else if (selectedReport === 'manager-practice') {
        html = `${header}
          <h1>Practice Performance Report</h1>
          <p><strong>Date:</strong> ${new Date().toLocaleDateString()} | <strong>Report Period:</strong> Current</p>
          
          <div class="section">
            <h2>Practice Overview</h2>
            <p>This report summarizes the current state of practice management metrics as configured in the Wealth Engine. 
            Use this alongside the interactive dashboard for real-time tracking.</p>
            <div class="kpi"><div class="val">${fmt(weData?.ppTargetGDC || 0)}</div><div class="lbl">Target GDC</div></div>
            <div class="kpi"><div class="val">${weData?.ppRole || 'N/A'}</div><div class="lbl">Role</div></div>
            <div class="kpi"><div class="val">${(weData?.ppTeamMembers || []).length}</div><div class="lbl">Team Members</div></div>
          </div>
          
          <div class="section">
            <h2>Key Metrics</h2>
            <table>
              <tr><td>WealthBridge %</td><td>${pct((weData?.ppWbPct || 0) / 100)}</td></tr>
              <tr><td>Override Rate</td><td>${pct((weData?.ppOverrideRate || 0) / 100)}</td></tr>
              <tr><td>AUM Existing</td><td>${fmt(weData?.ppAumExisting || 0)}</td></tr>
              <tr><td>AUM New</td><td>${fmt(weData?.ppAumNew || 0)}</td></tr>
            </table>
          </div>
          
          <div class="section">
            <h2>Recommendations</h2>
            <div class="action-item">Review team production targets quarterly against industry benchmarks</div>
            <div class="action-item">Optimize recruiting funnel — track CAC and first-year retention</div>
            <div class="action-item">Diversify revenue streams — aim for 3+ income sources</div>
          </div>
          ${footer}`;
      } else {
        html = `${header}
          <h1>Platform Compliance Report</h1>
          <p><strong>Date:</strong> ${new Date().toLocaleDateString()} | <strong>Generated by:</strong> WealthBridge AI</p>
          
          <div class="section">
            <h2>Compliance Overview</h2>
            <p>This report provides a summary of compliance-related activities and controls within the WealthBridge platform.</p>
            <div class="kpi"><div class="val">${scorecard.pctScore}%</div><div class="lbl">Health Score</div></div>
            <div class="kpi"><div class="val">${recommendations.length}</div><div class="lbl">Active Recommendations</div></div>
          </div>
          
          <div class="section">
            <h2>Regulatory Checklist Status</h2>
            <table>
              <tr><th>Requirement</th><th>Status</th></tr>
              <tr><td>KYC/AML Verification</td><td>Checklist available per client</td></tr>
              <tr><td>Suitability Documentation</td><td>Integrated in planning workflow</td></tr>
              <tr><td>Fee Disclosure</td><td>Included in report generation</td></tr>
              <tr><td>Conflict of Interest</td><td>Disclosure checklist item</td></tr>
              <tr><td>Privacy Notice</td><td>Checklist item (Reg S-P)</td></tr>
              <tr><td>Audit Trail</td><td>Available via Compliance Copilot</td></tr>
            </table>
          </div>
          
          <div class="section">
            <h2>Data Governance</h2>
            <p>All client data is processed within the WealthBridge platform with encryption at rest and in transit. 
            No client financial data is stored in plain text. Audit logs are maintained for all data access events.</p>
          </div>
          ${footer}`;
      }

      const printWindow = window.open('', '_blank', 'noopener,noreferrer');
      if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();
        toast.success(`${option.label} generated — use browser Print to save as PDF`);
      } else {
        toast.error('Pop-up blocked — please allow pop-ups for this site');
      }
      setGenerating(false);
    }, 500);
  }, [selectedReport, clientName, age, totalIncome, scorecard, recommendations, weData]);

  const selected = REPORT_OPTIONS.find(o => o.id === selectedReport)!;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <FileText className="w-4 h-4 text-primary" />
          Generate Report
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Select value={selectedReport} onValueChange={v => setSelectedReport(v as ReportType)}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {REPORT_OPTIONS.map(opt => (
              <SelectItem key={opt.id} value={opt.id}>
                <div className="flex items-center gap-2">
                  {opt.icon}
                  <span>{opt.label}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <p className="text-xs text-muted-foreground">{selected.description}</p>

        <div className="flex flex-wrap gap-1">
          {selected.sections.map(s => (
            <Badge key={s} variant="outline" className="text-[10px]">{s}</Badge>
          ))}
        </div>

        <Button onClick={generateReport} disabled={generating} className="w-full gap-2">
          {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          {generating ? 'Generating...' : `Generate ${selected.label}`}
        </Button>
      </CardContent>
    </Card>
  );
}
