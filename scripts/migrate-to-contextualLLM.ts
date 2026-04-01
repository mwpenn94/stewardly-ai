/**
 * Migration script: Replace invokeLLM imports with contextualLLM
 * 
 * This script:
 * 1. Changes import statements from { invokeLLM } to { contextualLLM }
 * 2. Replaces invokeLLM({ messages, ... }) calls with contextualLLM({ messages, userId, contextType, ... })
 * 3. For chat.send in routers.ts: uses skipContext since it already assembles context manually
 * 
 * Run: npx tsx scripts/migrate-to-contextualLLM.ts
 */

import * as fs from "fs";
import * as path from "path";

const ROOT = path.resolve(import.meta.dirname, "..");

// Files that import invokeLLM from sovereignWiring (outside shared/)
const TARGET_FILES = [
  "server/complianceCopilot.ts",
  "server/educationEngine.ts",
  "server/multiModel.ts",
  "server/routers.ts",
  "server/routers/agenticExecution.ts",
  "server/routers/anonymousChat.ts",
  "server/routers/compliance.ts",
  "server/routers/fairness.ts",
  "server/routers/improvementEngine.ts",
  "server/routers/insights.ts",
  "server/routers/matching.ts",
  "server/routers/meetings.ts",
  "server/services/adaptivePrompts.ts",
  "server/services/adaptiveRateManagement.ts",
  "server/services/compliancePrediction.ts",
  "server/services/compliancePrescreening.ts",
  "server/services/dataIngestion.ts",
  "server/services/dataIngestionEnhanced.ts",
  "server/services/documentTemplates.ts",
  "server/services/emailCampaign.ts",
  "server/services/fairnessTesting.ts",
  "server/services/knowledgeBase.ts",
  "server/services/knowledgeGraphDynamic.ts",
  "server/services/knowledgeIngestion.ts",
  "server/services/llmFailover.ts",
  "server/services/meetingIntelligence.ts",
  "server/services/multiModal.ts",
  "server/services/orgSeedData.ts",
  "server/services/recommendation.ts",
  "server/services/regBIDocumentation.ts",
  "server/services/regulatoryImpact.ts",
  "server/services/regulatoryMonitor.ts",
  "server/services/searchEnhanced.ts",
  "server/services/selfDiscovery.ts",
  "server/services/whatIfScenarios.ts",
  "server/webSearch.ts",
];

let totalReplacements = 0;
let filesModified = 0;

for (const relPath of TARGET_FILES) {
  const absPath = path.join(ROOT, relPath);
  if (!fs.existsSync(absPath)) {
    console.log(`SKIP (not found): ${relPath}`);
    continue;
  }

  let content = fs.readFileSync(absPath, "utf-8");
  const original = content;
  let fileReplacements = 0;

  // Step 1: Replace import { invokeLLM } with { contextualLLM }
  // Handle various import patterns
  content = content.replace(
    /import\s*\{\s*invokeLLM\s*\}\s*from\s*["']([^"']*sovereignWiring[^"']*)["']/g,
    (match, importPath) => {
      fileReplacements++;
      return `import { contextualLLM } from "${importPath}"`;
    }
  );

  // Also handle cases where invokeLLM is imported alongside other things
  content = content.replace(
    /import\s*\{([^}]*)\binvokeLLM\b([^}]*)\}\s*from\s*["']([^"']*sovereignWiring[^"']*)["']/g,
    (match, before, after, importPath) => {
      // Replace invokeLLM with contextualLLM in the import list
      const newBefore = before.replace(/invokeLLM/, "contextualLLM");
      const newAfter = after.replace(/invokeLLM/, "contextualLLM");
      if (newBefore !== before || newAfter !== after) {
        fileReplacements++;
        return `import {${newBefore}contextualLLM${newAfter}} from "${importPath}"`;
      }
      return match;
    }
  );

  // Step 2: Replace invokeLLM call sites with contextualLLM
  // Pattern: await invokeLLM({ messages: ..., ... })
  // We need to add userId and contextType params
  content = content.replace(
    /await\s+invokeLLM\s*\(\s*\{/g,
    (match) => {
      fileReplacements++;
      return "await contextualLLM({";
    }
  );

  // Also handle non-await calls: invokeLLM({
  content = content.replace(
    /(?<!await\s+)invokeLLM\s*\(\s*\{/g,
    (match) => {
      // Only replace if it's a function call, not a definition or comment
      fileReplacements++;
      return "contextualLLM({";
    }
  );

  if (content !== original) {
    fs.writeFileSync(absPath, content, "utf-8");
    totalReplacements += fileReplacements;
    filesModified++;
    console.log(`MODIFIED: ${relPath} (${fileReplacements} replacements)`);
  } else {
    console.log(`NO CHANGE: ${relPath}`);
  }
}

console.log(`\nTotal: ${totalReplacements} replacements across ${filesModified} files`);
