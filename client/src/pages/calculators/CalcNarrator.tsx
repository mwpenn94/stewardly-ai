/* CalcNarrator — guided walk-through narration system for the Wealth Engine.
   Walks the user through each panel, explaining inputs and results with
   configurable speed and stop/resume controls. */
import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Play, Square, Volume2, VolumeX, ChevronRight, ChevronLeft } from 'lucide-react';

/* ═══ NARRATION SCRIPT ═══ */
interface NarrationStep {
  panelId: string;
  title: string;
  text: string;
}

const NARRATION_SCRIPT: NarrationStep[] = [
  { panelId: 'profile', title: 'Client Profile', text: 'Start by entering the client\'s basic demographics — name, age, income, net worth, and existing coverage. These inputs flow into every downstream calculation.' },
  { panelId: 'cash', title: 'Cash Flow Analysis', text: 'The Cash Flow panel breaks down monthly income vs. expenses, calculates savings rate, and evaluates emergency fund adequacy. A healthy savings rate is 20%+ of gross income.' },
  { panelId: 'protect', title: 'Protection Needs', text: 'Protection uses the DIME method — Debt, Income replacement, Mortgage payoff, and Education funding — to calculate the total insurance gap. Compare this to existing coverage.' },
  { panelId: 'grow', title: 'Growth & Accumulation', text: 'Growth projects retirement savings across three vehicles: taxable accounts, IUL (tax-free accumulation), and FIA (principal protection). The comparison shows the power of tax-advantaged strategies.' },
  { panelId: 'retire', title: 'Retirement Planning', text: 'Retirement models Social Security claiming strategies at ages 62, 67, and 70, plus pension income and portfolio withdrawals. The optimal age maximizes lifetime income.' },
  { panelId: 'tax', title: 'Tax Planning', text: 'Tax Planning shows the current effective rate and models savings from 401(k) contributions, HSA, charitable giving, and business deductions. Every dollar saved here compounds.' },
  { panelId: 'estate', title: 'Estate Planning', text: 'Estate projects the growth of the gross estate, calculates potential estate tax exposure, and shows how annual gifting and ILIT strategies can reduce the taxable estate.' },
  { panelId: 'edu', title: 'Education Planning', text: 'Education calculates the total projected cost per child, factors in 529 plan growth, and identifies the funding gap. Monthly contribution targets help close the gap over time.' },
  { panelId: 'advanced', title: 'Advanced Strategies', text: 'Advanced Strategies covers Premium Financing (leveraged life insurance), ILIT (estate tax reduction), Executive Compensation (162 bonus, SERP, stock options), and Charitable Vehicles (CRT, DAF).' },
  { panelId: 'bizclient', title: 'Business Client', text: 'Business Client Planning addresses Key Person insurance, Buy-Sell agreements, and Group Benefits for business owners. These protect the business and its stakeholders.' },
  { panelId: 'costben', title: 'Cost-Benefit Analysis', text: 'Cost-Benefit shows the total annual premium investment, projected returns across multiple horizons, and the net benefit of the recommended product suite.' },
  { panelId: 'compare', title: 'Strategy Compare', text: 'Strategy Compare lets you load saved scenarios side-by-side, comparing scores, premiums, and key metrics to find the optimal approach for each client.' },
  { panelId: 'summary', title: 'Financial Health Summary', text: 'The Summary provides a holistic scorecard across all planning domains, with pillar scores for Plan, Protect, and Grow. This is your client presentation centerpiece.' },
  { panelId: 'timeline', title: 'Action Plan', text: 'The Action Plan prioritizes recommendations by urgency and impact, providing a clear implementation roadmap with specific next steps for each product.' },
  { panelId: 'refs', title: 'References', text: 'References provides the regulatory citations, industry benchmarks, and academic sources behind every calculation. Use these for compliance documentation and client education.' },
];

/* ═══ SPEED OPTIONS ═══ */
const SPEED_OPTIONS = [
  { label: '0.75x', value: 0.75, ms: 8000 },
  { label: '1x', value: 1, ms: 6000 },
  { label: '1.25x', value: 1.25, ms: 4800 },
  { label: '1.5x', value: 1.5, ms: 4000 },
];

interface CalcNarratorProps {
  onNavigate: (panelId: string) => void;
  activePanel: string;
}

