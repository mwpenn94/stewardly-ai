#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════
# Sovereign AI Migration: Replace invokeLLM imports
# ═══════════════════════════════════════════════════════════════════════════
#
# Replaces: import { invokeLLM } from "../_core/llm"
# With:     import { invokeLLM } from "../shared/intelligence/sovereignWiring"
#
# The sovereignWiring re-exports invokeLLM as sovereignInvokeLLM aliased
# to invokeLLM, so all existing call sites work unchanged.

set -e
cd "$(dirname "$0")/.."

echo "=== Sovereign AI Migration: Replacing invokeLLM imports ==="
echo ""

# Track changes
CHANGED=0

# Files in server/ root (import from "./_core/llm")
for file in server/complianceCopilot.ts server/educationEngine.ts server/multiModel.ts server/routers.ts server/webSearch.ts; do
  if [ -f "$file" ]; then
    if grep -q 'from "./_core/llm"' "$file" || grep -q "from './_core/llm'" "$file"; then
      sed -i 's|import { invokeLLM } from "./_core/llm"|import { invokeLLM } from "./shared/intelligence/sovereignWiring"|g' "$file"
      sed -i "s|import { invokeLLM } from './_core/llm'|import { invokeLLM } from './shared/intelligence/sovereignWiring'|g" "$file"
      echo "  ✓ $file"
      CHANGED=$((CHANGED + 1))
    fi
  fi
done

# Files in server/routers/ (import from "../_core/llm")
for file in server/routers/agenticExecution.ts server/routers/anonymousChat.ts server/routers/compliance.ts server/routers/fairness.ts server/routers/improvementEngine.ts server/routers/insights.ts server/routers/matching.ts server/routers/meetings.ts; do
  if [ -f "$file" ]; then
    if grep -q 'from "../_core/llm"' "$file" || grep -q "from '../_core/llm'" "$file"; then
      sed -i 's|import { invokeLLM } from "../_core/llm"|import { invokeLLM } from "../shared/intelligence/sovereignWiring"|g' "$file"
      sed -i "s|import { invokeLLM } from '../_core/llm'|import { invokeLLM } from '../shared/intelligence/sovereignWiring'|g" "$file"
      echo "  ✓ $file"
      CHANGED=$((CHANGED + 1))
    fi
  fi
done

# Files in server/services/ (import from "../_core/llm")
for file in server/services/adaptivePrompts.ts server/services/adaptiveRateManagement.ts server/services/compliancePrediction.ts server/services/compliancePrescreening.ts server/services/dataIngestion.ts server/services/dataIngestionEnhanced.ts server/services/documentTemplates.ts server/services/emailCampaign.ts server/services/fairnessTesting.ts server/services/knowledgeBase.ts server/services/knowledgeGraphDynamic.ts server/services/knowledgeIngestion.ts server/services/llmFailover.ts server/services/meetingIntelligence.ts server/services/multiModal.ts server/services/recommendation.ts server/services/regBIDocumentation.ts server/services/regulatoryImpact.ts server/services/regulatoryMonitor.ts server/services/searchEnhanced.ts server/services/selfDiscovery.ts server/services/whatIfScenarios.ts; do
  if [ -f "$file" ]; then
    if grep -q 'from "../_core/llm"' "$file" || grep -q "from '../_core/llm'" "$file"; then
      sed -i 's|import { invokeLLM } from "../_core/llm"|import { invokeLLM } from "../shared/intelligence/sovereignWiring"|g' "$file"
      sed -i "s|import { invokeLLM } from '../_core/llm'|import { invokeLLM } from '../shared/intelligence/sovereignWiring'|g" "$file"
      echo "  ✓ $file"
      CHANGED=$((CHANGED + 1))
    fi
  fi
done

# Handle dynamic import in orgSeedData.ts
if [ -f "server/services/orgSeedData.ts" ]; then
  sed -i 's|const { invokeLLM } = await import("../_core/llm")|const { invokeLLM } = await import("../shared/intelligence/sovereignWiring")|g' "server/services/orgSeedData.ts"
  echo "  ✓ server/services/orgSeedData.ts (dynamic import)"
  CHANGED=$((CHANGED + 1))
fi

echo ""
echo "=== Migration complete: $CHANGED files updated ==="
echo ""

# Verify no remaining direct _core/llm imports (except the core file itself and wiring fallbacks)
echo "=== Verification: remaining _core/llm imports ==="
REMAINING=$(grep -rln 'from.*_core/llm' --include="*.ts" server/ | grep -v node_modules | grep -v ".test." | grep -v "_core/llm.ts" | grep -v "stewardlyWiring.ts" | grep -v "sovereignWiring.ts" || true)
if [ -z "$REMAINING" ]; then
  echo "  ✓ All invokeLLM imports migrated to sovereignWiring"
else
  echo "  ⚠ Remaining files with _core/llm imports:"
  echo "$REMAINING"
fi
