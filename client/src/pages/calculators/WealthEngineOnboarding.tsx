/**
 * WealthEngineOnboarding — Guided first-time experience for the Wealth Engine.
 *
 * Gap 1: Guided onboarding flow for new users
 * Gap 5: Automated complexity level suggestion
 *
 * Shows a 3-step wizard:
 *  1. Role selection (client, advisor, manager, admin)
 *  2. Experience level (new, intermediate, expert)
 *  3. Recommended starting panel + complexity level
 *
 * Persists completion in localStorage so it only shows once.
 */
import { useState, useCallback } from 'react';
import { sendFeedback } from '@/lib/feedbackSpecs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  User, Briefcase, Users, Shield, ArrowRight, ArrowLeft,
  Sparkles, CheckCircle2, Target, Layers, Gem, BarChart3,
  GraduationCap, Clock, Rocket
} from 'lucide-react';

export type OnboardingResult = {
  role: 'client' | 'advisor' | 'manager' | 'admin';
  experience: 'new' | 'intermediate' | 'expert';
  suggestedComplexity: 'simple' | 'detailed' | 'expert';
  suggestedPanel: string;
};

const ROLES = [
  {
    id: 'client' as const,
    label: 'Client / Individual',
    description: 'I want to plan my personal finances, retirement, and protection needs.',
    icon: User,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10 border-blue-500/30',
  },
  {
    id: 'advisor' as const,
    label: 'Financial Professional',
    description: 'I advise clients on financial planning, insurance, and investment strategies.',
    icon: Briefcase,
    color: 'text-amber-500',
    bgColor: 'bg-amber-500/10 border-amber-500/30',
  },
  {
    id: 'manager' as const,
    label: 'Team Lead / Manager',
    description: 'I manage a team of advisors and oversee practice performance.',
    icon: Users,
    color: 'text-emerald-500',
    bgColor: 'bg-emerald-500/10 border-emerald-500/30',
  },
  {
    id: 'admin' as const,
    label: 'Platform Administrator',
    description: 'I manage the platform, compliance, and organizational settings.',
    icon: Shield,
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/10 border-purple-500/30',
  },
];

const EXPERIENCE_LEVELS = [
  {
    id: 'new' as const,
    label: 'Getting Started',
    description: 'New to financial planning tools. Show me the essentials.',
    icon: GraduationCap,
    color: 'text-green-500',
    bgColor: 'bg-green-500/10 border-green-500/30',
  },
  {
    id: 'intermediate' as const,
    label: 'Experienced',
    description: 'Comfortable with financial concepts. Show me the full toolkit.',
    icon: Target,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10 border-blue-500/30',
  },
  {
    id: 'expert' as const,
    label: 'Expert / Power User',
    description: 'I want maximum depth — advanced strategies, cascade flows, and back-solve.',
    icon: Rocket,
    color: 'text-amber-500',
    bgColor: 'bg-amber-500/10 border-amber-500/30',
  },
];

