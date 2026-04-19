/**
 * ComplianceChecklist — Per-client interaction compliance checklist (Gap 2).
 *
 * Provides a structured checklist that advisors complete during/after each
 * client interaction. Items are grouped by regulatory category:
 *  - Suitability & KYC
 *  - Disclosure & Consent
 *  - Documentation
 *  - Follow-up
 *
 * State persists in localStorage keyed by client name so each client
 * gets their own checklist. Completion percentage shown in header.
 */
import { useState, useCallback, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Shield, CheckCircle2, Circle, AlertTriangle, FileText,
  Clock, RotateCcw, Download
} from 'lucide-react';

interface ChecklistItem {
  id: string;
  label: string;
  category: 'suitability' | 'disclosure' | 'documentation' | 'followup';
  required: boolean;
  description?: string;
}

const CHECKLIST_ITEMS: ChecklistItem[] = [
  // Suitability & KYC
  { id: 'kyc-verified', label: 'Client identity verified (KYC)', category: 'suitability', required: true, description: 'Confirm client identity per firm KYC policy' },
  { id: 'risk-assessed', label: 'Risk tolerance assessed', category: 'suitability', required: true, description: 'Document client risk tolerance and investment objectives' },
  { id: 'financial-situation', label: 'Financial situation reviewed', category: 'suitability', required: true, description: 'Review income, assets, liabilities, and liquidity needs' },
  { id: 'investment-objectives', label: 'Investment objectives documented', category: 'suitability', required: true, description: 'Record time horizon, goals, and return expectations' },
  { id: 'suitability-determination', label: 'Suitability determination made', category: 'suitability', required: true, description: 'Confirm recommendations are suitable per Reg BI / FINRA 2111' },

  // Disclosure & Consent
  { id: 'fee-disclosed', label: 'Fees and compensation disclosed', category: 'disclosure', required: true, description: 'Disclose all fees, commissions, and compensation arrangements' },
  { id: 'conflicts-disclosed', label: 'Conflicts of interest disclosed', category: 'disclosure', required: true, description: 'Disclose material conflicts per Reg BI' },
  { id: 'privacy-notice', label: 'Privacy notice provided', category: 'disclosure', required: false, description: 'Provide Reg S-P privacy notice if not already on file' },
  { id: 'brochure-delivered', label: 'ADV Part 2 / Brochure delivered', category: 'disclosure', required: false, description: 'Deliver Form ADV Part 2A brochure (RIA) or product prospectus' },
  { id: 'consent-obtained', label: 'Client consent obtained', category: 'disclosure', required: true, description: 'Obtain written or electronic consent for recommended actions' },

  // Documentation
  { id: 'notes-recorded', label: 'Meeting notes recorded', category: 'documentation', required: true, description: 'Document key discussion points and client instructions' },
  { id: 'recommendations-documented', label: 'Recommendations documented', category: 'documentation', required: true, description: 'Record specific recommendations and rationale' },
  { id: 'forms-completed', label: 'Required forms completed', category: 'documentation', required: false, description: 'Complete application forms, account paperwork, etc.' },
  { id: 'crm-updated', label: 'CRM/system records updated', category: 'documentation', required: false, description: 'Update client record in CRM with interaction details' },

  // Follow-up
  { id: 'next-steps-communicated', label: 'Next steps communicated to client', category: 'followup', required: true, description: 'Clearly communicate action items and timeline' },
  { id: 'followup-scheduled', label: 'Follow-up review scheduled', category: 'followup', required: false, description: 'Schedule next review meeting or check-in' },
  { id: 'supervisor-review', label: 'Supervisor review (if required)', category: 'followup', required: false, description: 'Submit for supervisory review per firm policy' },
];

const CATEGORY_META: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  suitability: { label: 'Suitability & KYC', color: 'text-blue-500', icon: <Shield className="w-4 h-4" /> },
  disclosure: { label: 'Disclosure & Consent', color: 'text-amber-500', icon: <FileText className="w-4 h-4" /> },
  documentation: { label: 'Documentation', color: 'text-emerald-500', icon: <FileText className="w-4 h-4" /> },
  followup: { label: 'Follow-up', color: 'text-purple-500', icon: <Clock className="w-4 h-4" /> },
};

interface Props {
  clientName: string;
}

