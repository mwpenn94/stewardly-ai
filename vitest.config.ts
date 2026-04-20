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
    ],
  },
});
