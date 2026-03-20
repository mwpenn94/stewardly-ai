/**
 * Communications Engine — Template-based client communication system
 * Part F: Operational Tools
 *
 * No API keys needed. Generates communication drafts from templates.
 */

export type CommChannel = "email" | "sms" | "letter" | "portal_message";
export type CommCategory = "review_reminder" | "market_update" | "birthday" | "life_event" | "onboarding" | "compliance" | "general" | "referral_thank_you" | "annual_summary";

export interface CommTemplate {
  id: string;
  name: string;
  category: CommCategory;
  channel: CommChannel;
  subject?: string;
  body: string;
  variables: string[]; // Placeholders like {{clientName}}, {{advisorName}}
}

export interface CommInput {
  templateId: string;
  variables: Record<string, string>;
  channel?: CommChannel;
  scheduledAt?: string;
}

export interface CommDraft {
  subject: string;
  body: string;
  channel: CommChannel;
  category: CommCategory;
  estimatedReadTime: string;
  complianceFlags: string[];
}

// Built-in templates
const TEMPLATES: CommTemplate[] = [
  {
    id: "review_reminder_email",
    name: "Review Meeting Reminder",
    category: "review_reminder",
    channel: "email",
    subject: "Your Upcoming Financial Review — {{meetingDate}}",
    body: `Dear {{clientName}},

I hope this message finds you well. This is a friendly reminder about your upcoming financial review scheduled for {{meetingDate}} at {{meetingTime}}.

During our meeting, we'll review:
• Your current portfolio performance and allocation
• Progress toward your financial goals
• Any changes in your personal or financial situation
• Tax planning opportunities for the remainder of the year

To make the most of our time together, please gather:
- Recent pay stubs or income changes
- Any new account statements
- Questions or concerns you'd like to discuss

Please confirm your attendance or let me know if you need to reschedule.

Looking forward to our conversation.

Best regards,
{{advisorName}}
{{firmName}}`,
    variables: ["clientName", "meetingDate", "meetingTime", "advisorName", "firmName"],
  },
  {
    id: "market_update_email",
    name: "Market Update",
    category: "market_update",
    channel: "email",
    subject: "Market Update: {{updateTitle}}",
    body: `Dear {{clientName}},

I wanted to share a brief update on recent market developments and what they mean for your portfolio.

{{marketSummary}}

What This Means for You:
{{clientImpact}}

Our Approach:
{{advisorAction}}

As always, your financial plan is designed to weather market fluctuations. If you have any questions or concerns, please don't hesitate to reach out.

Best regards,
{{advisorName}}`,
    variables: ["clientName", "updateTitle", "marketSummary", "clientImpact", "advisorAction", "advisorName"],
  },
  {
    id: "birthday_email",
    name: "Birthday Greeting",
    category: "birthday",
    channel: "email",
    subject: "Happy Birthday, {{clientName}}! 🎂",
    body: `Dear {{clientName}},

Wishing you a wonderful birthday and a fantastic year ahead!

As you celebrate another year, it's also a great time to review any age-related financial milestones:
{{ageSpecificNotes}}

Enjoy your special day!

Warm regards,
{{advisorName}}`,
    variables: ["clientName", "ageSpecificNotes", "advisorName"],
  },
  {
    id: "onboarding_welcome",
    name: "New Client Welcome",
    category: "onboarding",
    channel: "email",
    subject: "Welcome to {{firmName}} — Getting Started",
    body: `Dear {{clientName}},

Welcome to {{firmName}}! We're thrilled to have you as a client and look forward to helping you achieve your financial goals.

Here's what to expect in the coming weeks:

1. Discovery Meeting ({{discoveryDate}})
   We'll discuss your goals, risk tolerance, and current financial picture.

2. Financial Plan Delivery
   Within 2-3 weeks, you'll receive a comprehensive financial plan.

3. Implementation
   We'll begin implementing your personalized strategy.

To get started, please:
• Complete the client questionnaire at {{portalLink}}
• Upload any relevant financial documents
• Review and sign the advisory agreement

If you have any questions, I'm just a phone call or email away.

Welcome aboard!

{{advisorName}}
{{advisorTitle}}
{{firmName}}`,
    variables: ["clientName", "firmName", "discoveryDate", "portalLink", "advisorName", "advisorTitle"],
  },
  {
    id: "annual_summary_email",
    name: "Annual Summary",
    category: "annual_summary",
    channel: "email",
    subject: "Your {{year}} Financial Year in Review",
    body: `Dear {{clientName}},

As {{year}} comes to a close, I wanted to share a summary of your financial progress this year.

Portfolio Performance:
• Starting Value: {{startValue}}
• Ending Value: {{endValue}}
• Return: {{returnPct}}
• Benchmark: {{benchmarkPct}}

Key Accomplishments:
{{accomplishments}}

Looking Ahead to {{nextYear}}:
{{outlook}}

Thank you for your continued trust. I look forward to another successful year together.

Best regards,
{{advisorName}}`,
    variables: ["clientName", "year", "nextYear", "startValue", "endValue", "returnPct", "benchmarkPct", "accomplishments", "outlook", "advisorName"],
  },
  {
    id: "referral_thank_you",
    name: "Referral Thank You",
    category: "referral_thank_you",
    channel: "email",
    subject: "Thank You for the Referral!",
    body: `Dear {{clientName}},

Thank you so much for referring {{referralName}} to us. Your confidence in our services means the world to us.

We've reached out to {{referralName}} and look forward to helping them with their financial needs.

As a token of our appreciation, {{referralBenefit}}.

Thank you again for thinking of us!

Warm regards,
{{advisorName}}`,
    variables: ["clientName", "referralName", "referralBenefit", "advisorName"],
  },
];

export function getTemplates(category?: CommCategory): CommTemplate[] {
  if (category) return TEMPLATES.filter(t => t.category === category);
  return TEMPLATES;
}

export function getTemplate(id: string): CommTemplate | undefined {
  return TEMPLATES.find(t => t.id === id);
}

export function generateDraft(input: CommInput): CommDraft | null {
  const template = getTemplate(input.templateId);
  if (!template) return null;

  let subject = template.subject || "";
  let body = template.body;

  // Replace variables
  for (const [key, value] of Object.entries(input.variables)) {
    const placeholder = `{{${key}}}`;
    subject = subject.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), value);
    body = body.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), value);
  }

  // Check for unreplaced variables
  const unreplaced = body.match(/\{\{[^}]+\}\}/g) || [];
  const complianceFlags: string[] = [];

  if (unreplaced.length > 0) {
    complianceFlags.push(`Missing variables: ${unreplaced.join(", ")}`);
  }

  // Basic compliance checks
  const lowerBody = body.toLowerCase();
  if (lowerBody.includes("guarantee") || lowerBody.includes("guaranteed")) {
    complianceFlags.push("Contains 'guarantee' — review for compliance");
  }
  if (lowerBody.includes("risk-free") || lowerBody.includes("no risk")) {
    complianceFlags.push("Contains risk-free language — potential compliance issue");
  }
  if (template.category === "market_update" && !lowerBody.includes("past performance")) {
    complianceFlags.push("Market update should include past performance disclaimer");
  }

  const wordCount = body.split(/\s+/).length;
  const readTime = Math.max(1, Math.ceil(wordCount / 200));

  return {
    subject,
    body,
    channel: input.channel || template.channel,
    category: template.category,
    estimatedReadTime: `${readTime} min`,
    complianceFlags,
  };
}
