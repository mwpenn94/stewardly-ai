/**
 * n8n Workflow Template Definitions
 * 
 * These templates define automation workflows that can be exported to n8n
 * or executed internally via the platform's scheduler. Each template
 * represents a common financial services automation pattern.
 */

export interface N8nWorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: "verification" | "referral" | "compliance" | "enrichment" | "crm";
  trigger: {
    type: "webhook" | "schedule" | "event";
    config: Record<string, unknown>;
  };
  steps: Array<{
    id: string;
    name: string;
    type: string;
    config: Record<string, unknown>;
    onSuccess?: string;
    onFailure?: string;
  }>;
  variables: Array<{
    key: string;
    description: string;
    required: boolean;
    defaultValue?: string;
  }>;
}

// ─── Auto-Verify Professional Credentials ───────────────────────────────
export const autoVerifyWorkflow: N8nWorkflowTemplate = {
  id: "auto-verify-credentials",
  name: "Auto-Verify Professional Credentials",
  description: "Automatically verifies a professional's credentials across all applicable registries when they join the platform or update their profile.",
  category: "verification",
  trigger: {
    type: "event",
    config: {
      event: "professional.created",
      altEvent: "professional.updated",
    },
  },
  steps: [
    {
      id: "extract-info",
      name: "Extract Professional Info",
      type: "function",
      config: {
        description: "Parse professional type, license numbers, and state from profile",
        fields: ["professionalType", "licenseNumber", "crdNumber", "state", "email"],
      },
      onSuccess: "route-by-type",
    },
    {
      id: "route-by-type",
      name: "Route by Professional Type",
      type: "switch",
      config: {
        field: "professionalType",
        routes: {
          "financial_advisor": ["verify-sec-iapd", "verify-finra"],
          "cfp": ["verify-cfp-board"],
          "cpa": ["verify-nasba"],
          "mortgage_officer": ["verify-nmls"],
          "attorney": ["verify-state-bar"],
          "insurance_agent": ["verify-nipr"],
          "business_broker": ["verify-ibba"],
        },
      },
    },
    {
      id: "verify-sec-iapd",
      name: "SEC IAPD Lookup",
      type: "http",
      config: {
        url: "https://api.sec.gov/cgi-bin/browse-edgar",
        method: "GET",
        params: { action: "getcompany", type: "IA", output: "atom" },
        timeout: 15000,
      },
      onSuccess: "save-result",
      onFailure: "log-failure",
    },
    {
      id: "verify-finra",
      name: "FINRA BrokerCheck Lookup",
      type: "http",
      config: {
        url: "https://api.brokercheck.finra.org/search/individual",
        method: "GET",
        timeout: 15000,
      },
      onSuccess: "save-result",
      onFailure: "log-failure",
    },
    {
      id: "verify-cfp-board",
      name: "CFP Board Verification",
      type: "http",
      config: {
        url: "https://www.cfp.net/verify-a-cfp-professional/results",
        method: "GET",
        timeout: 15000,
      },
      onSuccess: "save-result",
      onFailure: "log-failure",
    },
    {
      id: "verify-nasba",
      name: "NASBA CPAverify",
      type: "http",
      config: {
        url: "https://cpaverify.org/api/search",
        method: "GET",
        timeout: 15000,
      },
      onSuccess: "save-result",
      onFailure: "log-failure",
    },
    {
      id: "verify-nmls",
      name: "NMLS Consumer Access",
      type: "http",
      config: {
        url: "https://www.nmlsconsumeraccess.org/api/search",
        method: "GET",
        timeout: 15000,
      },
      onSuccess: "save-result",
      onFailure: "log-failure",
    },
    {
      id: "verify-state-bar",
      name: "State Bar Lookup",
      type: "http",
      config: {
        url: "dynamic://state-bar-api",
        method: "GET",
        timeout: 15000,
      },
      onSuccess: "save-result",
      onFailure: "log-failure",
    },
    {
      id: "verify-nipr",
      name: "NIPR PDB Lookup",
      type: "http",
      config: {
        url: "https://pdb-xml.nipr.com/pdb-xml-svc.wsdl",
        method: "POST",
        requiresSubscription: true,
      },
      onSuccess: "save-result",
      onFailure: "log-failure",
    },
    {
      id: "verify-ibba",
      name: "IBBA Member Verification",
      type: "http",
      config: {
        url: "https://www.ibba.org/find-a-business-broker",
        method: "GET",
        timeout: 15000,
      },
      onSuccess: "save-result",
      onFailure: "log-failure",
    },
    {
      id: "save-result",
      name: "Save Verification Result",
      type: "function",
      config: {
        action: "saveVerificationResult",
        description: "Store verification result in professional_verifications table",
      },
      onSuccess: "generate-badges",
    },
    {
      id: "generate-badges",
      name: "Generate Verification Badges",
      type: "function",
      config: {
        action: "generateBadges",
        description: "Create or update verification badges based on results",
      },
      onSuccess: "notify-professional",
    },
    {
      id: "notify-professional",
      name: "Notify Professional",
      type: "notification",
      config: {
        channel: "in-app",
        template: "verification-complete",
        fallback: "email",
      },
    },
    {
      id: "log-failure",
      name: "Log Verification Failure",
      type: "function",
      config: {
        action: "logFailure",
        description: "Record failed verification attempt for retry",
        retryAfter: 86400000,
      },
    },
  ],
  variables: [
    { key: "RETRY_MAX", description: "Maximum retry attempts for failed verifications", required: false, defaultValue: "3" },
    { key: "NOTIFY_ON_FAILURE", description: "Send notification on verification failure", required: false, defaultValue: "true" },
    { key: "AUTO_BADGE", description: "Automatically generate badges on successful verification", required: false, defaultValue: "true" },
  ],
};

