import { defineConfig } from "vitest/config";
import path from "path";

const templateRoot = path.resolve(import.meta.dirname);

export default defineConfig({
  root: templateRoot,
  resolve: {
    alias: {
      "@": path.resolve(templateRoot, "client", "src"),
      "@shared": path.resolve(templateRoot, "shared"),
      "@assets": path.resolve(templateRoot, "attached_assets"),
    },
  },
  test: {
    environment: "node",
    include: [
      "server/**/*.test.ts",
      "server/**/*.spec.ts",
      "shared/**/*.test.ts",
      "client/src/lib/wealth-engine/**/*.test.ts",
      "client/src/lib/sttSupport.test.ts",
      "client/src/lib/feedbackSpecs.test.ts",
      "client/src/lib/appearanceSettings.test.ts",
      "client/src/lib/liveAnnouncer.test.ts",
      "client/src/lib/earcons.test.ts",
      "client/src/lib/holisticScoring.test.ts",
      "client/src/lib/holisticScoringExtensions.test.ts",
      "client/src/lib/incomeStreams.test.ts",
      "client/src/lib/calculatorExport.test.ts",
      "client/src/hooks/useFocusOnRouteChange.test.ts",
      "client/src/hooks/usePushToTalk.test.ts",
      "client/src/components/CommandPalette.test.ts",
      "client/src/components/ChatGreeting.test.ts",
      "client/src/lib/chatPrefill.test.ts",
      "client/src/components/codeChat/**/*.test.ts",
      "client/src/components/wealth-engine/**/*.test.ts",
      "client/src/pages/learning/lib/**/*.test.ts",
      // Pass 7 (automation): include hook-level client tests
      "client/src/hooks/**/*.test.ts",
      // Hybrid pass 4: planning calculator pure functions
      "client/src/lib/planningCalculations.test.ts",
      // CBL11: calculator-to-chat context bridge
      "client/src/lib/calculatorContext.test.ts",
      "client/src/pages/learning/lib/**/*.test.ts",
      // v7 structural match: Calculators page integration tests
      "client/src/pages/Calculators.test.ts",
      // Pass 139: AdvancedStrategiesHub engine + cascade tests
      "client/src/pages/calculators/advancedHub.test.ts",
      // Pass 154: keyboard shortcuts + compare mode tests
      "client/src/pages/__tests__/calculators-pass154.test.ts",
      // Pass 155: drag-reorder, shortcut modal, compare diff highlights
      "client/src/pages/__tests__/calculators-pass155.test.ts",
      // v8 Pass 1: feedback spec wiring verification
      "client/src/pages/__tests__/feedback-wiring-v8p1.test.ts",
      // v8 Pass 4: CascadeFlowDiagram v2 (6-hub SVG)
      "client/src/pages/__tests__/cascade-flow-v8p4.test.ts",
      // v8 Pass 4: useUndoHistory ring buffer
      "client/src/hooks/__tests__/useUndoHistory.test.ts",
      // v8 Pass 5: session replay timeline, bulk export, panel analytics
      "client/src/pages/__tests__/v8-pass5-features.test.ts",
      // v8.2 Pass 1: PIL gap closure (G21 haptic, G23 earcons, G24 GlobalVoiceFAB)
      "client/src/pages/__tests__/v82-pass1-pil-gaps.test.ts",
      // v8.2 Pass 2: PARITY gap closures (G16, G36, G38, G48, G55)
      "client/src/pages/__tests__/v82-pass2-parity.test.ts",
      // v8.3 Pass 3: G18 focus trap, G20 aria-labels, G27 tooltips, NAV-0006, MOBILE-0008, DATA-0007, G45 zoom
      "client/src/pages/__tests__/v83-pass3-parity.test.ts",
      // v8.3 Pass 3 LVUA: TDZ crash fixes, deep link, Chat a11y, People stats, mobile wrap
      "client/src/pages/__tests__/v83-pass3-lvua.test.ts",
      // v8.3 Stability LVUA: scores.map crash, onboarding persistence, legacy redirects, panel structure
      "client/src/pages/__tests__/v83-stability-lvua.test.ts",
      // v8.3 Pass 4: G8 pilContext, G14 ROUTE_MAP, G1 SRS feedback, G5 voice commands
      "client/src/pages/__tests__/v83-pass4-parity.test.ts",
      // v8.3 Pass 5: MOBILE-0016, G37 aria-required, G44 barge-in, G50 voice onboarding, G28 TTS highlighting
      "client/src/pages/__tests__/v83-pass5-parity.test.ts",
      // v8.3 Pass 6: G29 pause/resume, G30 download audio, G39 focus ring, G43 streaming tick, G1 feedback, G53 shortcuts, G59 Firefox
      "client/src/pages/__tests__/v83-pass6-parity.test.ts",
    ],
  },
});