export function ComplianceChecklist({ clientName }: Props) {
  const storageKey = `wb-compliance-${clientName || 'default'}`;

  const [checked, setChecked] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? new Set(JSON.parse(saved)) : new Set<string>();
    } catch { return new Set<string>(); }
  });

  const [notes, setNotes] = useState(() => {
    try { return localStorage.getItem(`${storageKey}-notes`) || ''; } catch { return ''; }
  });

  // Persist on change
  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify([...checked])); } catch {}
  }, [checked, storageKey]);

  useEffect(() => {
    try { localStorage.setItem(`${storageKey}-notes`, notes); } catch {}
  }, [notes, storageKey]);

  const toggle = useCallback((id: string) => {
    setChecked(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    if (confirm('Reset all checklist items? This cannot be undone.')) {
      setChecked(new Set());
      setNotes('');
    }
  }, []);

  const stats = useMemo(() => {
    const total = CHECKLIST_ITEMS.length;
    const completed = CHECKLIST_ITEMS.filter(i => checked.has(i.id)).length;
    const requiredTotal = CHECKLIST_ITEMS.filter(i => i.required).length;
    const requiredCompleted = CHECKLIST_ITEMS.filter(i => i.required && checked.has(i.id)).length;
    return {
      total, completed, requiredTotal, requiredCompleted,
      pct: Math.round((completed / total) * 100),
      requiredPct: requiredTotal > 0 ? Math.round((requiredCompleted / requiredTotal) * 100) : 100,
      allRequiredDone: requiredCompleted === requiredTotal,
    };
  }, [checked]);

  const grouped = useMemo(() => {
    const groups: Record<string, ChecklistItem[]> = {};
    for (const item of CHECKLIST_ITEMS) {
      (groups[item.category] ??= []).push(item);
    }
    return groups;
  }, []);

  const exportChecklist = useCallback(() => {
    const lines = [
      `Compliance Checklist — ${clientName || 'Client'}`,
      `Date: ${new Date().toLocaleString()}`,
      `Completion: ${stats.completed}/${stats.total} (${stats.pct}%)`,
      `Required: ${stats.requiredCompleted}/${stats.requiredTotal} (${stats.requiredPct}%)`,
      '',
      ...Object.entries(grouped).flatMap(([cat, items]) => [
        `\n## ${CATEGORY_META[cat].label}`,
        ...items.map(i => `${checked.has(i.id) ? '[x]' : '[ ]'} ${i.label}${i.required ? ' (REQUIRED)' : ''}`),
      ]),
      '',
      `## Notes`,
      notes || '(none)',
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `compliance-checklist-${clientName || 'client'}-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [clientName, checked, notes, stats, grouped]);

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" />
            Compliance Checklist
            {clientName && <Badge variant="outline" className="text-xs font-normal">{clientName}</Badge>}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant={stats.allRequiredDone ? 'default' : 'destructive'} className="text-xs">
              {stats.allRequiredDone ? 'All Required Complete' : `${stats.requiredCompleted}/${stats.requiredTotal} Required`}
            </Badge>
            <Badge variant="outline" className="text-xs">{stats.pct}%</Badge>
          </div>
        </div>
        {/* Progress bar */}
        <div className="w-full h-2 bg-muted rounded-full overflow-hidden mt-2">
          <div
            className={`h-full rounded-full transition-all ${stats.allRequiredDone ? 'bg-green-500' : 'bg-amber-500'}`}
            style={{ width: `${stats.pct}%` }}
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {Object.entries(grouped).map(([cat, items]) => {
          const meta = CATEGORY_META[cat];
          const catCompleted = items.filter(i => checked.has(i.id)).length;
          return (
            <div key={cat}>
              <div className="flex items-center gap-2 mb-2">
                <span className={meta.color}>{meta.icon}</span>
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{meta.label}</span>
                <Badge variant="outline" className="text-[10px]">{catCompleted}/{items.length}</Badge>
              </div>
              <div className="space-y-1 ml-1">
                {items.map(item => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => toggle(item.id)}
                    className="w-full text-left flex items-start gap-2 p-2 rounded hover:bg-muted/50 transition-colors group"
                    title={item.description}
                  >
                    {checked.has(item.id) ? (
                      <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                    ) : (
                      <Circle className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5 group-hover:text-primary" />
                    )}
                    <div className="flex-1 min-w-0">
                      <span className={`text-sm ${checked.has(item.id) ? 'line-through text-muted-foreground' : ''}`}>
                        {item.label}
                      </span>
                      {item.required && !checked.has(item.id) && (
                        <AlertTriangle className="w-3 h-3 text-amber-500 inline ml-1" />
                      )}
                      {item.description && (
                        <p className="text-[10px] text-muted-foreground/70 mt-0.5">{item.description}</p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          );
        })}

        {/* Notes */}
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground block mb-1">
            Interaction Notes
          </label>
          <Textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Record key discussion points, client instructions, and rationale for recommendations..."
            className="text-sm min-h-[80px]"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2 border-t">
          <Button variant="outline" size="sm" onClick={exportChecklist} className="text-xs gap-1">
            <Download className="w-3 h-3" /> Export Checklist
          </Button>
          <div className="flex-1" />
          <Button variant="ghost" size="sm" onClick={reset} className="text-xs gap-1 text-red-400 hover:text-red-300">
            <RotateCcw className="w-3 h-3" /> Reset
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