function getSuggestion(role: OnboardingResult['role'], experience: OnboardingResult['experience']): {
  complexity: OnboardingResult['suggestedComplexity'];
  panel: string;
  panelLabel: string;
  tips: string[];
} {
  const complexityMap: Record<string, OnboardingResult['suggestedComplexity']> = {
    'client-new': 'simple',
    'client-intermediate': 'detailed',
    'client-expert': 'expert',
    'advisor-new': 'detailed',
    'advisor-intermediate': 'detailed',
    'advisor-expert': 'expert',
    'manager-new': 'detailed',
    'manager-intermediate': 'expert',
    'manager-expert': 'expert',
    'admin-new': 'detailed',
    'admin-intermediate': 'detailed',
    'admin-expert': 'expert',
  };

  const panelMap: Record<string, { panel: string; label: string }> = {
    'client-new': { panel: 'pfr-wizard', label: 'PFR Wizard — guided financial review' },
    'client-intermediate': { panel: 'client-wealth-hub', label: 'Unified Wealth Plan — comprehensive view' },
    'client-expert': { panel: 'client-wealth-hub', label: 'Unified Wealth Plan — full Expert mode' },
    'advisor-new': { panel: 'pfr-wizard', label: 'PFR Wizard — client intake workflow' },
    'advisor-intermediate': { panel: 'client-wealth-hub', label: 'Unified Wealth Plan — client planning' },
    'advisor-expert': { panel: 'advanced-strategies-hub', label: 'Advanced Strategies Hub — full toolkit' },
    'manager-new': { panel: 'myplan', label: 'My Plan — practice management overview' },
    'manager-intermediate': { panel: 'dashboard', label: 'Dashboard — team performance tracking' },
    'manager-expert': { panel: 'scenario-comparison', label: 'Scenarios — multi-strategy comparison' },
    'admin-new': { panel: 'profile', label: 'Client Profile — platform overview' },
    'admin-intermediate': { panel: 'dashboard', label: 'Dashboard — organizational metrics' },
    'admin-expert': { panel: 'firm-comparison', label: 'Firm Comparison — benchmarking' },
  };

  const tipsMap: Record<string, string[]> = {
    'client-new': [
      'Start with the PFR Wizard for a guided financial review',
      'The Quick mode shows only essential fields — perfect for getting started',
      'Save your progress anytime with the Save button in the header',
    ],
    'client-intermediate': [
      'The Unified Wealth Plan gives you a holistic view of all planning domains',
      'Standard mode balances depth with simplicity',
      'Try the Scenario Comparison to compare different planning strategies',
    ],
    'client-expert': [
      'Expert mode unlocks all advanced inputs and cascade flow analysis',
      'Use the Advanced Strategies Hub for ILIT, premium financing, and trust engineering',
      'The Monte Carlo simulation helps stress-test your retirement plan',
    ],
    'advisor-new': [
      'Use the PFR Wizard to guide client conversations',
      'Save each client as a separate session for easy recall',
      'The PDF export creates a professional client-ready report',
    ],
    'advisor-intermediate': [
      'The cascade flow shows how changes in one domain affect others',
      'Use Scenario Comparison to present options to clients',
      'Share plans with clients using the Share button',
    ],
    'advisor-expert': [
      'Expert mode reveals back-solve inputs and advanced strategy levers',
      'The Advanced Strategies Hub covers ILIT, premium finance, and charitable planning',
      'Use Practice Management panels to track your business metrics alongside client planning',
    ],
    'manager-new': [
      'My Plan gives you a quick overview of your practice metrics',
      'The P&L panel shows team-level profitability analysis',
      'Use Goal Tracker to set and monitor team targets',
    ],
    'manager-intermediate': [
      'The Dashboard consolidates all key performance indicators',
      'Use Firm Comparison to benchmark against industry standards',
      'The Recruiting Funnel helps optimize your talent pipeline',
    ],
    'manager-expert': [
      'Scenario Comparison lets you model different team growth strategies',
      'The cascade flow shows how practice changes affect client outcomes',
      'Use Strategy Archetypes to identify optimal team configurations',
    ],
    'admin-new': [
      'Start by reviewing the platform layout and available panels',
      'The Compliance section tracks audit trails and disclaimers',
      'Use the Data Hub to understand available data integrations',
    ],
    'admin-intermediate': [
      'The Dashboard provides organizational-level metrics',
      'Monitor compliance status across all advisor interactions',
      'Use Due Diligence panels for governance oversight',
    ],
    'admin-expert': [
      'Firm Comparison provides deep benchmarking analytics',
      'Advanced Workflows enable custom compliance rules',
      'The Governance/IPS panel manages investment policy statements',
    ],
  };

  const key = `${role}-${experience}`;
  const p = panelMap[key] || panelMap['client-new'];
  return {
    complexity: complexityMap[key] || 'detailed',
    panel: p.panel,
    panelLabel: p.label,
    tips: tipsMap[key] || tipsMap['client-new'],
  };
}

const COMPLEXITY_LABELS: Record<string, { label: string; description: string; icon: React.ReactNode }> = {
  simple: { label: 'Quick', description: 'Essential fields only — fast and focused', icon: <Sparkles className="w-4 h-4" /> },
  detailed: { label: 'Standard', description: 'Balanced depth with all key inputs', icon: <Layers className="w-4 h-4" /> },
  expert: { label: 'Expert', description: 'Full depth — advanced inputs, cascade flow, back-solve', icon: <Gem className="w-4 h-4" /> },
};

interface Props {
  onComplete: (result: OnboardingResult) => void;
  onSkip: () => void;
}