// ─── COI Referral Network Workflow ──────────────────────────────────────
export const coiReferralWorkflow: N8nWorkflowTemplate = {
  id: "coi-referral-network",
  name: "COI Referral Network Automation",
  description: "Automates the Center of Influence referral workflow: identifies potential COI matches, facilitates introductions, tracks referral outcomes, and maintains relationship scores.",
  category: "referral",
  trigger: {
    type: "event",
    config: {
      event: "coi.match_identified",
      altTrigger: "schedule",
      schedule: "0 9 * * 1", // Monday 9am
    },
  },
  steps: [
    {
      id: "identify-matches",
      name: "Identify COI Matches",
      type: "function",
      config: {
        action: "findCOIMatches",
        description: "Analyze professional profiles to find complementary COI relationships",
        criteria: [
          "Same geographic area",
          "Complementary professional types (FA + CPA, FA + Attorney)",
          "Similar client demographics",
          "Mutual connections",
        ],
      },
      onSuccess: "score-matches",
    },
    {
      id: "score-matches",
      name: "Score Match Quality",
      type: "function",
      config: {
        action: "scoreMatches",
        description: "Calculate match quality score based on overlap, verification status, and activity",
        factors: {
          geographicProximity: 0.25,
          complementaryServices: 0.30,
          verificationStatus: 0.20,
          activityLevel: 0.15,
          mutualConnections: 0.10,
        },
      },
      onSuccess: "filter-threshold",
    },
    {
      id: "filter-threshold",
      name: "Filter by Quality Threshold",
      type: "filter",
      config: {
        field: "matchScore",
        operator: ">=",
        value: 0.65,
      },
      onSuccess: "check-existing",
    },
    {
      id: "check-existing",
      name: "Check Existing Relationships",
      type: "function",
      config: {
        action: "checkExistingCOI",
        description: "Filter out already-connected COI pairs",
      },
      onSuccess: "enrich-profiles",
    },
    {
      id: "enrich-profiles",
      name: "Enrich Professional Profiles",
      type: "function",
      config: {
        action: "enrichProfiles",
        description: "Pull additional data from enrichment waterfall for match context",
      },
      onSuccess: "generate-introduction",
    },
    {
      id: "generate-introduction",
      name: "Generate Introduction Message",
      type: "llm",
      config: {
        action: "generateIntroduction",
        description: "Use AI to craft personalized introduction message between COI matches",
        template: "coi-introduction",
        tone: "professional",
        maxLength: 500,
      },
      onSuccess: "send-introduction",
    },
    {
      id: "send-introduction",
      name: "Send Introduction",
      type: "notification",
      config: {
        channel: "in-app",
        template: "coi-introduction",
        requiresConsent: true,
        fallback: "email",
      },
      onSuccess: "track-referral",
    },
    {
      id: "track-referral",
      name: "Track Referral Outcome",
      type: "function",
      config: {
        action: "createReferralTracking",
        description: "Create tracking record for the referral with 30-day follow-up",
        followUpDays: 30,
      },
      onSuccess: "update-scores",
    },
    {
      id: "update-scores",
      name: "Update Relationship Scores",
      type: "function",
      config: {
        action: "updateRelationshipScores",
        description: "Adjust COI relationship scores based on referral activity",
      },
    },
  ],
  variables: [
    { key: "MATCH_THRESHOLD", description: "Minimum match score to trigger introduction (0-1)", required: false, defaultValue: "0.65" },
    { key: "MAX_INTROS_PER_WEEK", description: "Maximum introductions per professional per week", required: false, defaultValue: "3" },
    { key: "FOLLOW_UP_DAYS", description: "Days before follow-up on referral outcome", required: false, defaultValue: "30" },
    { key: "REQUIRE_CONSENT", description: "Require professional consent before sending introductions", required: false, defaultValue: "true" },
  ],
};

