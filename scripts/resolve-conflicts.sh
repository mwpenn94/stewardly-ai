#!/bin/bash
# Resolve merge conflicts by keeping our (HEAD/Sovereign) version
# For import-only conflicts, this keeps sovereignWiring imports over stewardlyWiring

set -e

# Simple 1-conflict files: just keep ours (HEAD)
SIMPLE_FILES=(
  "server/complianceCopilot.ts"
  "server/db.ts"
  "server/educationEngine.ts"
  "server/memoryEngine.ts"
  "server/multiModel.ts"
  "server/routers/agenticExecution.ts"
  "server/routers/anonymousChat.ts"
  "server/routers/fairness.ts"
  "server/routers/matching.ts"
  "server/routers/meetings.ts"
  "server/services/adaptivePrompts.ts"
  "server/services/adaptiveRateManagement.ts"
  "server/services/compliancePrediction.ts"
  "server/services/compliancePrescreening.ts"
  "server/services/dataIngestion.ts"
  "server/services/dataIngestionEnhanced.ts"
  "server/services/deepContextAssembler.ts"
  "server/services/documentTemplates.ts"
  "server/services/emailCampaign.ts"
  "server/services/fairnessTesting.ts"
  "server/services/knowledgeBase.ts"
  "server/services/knowledgeGraphDynamic.ts"
  "server/services/knowledgeIngestion.ts"
  "server/services/llmFailover.ts"
  "server/services/meetingIntelligence.ts"
  "server/services/multiModal.ts"
  "server/services/recommendation.ts"
  "server/services/regBIDocumentation.ts"
  "server/services/regulatoryImpact.ts"
  "server/services/regulatoryMonitor.ts"
  "server/services/searchEnhanced.ts"
  "server/services/selfDiscovery.ts"
  "server/services/whatIfScenarios.ts"
  "server/webSearch.ts"
)

for f in "${SIMPLE_FILES[@]}"; do
  if [ -f "$f" ]; then
    # Use sed to resolve conflicts: keep HEAD (ours), remove theirs
    sed -i '/^<<<<<<< HEAD$/,/^>>>>>>> origin\/main$/{ /^<<<<<<< HEAD$/d; /^=======$/,/^>>>>>>> origin\/main$/d; }' "$f"
    # Remove any duplicate contextualLLM imports (from our migration script bug)
    # Keep the sovereignWiring import, remove the ./contextualLLM one
    if grep -q 'from "./contextualLLM"' "$f" && grep -q 'sovereignWiring' "$f"; then
      sed -i '/import.*contextualLLM.*from "\.\/contextualLLM"/d' "$f"
    fi
    if grep -q 'from "../services/contextualLLM"' "$f" && grep -q 'sovereignWiring' "$f"; then
      sed -i '/import.*contextualLLM.*from "\.\.\/services\/contextualLLM"/d' "$f"
    fi
    echo "Resolved: $f"
  fi
done

echo ""
echo "Simple files resolved. Complex files need manual resolution:"
echo "  - drizzle/schema.ts (1 conflict)"
echo "  - package-lock.json (42 conflicts)"
echo "  - recursive_optimization_toolkit.cjs (3 conflicts)"
echo "  - server/routers.ts (12 conflicts)"
echo "  - server/routers/compliance.ts (3 conflicts)"
echo "  - server/routers/improvementEngine.ts (2 conflicts)"
echo "  - server/routers/insights.ts (2 conflicts)"
echo "  - server/services/contextualLLM.ts (2 conflicts)"
echo "  - server/services/graduatedAutonomy.ts (4 conflicts)"
echo "  - server/services/orgSeedData.ts (2 conflicts)"
echo "  - server/shared/config/aiConfigResolver.ts (2 conflicts)"
echo "  - server/shared/config/aiLayersRouter.ts (2 conflicts)"
echo "  - server/shared/intelligence/types.ts (2 conflicts)"
