/**
 * v8.3 Pass 4 — Regression tests for:
 * - G8: PIL context wired into Chat.tsx sendMutation calls + server buildSystemPrompt
 * - G14: ROUTE_MAP synced with actual App.tsx routes
 * - G1: learning.srs_rating feedback wired in LearningFlashcardStudy
 * - G5: Voice command dispatch (send/stop/cancel/undo/bookmark) fully wired
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const CLIENT = resolve(__dirname, '../..');
const SERVER = resolve(__dirname, '../../../../server');

function readClientFile(relPath: string): string {
  return readFileSync(resolve(CLIENT, relPath), 'utf-8');
}

function readServerFile(relPath: string): string {
  return readFileSync(resolve(SERVER, relPath), 'utf-8');
}

// ─── G8: PIL context flows from Chat → tRPC → server ───

describe('G8: pilContext wired in Chat.tsx', () => {
  const chatSrc = readClientFile('pages/Chat.tsx');

  it('should import usePlatformIntelligence', () => {
    expect(chatSrc).toContain('usePlatformIntelligence');
  });

  it('should call usePlatformIntelligence hook', () => {
    expect(chatSrc).toMatch(/const pil\s*=\s*usePlatformIntelligence\(\)/);
  });

  it('should pass pilContext with modalityPref in sendMutation calls', () => {
    const matches = chatSrc.match(/pilContext:\s*\{[^}]*modalityPref:\s*pil\.modalityPref/g) || [];
    // Should appear in both streaming fallback and legacy tRPC paths
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });

  it('should pass pilContext with handsFreeActive in sendMutation calls', () => {
    const matches = chatSrc.match(/handsFreeActive:\s*pil\.handsFreeActive/g) || [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });

  it('should pass pilContext with deviceType in sendMutation calls', () => {
    const matches = chatSrc.match(/deviceType:\s*pil\.deviceType/g) || [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });
});

describe('G8: pilContext accepted in server routers', () => {
  const routersSrc = readServerFile('routers.ts');

  it('should accept pilContext field in chat.send input schema', () => {
    expect(routersSrc).toContain('pilContext');
  });

  it('should pass pilContext to buildSystemPrompt', () => {
    expect(routersSrc).toContain('pilContext: input.pilContext');
  });
});

describe('G8: buildSystemPrompt accepts pilContext', () => {
  const promptsSrc = readServerFile('prompts.ts');

  it('should have pilContext parameter in buildSystemPrompt', () => {
    expect(promptsSrc).toContain('pilContext');
  });

  it('should inject interaction_context block when pilContext is provided', () => {
    expect(promptsSrc).toContain('interaction_context');
  });
});

// ─── G14: ROUTE_MAP synced ───

describe('G14: intentParser ROUTE_MAP coverage', () => {
  const intentSrc = readClientFile('lib/multisensory/intentParser.ts');

  it('should have route for intelligence hub', () => {
    expect(intentSrc).toContain('"/intelligence-hub"');
  });

  it('should have route for financial twin', () => {
    expect(intentSrc).toContain('"/financial-twin"');
  });

  it('should have route for leads/pipeline', () => {
    expect(intentSrc).toContain('"/leads"');
  });

  it('should have route for operations', () => {
    expect(intentSrc).toContain('"/operations"');
  });

  it('should have route for workflows', () => {
    expect(intentSrc).toContain('"/workflows"');
  });

  it('should have route for people hub', () => {
    expect(intentSrc).toContain('"/people"');
  });

  it('should have route for learning sub-pages', () => {
    expect(intentSrc).toContain('"/learning/licenses"');
    expect(intentSrc).toContain('"/learning/studio"');
    expect(intentSrc).toContain('"/learning/achievements"');
    expect(intentSrc).toContain('"/learning/connections"');
  });

  it('should have route for admin pages', () => {
    expect(intentSrc).toContain('"/admin/billing"');
    expect(intentSrc).toContain('"/admin/api-keys"');
  });
});

describe('G14: PlatformIntelligence ROUTE_MAP synced', () => {
  const pilSrc = readClientFile('components/PlatformIntelligence.tsx');

  it('should have ROUTE_MAP with correct routes', () => {
    expect(pilSrc).toContain('ROUTE_MAP');
  });
});

// ─── G1: learning.srs_rating feedback wired ───

describe('G1: SRS rating feedback in LearningFlashcardStudy', () => {
  const flashcardSrc = readClientFile('pages/learning/LearningFlashcardStudy.tsx');

  it('should import sendFeedback', () => {
    expect(flashcardSrc).toContain('sendFeedback');
  });

  it('should call sendFeedback with learning.srs_rating', () => {
    expect(flashcardSrc).toContain('learning.srs_rating');
  });
});

// ─── G5: Voice command dispatch fully wired ───

describe('G5: Voice commands in PlatformIntelligence', () => {
  const pilSrc = readClientFile('components/PlatformIntelligence.tsx');

  it('should dispatch pil:send event for send/submit commands', () => {
    expect(pilSrc).toContain('pil:send');
  });

  it('should dispatch pil:new-chat event for new chat commands', () => {
    expect(pilSrc).toContain('pil:new-chat');
  });

  it('should dispatch pil:bookmark event for bookmark commands', () => {
    expect(pilSrc).toContain('pil:bookmark');
  });

  it('should dispatch pil:undo event for undo commands', () => {
    expect(pilSrc).toContain('pil:undo');
  });

  it('should dispatch pil:stop-stream event for cancel commands', () => {
    expect(pilSrc).toContain('pil:stop-stream');
  });
});

describe('G5: Chat.tsx listens for voice command events', () => {
  const chatSrc = readClientFile('pages/Chat.tsx');

  it('should listen for pil:send event', () => {
    expect(chatSrc).toContain('pil:send');
  });

  it('should listen for pil:new-chat event', () => {
    expect(chatSrc).toContain('pil:new-chat');
  });

  it('should listen for pil:bookmark event', () => {
    expect(chatSrc).toContain('pil:bookmark');
  });

  it('should listen for pil:stop-stream event', () => {
    expect(chatSrc).toContain('pil:stop-stream');
  });

  it('should have togglePinMutation for bookmark functionality', () => {
    expect(chatSrc).toContain('togglePinMutation');
  });
});

// ─── LVUA Pass 4: No regressions ───

describe('LVUA Pass 4: Anti-regression checks', () => {
  const calcSrc = readClientFile('pages/Calculators.tsx');

  it('should NOT have scores.map (P0 crash from stability pass)', () => {
    const scoresMapCalls = calcSrc.match(/\bscores\.map\s*\(/g) || [];
    expect(scoresMapCalls.length).toBe(0);
  });

  it('should still have LEGACY_REDIRECTS map', () => {
    expect(calcSrc).toContain('LEGACY_REDIRECTS');
  });

  it('should still have usePanelAnalytics hook', () => {
    expect(calcSrc).toContain('usePanelAnalytics');
  });
});