// ─── Compliance Monitoring Workflow ─────────────────────────────────────
export const complianceMonitoringWorkflow: N8nWorkflowTemplate = {
  id: "compliance-monitoring",
  name: "Compliance Monitoring & Re-verification",
  description: "Periodically re-verifies professional credentials and monitors for regulatory actions, license expirations, and compliance changes.",
  category: "compliance",
  trigger: {
    type: "schedule",
    config: {
      cron: "0 0 6 * * 1", // Every Monday at 6am
    },
  },
  steps: [
    {
      id: "find-expiring",
      name: "Find Expiring Verifications",
      type: "function",
      config: {
        action: "findExpiringVerifications",
        description: "Query verifications expiring within 30 days",
        lookAheadDays: 30,
      },
      onSuccess: "batch-reverify",
    },
    {
      id: "batch-reverify",
      name: "Batch Re-verification",
      type: "loop",
      config: {
        action: "reverifyProfessional",
        description: "Re-run verification for each expiring record",
        batchSize: 50,
        delayBetweenMs: 2000,
      },
      onSuccess: "check-disclosures",
    },
    {
      id: "check-disclosures",
      name: "Check for New Disclosures",
      type: "function",
      config: {
        action: "checkNewDisclosures",
        description: "Scan for new regulatory actions, complaints, or disclosures",
      },
      onSuccess: "flag-issues",
    },
    {
      id: "flag-issues",
      name: "Flag Compliance Issues",
      type: "function",
      config: {
        action: "flagComplianceIssues",
        description: "Create alerts for any new disclosures or failed re-verifications",
        severity: { newDisclosure: "high", expiredLicense: "critical", failedReverify: "medium" },
      },
      onSuccess: "notify-admin",
    },
    {
      id: "notify-admin",
      name: "Notify Admin",
      type: "notification",
      config: {
        channel: "in-app",
        template: "compliance-alert",
        recipients: ["admin"],
      },
    },
  ],
  variables: [
    { key: "LOOK_AHEAD_DAYS", description: "Days before expiration to trigger re-verification", required: false, defaultValue: "30" },
    { key: "BATCH_SIZE", description: "Number of verifications to process per batch", required: false, defaultValue: "50" },
  ],
};

// ─── Template Registry ──────────────────────────────────────────────────
export const workflowTemplates: N8nWorkflowTemplate[] = [
  autoVerifyWorkflow,
  coiReferralWorkflow,
  complianceMonitoringWorkflow,
];

export function getWorkflowTemplate(id: string): N8nWorkflowTemplate | undefined {
  return workflowTemplates.find(t => t.id === id);
}

export function getWorkflowsByCategory(category: N8nWorkflowTemplate["category"]): N8nWorkflowTemplate[] {
  return workflowTemplates.filter(t => t.category === category);
}

/**
 * Export workflow as n8n-compatible JSON
 * This generates a simplified n8n workflow definition that can be imported
 * into an n8n instance for execution.
 */
export function exportAsN8nWorkflow(template: N8nWorkflowTemplate): Record<string, unknown> {
  return {
    name: template.name,
    nodes: template.steps.map((step, index) => ({
      parameters: step.config,
      name: step.name,
      type: mapStepTypeToN8nNode(step.type),
      typeVersion: 1,
      position: [250, 300 + index * 200],
    })),
    connections: buildN8nConnections(template.steps),
    settings: {
      executionOrder: "v1",
    },
    meta: {
      templateId: template.id,
      description: template.description,
      category: template.category,
    },
  };
}

function mapStepTypeToN8nNode(type: string): string {
  const map: Record<string, string> = {
    http: "n8n-nodes-base.httpRequest",
    function: "n8n-nodes-base.function",
    filter: "n8n-nodes-base.filter",
    switch: "n8n-nodes-base.switch",
    loop: "n8n-nodes-base.splitInBatches",
    notification: "n8n-nodes-base.emailSend",
    llm: "n8n-nodes-base.openAi",
  };
  return map[type] || "n8n-nodes-base.noOp";
}

function buildN8nConnections(steps: N8nWorkflowTemplate["steps"]): Record<string, unknown> {
  const connections: Record<string, unknown> = {};
  for (const step of steps) {
    if (step.onSuccess) {
      const target = steps.find(s => s.id === step.onSuccess);
      if (target) {
        connections[step.name] = {
          main: [[{ node: target.name, type: "main", index: 0 }]],
        };
      }
    }
  }
  return connections;
}
