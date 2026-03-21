/**
 * Task #44 — Accessibility Engine Service
 * WCAG 2.1 AA compliance checking, screen reader optimization, and accessibility reporting
 */

export interface AccessibilityIssue {
  id: string;
  severity: "critical" | "major" | "minor";
  wcagCriterion: string;
  description: string;
  element?: string;
  suggestion: string;
  automated: boolean;
}

export interface AccessibilityReport {
  score: number; // 0-100
  level: "A" | "AA" | "AAA" | "non-compliant";
  issues: AccessibilityIssue[];
  passedChecks: number;
  totalChecks: number;
  generatedAt: string;
}

const WCAG_CHECKS = [
  { id: "1.1.1", criterion: "Non-text Content", check: "All images have alt text" },
  { id: "1.3.1", criterion: "Info and Relationships", check: "Semantic HTML structure" },
  { id: "1.4.1", criterion: "Use of Color", check: "Color not sole means of conveying info" },
  { id: "1.4.3", criterion: "Contrast (Minimum)", check: "4.5:1 contrast ratio for text" },
  { id: "1.4.4", criterion: "Resize Text", check: "Text resizable to 200% without loss" },
  { id: "2.1.1", criterion: "Keyboard", check: "All functionality keyboard accessible" },
  { id: "2.1.2", criterion: "No Keyboard Trap", check: "Focus can be moved away" },
  { id: "2.4.1", criterion: "Bypass Blocks", check: "Skip navigation link present" },
  { id: "2.4.2", criterion: "Page Titled", check: "Pages have descriptive titles" },
  { id: "2.4.3", criterion: "Focus Order", check: "Logical focus order" },
  { id: "2.4.4", criterion: "Link Purpose", check: "Link purpose clear from text" },
  { id: "2.4.7", criterion: "Focus Visible", check: "Focus indicator visible" },
  { id: "3.1.1", criterion: "Language of Page", check: "Page language specified" },
  { id: "3.2.1", criterion: "On Focus", check: "No unexpected context change on focus" },
  { id: "3.3.1", criterion: "Error Identification", check: "Errors clearly identified" },
  { id: "3.3.2", criterion: "Labels or Instructions", check: "Form inputs have labels" },
  { id: "4.1.1", criterion: "Parsing", check: "Valid HTML" },
  { id: "4.1.2", criterion: "Name, Role, Value", check: "ARIA attributes correct" },
];

export function getAccessibilityChecklist(): typeof WCAG_CHECKS {
  return [...WCAG_CHECKS];
}

export function generateReport(passedIds: string[]): AccessibilityReport {
  const issues: AccessibilityIssue[] = [];
  let passed = 0;

  for (const check of WCAG_CHECKS) {
    if (passedIds.includes(check.id)) {
      passed++;
    } else {
      issues.push({
        id: check.id,
        severity: ["1.1.1", "2.1.1", "1.4.3", "4.1.2"].includes(check.id) ? "critical" : "major",
        wcagCriterion: `${check.id} ${check.criterion}`,
        description: `Failed: ${check.check}`,
        suggestion: `Review and fix ${check.criterion} compliance`,
        automated: true,
      });
    }
  }

  const score = Math.round((passed / WCAG_CHECKS.length) * 100);
  const level = score >= 95 ? "AAA" : score >= 80 ? "AA" : score >= 60 ? "A" : "non-compliant";

  return {
    score,
    level,
    issues,
    passedChecks: passed,
    totalChecks: WCAG_CHECKS.length,
    generatedAt: new Date().toISOString(),
  };
}

/** Get screen reader optimization hints for a page */
export function getScreenReaderHints(pageName: string): string[] {
  const common = [
    "Use semantic HTML elements (nav, main, aside, footer)",
    "Add aria-label to interactive elements without visible text",
    "Use aria-live regions for dynamic content updates",
    "Ensure all form inputs have associated labels",
    "Add role='alert' for error messages",
  ];

  const pageSpecific: Record<string, string[]> = {
    chat: [
      "Mark chat messages with role='log' and aria-live='polite'",
      "Add aria-label to message input describing its purpose",
      "Announce new messages with aria-live region",
      "Add keyboard shortcuts for common actions (send, new line)",
    ],
    dashboard: [
      "Use aria-describedby for chart descriptions",
      "Provide text alternatives for data visualizations",
      "Use table headers for data grids",
    ],
    calculator: [
      "Label all input fields with units and expected format",
      "Announce calculation results with aria-live",
      "Group related inputs with fieldset and legend",
    ],
  };

  return [...common, ...(pageSpecific[pageName] ?? [])];
}

export function getContrastRatio(fg: string, bg: string): number {
  // Simplified contrast ratio calculation
  const getLuminance = (hex: string) => {
    const rgb = hex.replace("#", "").match(/.{2}/g)?.map(h => {
      const v = parseInt(h, 16) / 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    }) ?? [0, 0, 0];
    return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
  };

  const l1 = getLuminance(fg);
  const l2 = getLuminance(bg);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}