export function WealthEngineOnboarding({ onComplete, onSkip }: Props) {
  const [step, setStep] = useState(1);
  const [role, setRole] = useState<OnboardingResult['role'] | null>(null);
  const [experience, setExperience] = useState<OnboardingResult['experience'] | null>(null);

  const suggestion = role && experience ? getSuggestion(role, experience) : null;

  const handleComplete = useCallback(() => {
    if (!role || !experience || !suggestion) return;
    try { localStorage.setItem('wb-onboarding-complete', 'true'); } catch {}
    try { localStorage.setItem('wb-onboarding-role', role); } catch {}
    try { localStorage.setItem('wb-onboarding-experience', experience); } catch {}
    sendFeedback('onboarding.complete', { persona: role });
    onComplete({
      role,
      experience,
      suggestedComplexity: suggestion.complexity,
      suggestedPanel: suggestion.panel,
    });
  }, [role, experience, suggestion, onComplete]);

  const handleSkip = useCallback(() => {
    try { localStorage.setItem('wb-onboarding-complete', 'true'); } catch {}
    onSkip();
  }, [onSkip]);

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      {/* Progress */}
      <div className="flex items-center gap-2 mb-6">
        {[1, 2, 3].map(s => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
              s < step ? 'bg-primary text-primary-foreground' :
              s === step ? 'bg-primary text-primary-foreground' :
              'bg-muted text-muted-foreground'
            }`}>
              {s < step ? <CheckCircle2 className="w-4 h-4" /> : s}
            </div>
            {s < 3 && <div className={`w-12 h-0.5 ${s < step ? 'bg-primary' : 'bg-muted'}`} />}
          </div>
        ))}
        <div className="flex-1" />
        <Button variant="ghost" size="sm" onClick={handleSkip} className="text-muted-foreground">
          Skip
        </Button>
      </div>

      {/* Step 1: Role Selection */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Welcome to the Wealth Engine
            </CardTitle>
            <CardDescription>
              Tell us about yourself so we can personalize your experience.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {ROLES.map(r => (
              <button
                key={r.id}
                type="button"
                onClick={() => { setRole(r.id); setStep(2); }}
                className={`w-full text-left p-4 rounded-lg border-2 transition-all hover:shadow-md ${
                  role === r.id ? r.bgColor : 'border-transparent bg-muted/50 hover:bg-muted'
                }`}
              >
                <div className="flex items-center gap-3">
                  <r.icon className={`w-5 h-5 ${role === r.id ? r.color : 'text-muted-foreground'}`} />
                  <div>
                    <p className="font-medium text-sm">{r.label}</p>
                    <p className="text-xs text-muted-foreground">{r.description}</p>
                  </div>
                </div>
              </button>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Step 2: Experience Level */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary" />
              Your Experience Level
            </CardTitle>
            <CardDescription>
              This helps us set the right complexity level for you.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {EXPERIENCE_LEVELS.map(e => (
              <button
                key={e.id}
                type="button"
                onClick={() => { setExperience(e.id); setStep(3); }}
                className={`w-full text-left p-4 rounded-lg border-2 transition-all hover:shadow-md ${
                  experience === e.id ? e.bgColor : 'border-transparent bg-muted/50 hover:bg-muted'
                }`}
              >
                <div className="flex items-center gap-3">
                  <e.icon className={`w-5 h-5 ${experience === e.id ? e.color : 'text-muted-foreground'}`} />
                  <div>
                    <p className="font-medium text-sm">{e.label}</p>
                    <p className="text-xs text-muted-foreground">{e.description}</p>
                  </div>
                </div>
              </button>
            ))}
            <div className="pt-2">
              <Button variant="ghost" size="sm" onClick={() => setStep(1)}>
                <ArrowLeft className="w-4 h-4 mr-1" /> Back
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Recommendation */}
      {step === 3 && suggestion && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              Your Personalized Setup
            </CardTitle>
            <CardDescription>
              Based on your selections, here is our recommended configuration.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Recommended complexity */}
            <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
              <div className="flex items-center gap-2 mb-2">
                {COMPLEXITY_LABELS[suggestion.complexity].icon}
                <span className="font-medium text-sm">Recommended Complexity: {COMPLEXITY_LABELS[suggestion.complexity].label}</span>
                <Badge variant="outline" className="text-xs">{suggestion.complexity}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">{COMPLEXITY_LABELS[suggestion.complexity].description}</p>
            </div>

            {/* Recommended starting panel */}
            <div className="p-4 rounded-lg bg-muted/50 border">
              <div className="flex items-center gap-2 mb-2">
                <Target className="w-4 h-4 text-primary" />
                <span className="font-medium text-sm">Recommended Starting Point</span>
              </div>
              <p className="text-xs text-muted-foreground">{suggestion.panelLabel}</p>
            </div>

            {/* Tips */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Quick Tips</p>
              {suggestion.tips.map((tip, i) => (
                <div key={i} className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-muted-foreground">{tip}</p>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2 pt-2">
              <Button variant="ghost" size="sm" onClick={() => setStep(2)}>
                <ArrowLeft className="w-4 h-4 mr-1" /> Back
              </Button>
              <div className="flex-1" />
              <Button onClick={handleComplete}>
                Get Started <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