export function CalcNarrator({ onNavigate, activePanel }: CalcNarratorProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [speedIdx, setSpeedIdx] = useState(1); // default 1x
  const [isMuted, setIsMuted] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const synthRef = useRef<SpeechSynthesisUtterance | null>(null);

  const speed = SPEED_OPTIONS[speedIdx];
  const step = NARRATION_SCRIPT[currentStep];

  const stopSpeech = useCallback(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    synthRef.current = null;
  }, []);

  const speak = useCallback((text: string, rate: number) => {
    if (isMuted || typeof window === 'undefined' || !window.speechSynthesis) return;
    stopSpeech();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = rate;
    utterance.pitch = 1;
    utterance.volume = 0.8;
    // Try to use a natural-sounding voice
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(v => v.name.includes('Google') || v.name.includes('Samantha') || v.name.includes('Alex'));
    if (preferred) utterance.voice = preferred;
    synthRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }, [isMuted, stopSpeech]);

  const advanceStep = useCallback(() => {
    setCurrentStep(prev => {
      const next = prev + 1;
      if (next >= NARRATION_SCRIPT.length) {
        setIsPlaying(false);
        stopSpeech();
        return prev;
      }
      onNavigate(NARRATION_SCRIPT[next].panelId);
      return next;
    });
  }, [onNavigate, stopSpeech]);

  // Auto-advance timer
  useEffect(() => {
    if (!isPlaying) {
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }
    // Speak current step
    speak(`${step.title}. ${step.text}`, speed.value);
    timerRef.current = setTimeout(advanceStep, speed.ms);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isPlaying, currentStep, speed, step, speak, advanceStep]);

  const handlePlay = () => {
    if (isPlaying) {
      setIsPlaying(false);
      stopSpeech();
    } else {
      onNavigate(NARRATION_SCRIPT[currentStep].panelId);
      setIsPlaying(true);
    }
  };

  const handleStop = () => {
    setIsPlaying(false);
    setCurrentStep(0);
    stopSpeech();
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      stopSpeech();
      const prev = currentStep - 1;
      setCurrentStep(prev);
      onNavigate(NARRATION_SCRIPT[prev].panelId);
    }
  };

  const handleNext = () => {
    if (currentStep < NARRATION_SCRIPT.length - 1) {
      stopSpeech();
      const next = currentStep + 1;
      setCurrentStep(next);
      onNavigate(NARRATION_SCRIPT[next].panelId);
    }
  };

  const handleSpeedCycle = () => {
    setSpeedIdx(prev => (prev + 1) % SPEED_OPTIONS.length);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopSpeech();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [stopSpeech]);

  return (
    <div className="flex flex-col gap-2">
      {/* Narration Controls */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <Button
          variant={isPlaying ? 'default' : 'outline'}
          size="sm"
          onClick={handlePlay}
          className="text-xs gap-1 h-7"
          aria-label={isPlaying ? 'Pause narration' : 'Start narration'}
        >
          <Play className="w-3 h-3" />
          <span className="hidden sm:inline">{isPlaying ? 'Pause' : 'Walk Me Through'}</span>
        </Button>

        {(isPlaying || currentStep > 0) && (
          <>
            <Button variant="outline" size="sm" onClick={handleStop} className="text-xs gap-1 h-7" aria-label="Stop narration">
              <Square className="w-3 h-3" />
            </Button>
            <Button variant="ghost" size="sm" onClick={handlePrev} disabled={currentStep === 0} className="h-7 w-7 p-0" aria-label="Previous step">
              <ChevronLeft className="w-3.5 h-3.5" />
            </Button>
            <span className="text-[10px] text-muted-foreground tabular-nums min-w-[3rem] text-center">
              {currentStep + 1}/{NARRATION_SCRIPT.length}
            </span>
            <Button variant="ghost" size="sm" onClick={handleNext} disabled={currentStep >= NARRATION_SCRIPT.length - 1} className="h-7 w-7 p-0" aria-label="Next step">
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
            <Button variant="ghost" size="sm" onClick={handleSpeedCycle} className="text-xs h-7 px-2 tabular-nums" aria-label="Change speed">
              {speed.label}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => { setIsMuted(!isMuted); if (!isMuted) stopSpeech(); }} className="h-7 w-7 p-0" aria-label={isMuted ? 'Unmute' : 'Mute'}>
              {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
            </Button>
          </>
        )}
      </div>

      {/* Current narration text */}
      {(isPlaying || currentStep > 0) && (
        <div className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-muted-foreground leading-relaxed animate-in fade-in duration-300">
          <span className="font-semibold text-primary">{step.title}:</span> {step.text}
        </div>
      )}
    </div>
  );
}

export default CalcNarrator;
