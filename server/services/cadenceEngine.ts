/**
 * Cadence Engine — Full cadence_library.json integration
 * ======================================================
 * GAP-01: Implements 7 cadences from cadence_library.json with:
 *   - Touch sequences with day/channel/subject/body/compliance_notes
 *   - Compliance overlays (ESI pre-approval gates, anti-rebate, FINRA 2210)
 *   - Stop-on-reply / stop-on-meeting-booked logic
 *   - GHL workflow mapping per GHL_import_notes
 *   - Global cadence rules (opt-out, reply handling, delivery throttling, compliance gate)
 *
 * GAP-06: Reply analysis + cadence pause
 * GAP-07: Delivery throttling (per-channel rate limits)
 * GAP-12: Variable naming convention alignment
 */
import { logger } from "../_core/logger";
const log = logger.child({ module: "cadenceEngine" });

// ─── Types ───────────────────────────────────────────────────────────────

export interface CadenceTouch {
  touchNumber: number;
  day: number;
  channel: "email" | "LinkedIn_InMail" | "LinkedIn_connection_request" | "phone" | "sms" | "LinkedIn_comment" | "LinkedIn_DM" | "direct_mail";
  subjectLine?: string;
  body: string;
  complianceNotes: string;
}

export interface CadenceDefinition {
  cadenceId: string;
  name: string;
  audienceSegment: string;
  durationDays: number;
  channelMix: string[];
  complianceOverlay: string[];
  esiPreApprovalRequired: boolean;
  esiPreApprovalId: string; // placeholder until ESI assigns
  stopOnReply: boolean;
  stopOnMeetingBooked: boolean;
  touches: CadenceTouch[];
  postCadenceAction: string;
  trigger?: string;
  variantNotes?: string;
  touchesReference?: string; // for variant cadences that reference another
  primaryContentVoice?: string;
}

export interface CadenceEnrollment {
  enrollmentId: string;
  cadenceId: string;
  leadId: number;
  userId: number; // advisor running the cadence
  status: "active" | "paused" | "completed" | "stopped_reply" | "stopped_meeting" | "stopped_optout" | "stopped_manual";
  currentTouchNumber: number;
  nextTouchDate: number; // unix ms
  startedAt: number;
  pausedAt?: number;
  completedAt?: number;
  stopReason?: string;
  replyText?: string;
}

export interface DeliveryThrottleState {
  emailsSentToday: Record<string, number>; // domain → count
  linkedInConnectionsToday: number;
  linkedInInMailsToday: number;
  phoneCallsToday: number;
  lastResetDate: string; // YYYY-MM-DD
}

export type ReplyClassification =
  | "interested"
  | "objection"
  | "info_request"
  | "opt_out"
  | "out_of_office"
  | "wrong_person"
  | "unclassified";

export interface ReplyAnalysis {
  classification: ReplyClassification;
  sentiment: "positive" | "neutral" | "negative";
  suggestedAction: string;
  oooReturnDate?: string; // ISO date if OOO detected
  shouldPauseCadence: boolean;
  shouldRouteToManualQueue: boolean;
  recommendedResponseTemplate?: string;
}

// ─── Variable Naming Convention (from cadence_library.json) ──────────────

export const VARIABLE_MAP: Record<string, string> = {
  "{{prospect_first_name}}": "Recipient's first name",
  "{{prospect_company}}": "Recipient's company or firm",
  "{{prospect_role}}": "Recipient's role/title",
  "{{specific_observation}}": "Recent business observation, news, or signal",
  "{{value_piece_title}}": "Title of relevant article, research, or insight",
  "{{specific_value}}": "Concrete value proposition",
  "{{peer_company}}": "Similar/peer company name for case study reference",
  "{{peer_result}}": "Quantified result from peer case study",
  "{{mutual_connection_name}}": "Name of mutual connection (if any)",
  "{{calendar_link}}": "Calendly or booking link",
  "{{sender_first_name}}": "Sender's first name",
  "{{sender_full_name}}": "Sender's full name",
  "{{sender_title}}": "Sender's professional title",
  "{{sender_company}}": "Sender's company name",
  "{{sender_phone}}": "Sender's phone number",
  "{{anti_rebate_disclosure}}": "ARS § 20-451 anti-rebate language (required on compensation references)",
};

// ─── Global Cadence Rules ────────────────────────────────────────────────

export const GLOBAL_RULES = {
  optOutHandling: {
    channelsAffected: "ALL channels (email, SMS, voice, LinkedIn) — universal opt-out per FCC revocation-all rule effective January 31, 2027",
    implementation: "Reply STOP → opt-out all channels. Email unsubscribe → opt-out all channels. Verbal opt-out → opt-out all channels.",
    documentation: "Opt-outs logged in CRM with timestamp, channel, scope (all channels)",
  },
  replyHandling: {
    autoPauseCadence: true,
    routeTo: "Advisor's manual queue with reply text + recommended response template",
    exception: "Auto-replies (OOO) do not trigger cadence pause; reschedule per detected return date",
  },
  deliveryThrottling: {
    maxEmailsPerDomainPerDay: 50,
    maxLinkedInConnectionRequestsPerDay: 25,
    maxLinkedInInMailsPerDay: 10,
    maxPhoneCallsPerDay: 100,
    autoThrottleAt: 0.80, // 80% of cap
    hardStopAt: 1.0, // 100% of cap
  },
  complianceGate: {
    preDeploymentCheck: "Every cadence touch verified to have valid ESI pre-approval ID before send",
    failAction: "Block send; queue for ESI review; alert advisor",
    auditCadence: "Random-sample 1-2 sent messages per day reviewed against full compliance matrix",
  },
} as const;

// ─── Cadence Library (7 cadences from cadence_library.json) ──────────────

export const CADENCE_LIBRARY: CadenceDefinition[] = [
  {
    cadenceId: "HNW_PROSPECT_12TOUCH_v1",
    name: "HNW Prospect 12-Touch Sequence",
    audienceSegment: "HNW Tier 2 prospect",
    durationDays: 120,
    channelMix: ["email", "LinkedIn_InMail", "phone", "direct_mail"],
    complianceOverlay: ["FINRA Rule 2210", "SEC Marketing Rule 206(4)-1", "ARS § 20-451 anti-rebate", "CAN-SPAM"],
    esiPreApprovalRequired: true,
    esiPreApprovalId: "{{ESI_PREAPPROVAL_ID}}",
    stopOnReply: true,
    stopOnMeetingBooked: true,
    touches: [
      { touchNumber: 1, day: 0, channel: "email", subjectLine: "{{specific_observation}} — thought of you", body: "Hi {{prospect_first_name}},\n\nI noticed {{specific_observation}} and thought you might find value in a perspective we recently shared with a {{peer_company}} executive facing a similar situation.\n\nWe helped them {{peer_result}} — I'd be happy to share the approach if it's relevant to your situation.\n\nWarm regards,\n{{sender_full_name}}\n{{sender_title}}, {{sender_company}}\n{{sender_phone}}", complianceNotes: "No performance projections. No forward-looking claims. Observation-based personalization only." },
      { touchNumber: 2, day: 3, channel: "LinkedIn_InMail", body: "Hi {{prospect_first_name}} — I sent a note earlier this week about {{specific_observation}}. Would love to connect and share the resource I mentioned. No obligation, just thought it might be useful given your role at {{prospect_company}}.", complianceNotes: "LinkedIn InMail — ESI pre-approved template. No attachments." },
      { touchNumber: 3, day: 7, channel: "email", subjectLine: "{{value_piece_title}} — complimentary resource", body: "Hi {{prospect_first_name}},\n\nFollowing up on my earlier note — I wanted to share \"{{value_piece_title}}\" which addresses {{specific_value}}.\n\n[Link to ESI-pre-approved content piece]\n\nIf this resonates, I'd welcome a brief conversation at your convenience.\n\nBest,\n{{sender_full_name}}", complianceNotes: "Content piece must have ESI pre-approval. Link to approved hosted version only." },
      { touchNumber: 4, day: 14, channel: "phone", body: "Brief voicemail: 'Hi {{prospect_first_name}}, this is {{sender_first_name}} from {{sender_company}}. I shared a resource on {{specific_value}} — wanted to see if it was helpful. My number is {{sender_phone}}. No pressure at all — just wanted to make sure it reached you.'", complianceNotes: "TCPA: voicemail only if no prior opt-out. No auto-dialer. Manual dial required." },
      { touchNumber: 5, day: 21, channel: "email", subjectLine: "Quick question, {{prospect_first_name}}", body: "Hi {{prospect_first_name}},\n\nI know you're busy — just a quick question: is {{specific_value}} something on your radar right now?\n\nIf so, I have a few ideas that might save you time. If not, no worries at all — I'll circle back another time.\n\nBest,\n{{sender_full_name}}", complianceNotes: "Permission-based language. Easy opt-out path." },
      { touchNumber: 6, day: 30, channel: "LinkedIn_InMail", body: "{{prospect_first_name}} — saw your recent activity on LinkedIn and it reinforced my thought that {{specific_value}} could be relevant. Happy to share a case study from a similar situation. Just say the word.", complianceNotes: "LinkedIn InMail — no attachments. ESI pre-approved." },
      { touchNumber: 7, day: 42, channel: "email", subjectLine: "Case study: {{peer_company}} and {{specific_value}}", body: "Hi {{prospect_first_name}},\n\nI wanted to share a brief case study about how {{peer_company}} approached {{specific_value}}.\n\nKey outcome: {{peer_result}}\n\nWould a 15-minute conversation be worth your time to explore whether something similar could work for your situation?\n\n{{calendar_link}}\n\nBest,\n{{sender_full_name}}", complianceNotes: "Case study must be anonymized or have client consent. ESI pre-approved." },
      { touchNumber: 8, day: 56, channel: "phone", body: "Second call attempt. Reference case study sent in Touch 7. Ask if they had a chance to review. Offer to walk through it briefly.", complianceNotes: "TCPA: manual dial only. No auto-dialer." },
      { touchNumber: 9, day: 70, channel: "email", subjectLine: "One more thought on {{specific_value}}", body: "Hi {{prospect_first_name}},\n\nI've been thinking about your situation at {{prospect_company}} and had one more idea about {{specific_value}} that I didn't mention before.\n\nWould you be open to a brief call this week? I promise to keep it under 15 minutes.\n\n{{calendar_link}}\n\nBest,\n{{sender_full_name}}", complianceNotes: "No pressure language. Clear time commitment." },
      { touchNumber: 10, day: 84, channel: "LinkedIn_InMail", body: "{{prospect_first_name}} — circling back one more time. I've shared a few resources on {{specific_value}} and wanted to see if any resonated. If the timing isn't right, I completely understand. Just want to make sure I'm not missing an opportunity to be helpful.", complianceNotes: "Soft close. Permission-based." },
      { touchNumber: 11, day: 100, channel: "email", subjectLine: "Closing the loop, {{prospect_first_name}}", body: "Hi {{prospect_first_name}},\n\nI've reached out a few times about {{specific_value}} and want to respect your time. This will be my last note unless you'd like to continue the conversation.\n\nIf anything changes, my door is always open: {{calendar_link}}\n\nWishing you continued success at {{prospect_company}}.\n\nWarm regards,\n{{sender_full_name}}", complianceNotes: "Breakup email. Clear this is final touch. No guilt language." },
      { touchNumber: 12, day: 120, channel: "email", subjectLine: "Happy to reconnect anytime", body: "Hi {{prospect_first_name}},\n\nJust a brief note to say I hope things are going well at {{prospect_company}}. If {{specific_value}} ever becomes a priority, I'd welcome the chance to reconnect.\n\nAll the best,\n{{sender_full_name}}\n{{sender_title}}, {{sender_company}}", complianceNotes: "Final touch. Warm close. No ask." },
    ],
    postCadenceAction: "Move to DORMANT_REENGAGEMENT_v1 after 90-day cooling period",
  },
  {
    cadenceId: "HNW_PROSPECT_NM_12TOUCH_v1",
    name: "HNW Prospect NM 12-Touch (New Mexico variant)",
    audienceSegment: "HNW Tier 2 prospect — New Mexico geography",
    durationDays: 120,
    channelMix: ["email", "LinkedIn_InMail", "phone", "direct_mail"],
    complianceOverlay: ["FINRA Rule 2210", "SEC Marketing Rule 206(4)-1", "NAIC PLMA § 13(D)", "NM-specific anti-rebate", "CAN-SPAM"],
    esiPreApprovalRequired: true,
    esiPreApprovalId: "{{ESI_PREAPPROVAL_ID}}",
    stopOnReply: true,
    stopOnMeetingBooked: true,
    touches: [], // References HNW_PROSPECT_12TOUCH_v1 with NM compliance language
    postCadenceAction: "Move to DORMANT_REENGAGEMENT_v1 after 90-day cooling period",
    variantNotes: "Same 12-touch structure as HNW_PROSPECT_12TOUCH_v1 but with NM-specific compliance language (NAIC PLMA § 13(D) instead of ARS § 20-451). All touches require NM DOI compliance overlay.",
    touchesReference: "HNW_PROSPECT_12TOUCH_v1",
  },
  {
    cadenceId: "RECRUIT_TIER1_12TOUCH_v1",
    name: "Recruit Tier 1 — 12-Touch Sequence",
    audienceSegment: "Recruit candidate — Tier 1 (composite score ≥80)",
    durationDays: 90,
    channelMix: ["email", "LinkedIn_InMail", "LinkedIn_connection_request", "phone"],
    complianceOverlay: ["FINRA Rule 3270 (outside business activities)", "FINRA Rule 2210", "No non-compete interference"],
    esiPreApprovalRequired: true,
    esiPreApprovalId: "{{ESI_PREAPPROVAL_ID}}",
    stopOnReply: true,
    stopOnMeetingBooked: true,
    touches: [
      { touchNumber: 1, day: 0, channel: "LinkedIn_connection_request", body: "Hi {{prospect_first_name}} — I'm {{sender_first_name}} with {{sender_company}}. I noticed your work at {{prospect_company}} and would love to connect. We share some mutual connections in the {{prospect_role}} space.", complianceNotes: "LinkedIn connection request — 300 char limit. No recruiting language." },
      { touchNumber: 2, day: 2, channel: "email", subjectLine: "Thought you might find this interesting, {{prospect_first_name}}", body: "Hi {{prospect_first_name}},\n\nI came across your profile and was impressed by your track record at {{prospect_company}}. I recently published a piece on {{value_piece_title}} that I thought might resonate given your experience.\n\n[Link to content]\n\nWould love to hear your perspective.\n\nBest,\n{{sender_full_name}}\n{{sender_title}}, {{sender_company}}", complianceNotes: "Value-first approach. No explicit recruiting language in first email." },
      { touchNumber: 3, day: 5, channel: "LinkedIn_InMail", body: "{{prospect_first_name}} — thanks for connecting (or: wanted to reach out). I shared a resource on {{value_piece_title}} via email — did it reach you? Happy to resend if not.", complianceNotes: "Follow-up to email. No recruiting language yet." },
      { touchNumber: 4, day: 10, channel: "email", subjectLine: "A question about your practice, {{prospect_first_name}}", body: "Hi {{prospect_first_name}},\n\nI've been studying the {{prospect_company}} model and had a question about how professionals like you approach {{specific_value}}.\n\nWe've been building something at {{sender_company}} that takes a different approach — I'd value your perspective as someone with deep experience in this space.\n\nWould you be open to a brief conversation? {{calendar_link}}\n\nBest,\n{{sender_full_name}}", complianceNotes: "Curiosity-based approach. Positions as peer conversation, not recruiting pitch." },
      { touchNumber: 5, day: 14, channel: "phone", body: "Voicemail: 'Hi {{prospect_first_name}}, this is {{sender_first_name}} from {{sender_company}}. I sent you a note about {{specific_value}} and would love to get your take. My number is {{sender_phone}}. No agenda — just a professional conversation.'", complianceNotes: "TCPA: manual dial. No auto-dialer. Voicemail only." },
      { touchNumber: 6, day: 21, channel: "email", subjectLine: "What I've learned from professionals like you", body: "Hi {{prospect_first_name}},\n\nI've had the privilege of speaking with several professionals who've made transitions in their careers — from {{peer_company}} and similar firms.\n\nThe common thread: they wanted more control over {{specific_value}}.\n\nI don't know if that resonates with you, but if it does, I'd welcome a confidential conversation.\n\n{{calendar_link}}\n\nBest,\n{{sender_full_name}}", complianceNotes: "Transition language — not 'recruiting.' Confidential positioning." },
      { touchNumber: 7, day: 30, channel: "LinkedIn_InMail", body: "{{prospect_first_name}} — I've reached out a couple of times and want to respect your time. If a confidential conversation about your career trajectory ever makes sense, I'm here. No pressure.", complianceNotes: "Soft touch. Permission-based." },
      { touchNumber: 8, day: 42, channel: "email", subjectLine: "Case study: {{peer_company}} professional's journey", body: "Hi {{prospect_first_name}},\n\nI wanted to share a brief story about a professional from {{peer_company}} who explored a different model and found {{peer_result}}.\n\nEvery situation is unique, but I thought the parallels to your experience might be interesting.\n\nWorth a 15-minute conversation? {{calendar_link}}\n\nBest,\n{{sender_full_name}}", complianceNotes: "Anonymized case study. ESI pre-approved. No guarantees or projections." },
      { touchNumber: 9, day: 56, channel: "phone", body: "Second call. Reference case study. Ask if they reviewed it. Offer to walk through the model briefly.", complianceNotes: "TCPA: manual dial only." },
      { touchNumber: 10, day: 70, channel: "email", subjectLine: "One more resource for you, {{prospect_first_name}}", body: "Hi {{prospect_first_name}},\n\nI have one more resource I think you'd find valuable — a comparison of practice models that professionals in your position often evaluate.\n\n[Link to ESI-approved comparison guide]\n\nIf you'd like to discuss, I'm available: {{calendar_link}}\n\nBest,\n{{sender_full_name}}", complianceNotes: "Comparison guide must be ESI pre-approved. No disparagement of current firm." },
      { touchNumber: 11, day: 84, channel: "email", subjectLine: "Closing the loop, {{prospect_first_name}}", body: "Hi {{prospect_first_name}},\n\nI've reached out several times and want to respect your bandwidth. This will be my last note unless you'd like to continue the conversation.\n\nIf your situation changes, my door is always open: {{calendar_link}}\n\nWishing you continued success.\n\nWarm regards,\n{{sender_full_name}}", complianceNotes: "Breakup email. Clear final touch." },
    ],
    postCadenceAction: "Move to DORMANT_REENGAGEMENT_v1 after 90-day cooling period. If Tier 1 with cascade potential ≥5, flag for MD review before dormancy.",
  },
  {
    cadenceId: "COI_MAINTENANCE_QUARTERLY_v1",
    name: "COI Maintenance — Quarterly Touch",
    audienceSegment: "Active COI partner (CPA, attorney, NAEPC chapter colleague)",
    durationDays: 90,
    channelMix: ["email", "phone", "LinkedIn_comment"],
    complianceOverlay: ["FINRA Rule 2210", "ARS § 20-451 anti-rebate (if compensation discussed)"],
    esiPreApprovalRequired: true,
    esiPreApprovalId: "{{ESI_PREAPPROVAL_ID}}",
    stopOnReply: true,
    stopOnMeetingBooked: false,
    trigger: "Quarterly calendar trigger (Jan 1, Apr 1, Jul 1, Oct 1)",
    touches: [
      { touchNumber: 1, day: 0, channel: "email", subjectLine: "Quarterly check-in + something I thought you'd find useful", body: "Hi {{prospect_first_name}},\n\nHope Q{{quarter}} is off to a strong start for you and the team at {{prospect_company}}.\n\nI came across {{value_piece_title}} and immediately thought of your practice — particularly around {{specific_value}}.\n\n[Link to content]\n\nWould love to catch up over coffee or a call this quarter. {{calendar_link}}\n\nBest,\n{{sender_full_name}}", complianceNotes: "Value-first. No solicitation. Relationship maintenance." },
      { touchNumber: 2, day: 7, channel: "LinkedIn_comment", body: "Engage with COI's recent LinkedIn post. Add substantive comment related to their content. Do not pitch.", complianceNotes: "Organic engagement. No business solicitation in comments." },
      { touchNumber: 3, day: 14, channel: "phone", body: "Call to schedule quarterly coffee/lunch. Reference the content piece shared. Ask about their practice and any clients who might benefit from collaboration.", complianceNotes: "Relationship call. If compensation/referral discussed, anti-rebate language required." },
      { touchNumber: 4, day: 30, channel: "email", subjectLine: "Following up on our conversation", body: "Hi {{prospect_first_name}},\n\nGreat catching up [or: sorry I missed you — wanted to follow up]. As discussed, I think there's a natural overlap between our practices around {{specific_value}}.\n\nHere's the resource I mentioned: [Link]\n\nLooking forward to staying connected this quarter.\n\nBest,\n{{sender_full_name}}", complianceNotes: "Follow-up to call. Reference specific conversation points." },
      { touchNumber: 5, day: 60, channel: "email", subjectLine: "End-of-quarter thought for you", body: "Hi {{prospect_first_name}},\n\nAs we wrap up Q{{quarter}}, I wanted to share one more thought on {{specific_value}} that came up in a recent client conversation.\n\n[Brief insight — 2-3 sentences]\n\nLooking forward to connecting again next quarter. If anything comes up before then, don't hesitate to reach out.\n\nBest,\n{{sender_full_name}}", complianceNotes: "Quarter-end touch. Warm close. Sets up next quarterly cadence." },
    ],
    postCadenceAction: "Auto-restart next quarter. If no engagement in 2 consecutive quarters, flag for relationship review.",
  },
  {
    cadenceId: "STEWARDLY_AFFILIATE_ONBOARDING_v1",
    name: "Stewardly Affiliate Onboarding",
    audienceSegment: "Stewardly affiliate — newly onboarded",
    durationDays: 30,
    channelMix: ["email", "phone"],
    complianceOverlay: ["FINRA Rule 2210", "ARS § 20-451 anti-rebate", "Affiliate agreement terms"],
    esiPreApprovalRequired: true,
    esiPreApprovalId: "{{ESI_PREAPPROVAL_ID}}",
    stopOnReply: true,
    stopOnMeetingBooked: false,
    trigger: "Affiliate agreement signed",
    touches: [
      { touchNumber: 1, day: 0, channel: "email", subjectLine: "Welcome to Stewardly — your onboarding guide", body: "Hi {{prospect_first_name}},\n\nWelcome to the Stewardly affiliate program! I'm thrilled to have you on board.\n\nHere's your onboarding guide with everything you need to get started:\n\n1. Platform access: [Link to Stewardly portal]\n2. Calculator embed instructions: [Link]\n3. Compliance guidelines: [Link to ESI-approved materials]\n4. Your dedicated support contact: {{sender_full_name}} ({{sender_phone}})\n\nLet's schedule a 30-minute onboarding call this week: {{calendar_link}}\n\nExcited to partner with you!\n\n{{sender_full_name}}", complianceNotes: "Onboarding email. All linked materials must be ESI pre-approved." },
      { touchNumber: 2, day: 3, channel: "phone", body: "Onboarding call. Walk through platform, calculator embedding, compliance requirements, and first 30-day milestones.", complianceNotes: "Training call. Document completion in CRM." },
      { touchNumber: 3, day: 14, channel: "email", subjectLine: "How's your first two weeks going?", body: "Hi {{prospect_first_name}},\n\nJust checking in on your first two weeks with Stewardly. A few things to make sure you're set up for success:\n\n- Have you embedded the calculator on your site? [Link to instructions]\n- Have you reviewed the compliance guidelines? [Link]\n- Any questions about the affiliate agreement terms?\n\nHappy to hop on a quick call if anything needs clarification: {{calendar_link}}\n\nBest,\n{{sender_full_name}}", complianceNotes: "Check-in email. Support-focused." },
      { touchNumber: 4, day: 30, channel: "email", subjectLine: "Your first month — let's review", body: "Hi {{prospect_first_name}},\n\nCongratulations on completing your first month as a Stewardly affiliate!\n\nI'd love to schedule a brief review to:\n- Discuss your initial results and any leads generated\n- Address any technical or compliance questions\n- Plan your growth strategy for month 2\n\n{{calendar_link}}\n\nLooking forward to it!\n\n{{sender_full_name}}", complianceNotes: "Month-end review. If discussing compensation, anti-rebate language required. {{anti_rebate_disclosure}}" },
    ],
    postCadenceAction: "Transition to quarterly COI maintenance cadence if affiliate is active. If no calculator embeds after 30 days, escalate to MD review.",
  },
  {
    cadenceId: "WTA_PCMP_B2B_PROSPECT_v1",
    name: "WTA/PCMP B2B Prospect Sequence",
    audienceSegment: "WTA/PCMP B2B prospect (HR Director, COO, CFO at 10+ employee business)",
    durationDays: 60,
    channelMix: ["email", "LinkedIn_InMail", "phone"],
    complianceOverlay: ["FINRA Rule 2210", "ERISA considerations", "HIPAA (WTA health-adjacent)", "CAN-SPAM"],
    esiPreApprovalRequired: true,
    esiPreApprovalId: "{{ESI_PREAPPROVAL_ID}}",
    stopOnReply: true,
    stopOnMeetingBooked: true,
    primaryContentVoice: "Brian Riley (WTA) or Joel (campaign coordinator) — Mike provides strategic oversight",
    touches: [
      { touchNumber: 1, day: 0, channel: "email", subjectLine: "Reducing employee benefits costs while improving coverage", body: "Hi {{prospect_first_name}},\n\nI work with businesses like {{prospect_company}} to optimize employee benefits programs — reducing costs while actually improving coverage for your team.\n\nA recent client with a similar-sized organization saved {{peer_result}} annually while adding voluntary benefits their employees valued.\n\nWould a 15-minute conversation be worth your time? {{calendar_link}}\n\nBest,\n{{sender_full_name}}\n{{sender_title}}, {{sender_company}}", complianceNotes: "B2B outreach. ERISA considerations if discussing retirement plans. HIPAA if health benefits discussed." },
      { touchNumber: 2, day: 3, channel: "LinkedIn_InMail", body: "Hi {{prospect_first_name}} — I sent a note about optimizing benefits at {{prospect_company}}. Would love to connect and share how similar businesses have approached this. No obligation.", complianceNotes: "LinkedIn InMail — ESI pre-approved." },
      { touchNumber: 3, day: 7, channel: "email", subjectLine: "{{value_piece_title}} — complimentary for {{prospect_company}}", body: "Hi {{prospect_first_name}},\n\nI wanted to share \"{{value_piece_title}}\" — a guide we created for businesses evaluating their benefits strategy.\n\n[Link to ESI-approved content]\n\nKey takeaway: most businesses of your size are overpaying by 15-25% on benefits without realizing it.\n\nHappy to discuss if this resonates: {{calendar_link}}\n\nBest,\n{{sender_full_name}}", complianceNotes: "Content must be ESI pre-approved. Statistics must be sourced and verifiable." },
      { touchNumber: 4, day: 14, channel: "phone", body: "Call to discuss benefits optimization. Reference the guide sent in Touch 3. Ask about current benefits renewal timeline.", complianceNotes: "TCPA: B2B exemption applies for business phone numbers. HIPAA: do not discuss specific employee health information." },
      { touchNumber: 5, day: 21, channel: "email", subjectLine: "Quick question about {{prospect_company}}'s benefits renewal", body: "Hi {{prospect_first_name}},\n\nQuick question: when is {{prospect_company}}'s next benefits renewal? Most businesses start evaluating alternatives 90 days before renewal.\n\nIf your renewal is approaching, I'd love to show you what a competitive analysis looks like — no commitment required.\n\n{{calendar_link}}\n\nBest,\n{{sender_full_name}}", complianceNotes: "Timing-based approach. No pressure." },
      { touchNumber: 6, day: 30, channel: "LinkedIn_InMail", body: "{{prospect_first_name}} — following up on the benefits optimization conversation. If timing isn't right now, I'd love to know when your next renewal is so I can circle back at the right time.", complianceNotes: "Soft follow-up. Information gathering." },
      { touchNumber: 7, day: 42, channel: "email", subjectLine: "Case study: {{peer_company}} benefits transformation", body: "Hi {{prospect_first_name}},\n\nI wanted to share how {{peer_company}} (similar size to {{prospect_company}}) transformed their benefits program:\n\n- {{peer_result}}\n- Employee satisfaction increased\n- HR administration time reduced\n\nWould you like to see how this could work for {{prospect_company}}? {{calendar_link}}\n\nBest,\n{{sender_full_name}}", complianceNotes: "Case study must be anonymized or have client consent. ESI pre-approved." },
      { touchNumber: 8, day: 56, channel: "email", subjectLine: "Last thought on {{prospect_company}}'s benefits strategy", body: "Hi {{prospect_first_name}},\n\nThis will be my last note on this topic. If optimizing your benefits program becomes a priority, I'd welcome the chance to help.\n\nIn the meantime, here's a complimentary benefits audit checklist: [Link]\n\nAll the best to you and the team at {{prospect_company}}.\n\n{{sender_full_name}}", complianceNotes: "Breakup email. Value-add close." },
    ],
    postCadenceAction: "Move to DORMANT_REENGAGEMENT_v1 after 90-day cooling period. Flag if renewal date captured — re-engage 90 days before renewal.",
  },
  {
    cadenceId: "DORMANT_REENGAGEMENT_v1",
    name: "Dormant Re-engagement Sequence",
    audienceSegment: "Any prospect with no contact in 90+ days",
    durationDays: 30,
    channelMix: ["email", "LinkedIn_InMail"],
    complianceOverlay: ["FINRA Rule 2210", "CAN-SPAM", "Prior opt-out check required"],
    esiPreApprovalRequired: true,
    esiPreApprovalId: "{{ESI_PREAPPROVAL_ID}}",
    stopOnReply: true,
    stopOnMeetingBooked: true,
    trigger: "90+ days since last contact with no reply, no meeting, no opt-out",
    touches: [
      { touchNumber: 1, day: 0, channel: "email", subjectLine: "Checking in, {{prospect_first_name}}", body: "Hi {{prospect_first_name}},\n\nIt's been a while since we last connected. I hope things are going well at {{prospect_company}}.\n\nI've been working on some new approaches to {{specific_value}} and thought of you. If it's relevant to your current situation, I'd love to reconnect.\n\nNo pressure — just wanted to make sure you're on my radar.\n\nBest,\n{{sender_full_name}}", complianceNotes: "Re-engagement. Must verify no prior opt-out before sending." },
      { touchNumber: 2, day: 14, channel: "LinkedIn_InMail", body: "{{prospect_first_name}} — hope you're doing well. I've been developing some new thinking on {{specific_value}} and thought it might be worth a brief conversation. Open to reconnecting?", complianceNotes: "LinkedIn InMail — ESI pre-approved." },
      { touchNumber: 3, day: 28, channel: "email", subjectLine: "One more thought for you, {{prospect_first_name}}", body: "Hi {{prospect_first_name}},\n\nLast note from me for now. If {{specific_value}} becomes a priority, I'm here: {{calendar_link}}\n\nWishing you all the best.\n\n{{sender_full_name}}", complianceNotes: "Final re-engagement touch. If no response, mark as permanently dormant." },
    ],
    postCadenceAction: "If no response after 3 touches, mark as permanently dormant. Do not re-engage without new signal (job change, life event, inbound inquiry).",
  },
];

// ─── Cadence Engine Functions ────────────────────────────────────────────

/**
 * Get a cadence definition by ID. For variant cadences (like NM),
 * resolves the touchesReference to the parent cadence's touches.
 */
export function getCadence(cadenceId: string): CadenceDefinition | undefined {
  const cadence = CADENCE_LIBRARY.find(c => c.cadenceId === cadenceId);
  if (!cadence) return undefined;
  // Resolve variant references
  if (cadence.touchesReference && cadence.touches.length === 0) {
    const parent = CADENCE_LIBRARY.find(c => c.cadenceId === cadence.touchesReference);
    if (parent) {
      return { ...cadence, touches: parent.touches };
    }
  }
  return cadence;
}

/**
 * Render a touch body by replacing {{variables}} with actual values.
 */
export function renderTouch(
  touch: CadenceTouch,
  variables: Record<string, string>
): { subject?: string; body: string } {
  const replaceVars = (text: string) =>
    text.replace(/\{\{(\w+)\}\}/g, (match, key) => variables[key] || match);
  return {
    subject: touch.subjectLine ? replaceVars(touch.subjectLine) : undefined,
    body: replaceVars(touch.body),
  };
}

/**
 * Check if a touch passes the compliance gate before sending.
 */
export function complianceGateCheck(touch: CadenceTouch, enrollment: {
  esiPreApprovalId?: string;
  antiRebateRequired?: boolean;
  tcpaConsentVerified?: boolean;
}): { passed: boolean; failures: string[] } {
  const failures: string[] = [];
  // ESI pre-approval check
  if (!enrollment.esiPreApprovalId || enrollment.esiPreApprovalId.startsWith("{{")) {
    failures.push("ESI pre-approval ID missing or placeholder");
  }
  // TCPA check for phone/SMS channels
  if ((touch.channel === "phone" || touch.channel === "sms") && !enrollment.tcpaConsentVerified) {
    failures.push("TCPA consent not verified for phone/SMS channel");
  }
  // Anti-rebate check if required
  if (enrollment.antiRebateRequired && !touch.body.includes("anti_rebate_disclosure") && !touch.body.includes("ARS § 20-451")) {
    failures.push("Anti-rebate language required but not present in touch body");
  }
  return { passed: failures.length === 0, failures };
}

/**
 * Check delivery throttle limits before sending.
 * Returns whether the send is allowed and which limit would be hit.
 */
export function checkThrottle(
  state: DeliveryThrottleState,
  channel: CadenceTouch["channel"],
  emailDomain?: string
): { allowed: boolean; reason?: string; utilizationPct: number } {
  const limits = GLOBAL_RULES.deliveryThrottling;
  // Reset if new day
  const today = new Date().toISOString().slice(0, 10);
  if (state.lastResetDate !== today) {
    state.emailsSentToday = {};
    state.linkedInConnectionsToday = 0;
    state.linkedInInMailsToday = 0;
    state.phoneCallsToday = 0;
    state.lastResetDate = today;
  }
  switch (channel) {
    case "email": {
      const domain = emailDomain || "default";
      const sent = state.emailsSentToday[domain] || 0;
      const pct = sent / limits.maxEmailsPerDomainPerDay;
      if (pct >= limits.hardStopAt) return { allowed: false, reason: `Email hard stop: ${sent}/${limits.maxEmailsPerDomainPerDay} for domain ${domain}`, utilizationPct: pct };
      if (pct >= limits.autoThrottleAt) return { allowed: true, reason: `Email throttle warning: ${sent}/${limits.maxEmailsPerDomainPerDay} (${(pct * 100).toFixed(0)}%)`, utilizationPct: pct };
      return { allowed: true, utilizationPct: pct };
    }
    case "LinkedIn_connection_request": {
      const pct = state.linkedInConnectionsToday / limits.maxLinkedInConnectionRequestsPerDay;
      if (pct >= limits.hardStopAt) return { allowed: false, reason: `LinkedIn connections hard stop: ${state.linkedInConnectionsToday}/${limits.maxLinkedInConnectionRequestsPerDay}`, utilizationPct: pct };
      return { allowed: true, utilizationPct: pct };
    }
    case "LinkedIn_InMail":
    case "LinkedIn_DM": {
      const pct = state.linkedInInMailsToday / limits.maxLinkedInInMailsPerDay;
      if (pct >= limits.hardStopAt) return { allowed: false, reason: `LinkedIn InMails hard stop: ${state.linkedInInMailsToday}/${limits.maxLinkedInInMailsPerDay}`, utilizationPct: pct };
      return { allowed: true, utilizationPct: pct };
    }
    case "phone": {
      const pct = state.phoneCallsToday / limits.maxPhoneCallsPerDay;
      if (pct >= limits.hardStopAt) return { allowed: false, reason: `Phone calls hard stop: ${state.phoneCallsToday}/${limits.maxPhoneCallsPerDay}`, utilizationPct: pct };
      return { allowed: true, utilizationPct: pct };
    }
    default:
      return { allowed: true, utilizationPct: 0 };
  }
}

/**
 * Classify a reply to determine cadence action.
 * GAP-06 + GAP-13: Reply analysis with classification.
 */
export function classifyReply(replyText: string): ReplyAnalysis {
  const lower = replyText.toLowerCase().trim();
  // Opt-out detection (highest priority)
  const optOutPatterns = ["unsubscribe", "stop", "remove me", "opt out", "opt-out", "do not contact", "take me off", "no longer interested", "cease"];
  if (optOutPatterns.some(p => lower.includes(p))) {
    return {
      classification: "opt_out",
      sentiment: "negative",
      suggestedAction: "Immediately remove from all cadences. Log opt-out with timestamp and channel. Universal opt-out per FCC rule.",
      shouldPauseCadence: true,
      shouldRouteToManualQueue: false,
    };
  }
  // OOO detection
  const oooPatterns = ["out of office", "out of the office", "away from", "on vacation", "on leave", "returning on", "return on", "back on", "auto-reply", "automatic reply"];
  if (oooPatterns.some(p => lower.includes(p))) {
    // Try to extract return date
    const dateMatch = lower.match(/(?:return|back|returning)\s+(?:on\s+)?(\w+\s+\d{1,2}(?:,?\s+\d{4})?)/i);
    return {
      classification: "out_of_office",
      sentiment: "neutral",
      suggestedAction: "Do NOT pause cadence. Reschedule next touch to after detected return date + 2 business days.",
      oooReturnDate: dateMatch ? dateMatch[1] : undefined,
      shouldPauseCadence: false,
      shouldRouteToManualQueue: false,
    };
  }
  // Wrong person detection
  const wrongPersonPatterns = ["wrong person", "not the right", "no longer at", "left the company", "doesn't work here", "retired", "passed away"];
  if (wrongPersonPatterns.some(p => lower.includes(p))) {
    return {
      classification: "wrong_person",
      sentiment: "neutral",
      suggestedAction: "Stop cadence. Update CRM record. If company still valid, research replacement contact.",
      shouldPauseCadence: true,
      shouldRouteToManualQueue: true,
    };
  }
  // Interest detection
  const interestPatterns = ["interested", "tell me more", "sounds good", "let's talk", "let's meet", "schedule", "calendar", "available", "free to chat", "love to", "would like to", "send me", "share more"];
  if (interestPatterns.some(p => lower.includes(p))) {
    return {
      classification: "interested",
      sentiment: "positive",
      suggestedAction: "Pause cadence immediately. Route to advisor's manual queue with priority flag. Respond within 2 hours.",
      shouldPauseCadence: true,
      shouldRouteToManualQueue: true,
      recommendedResponseTemplate: "INTERESTED_REPLY_TEMPLATE",
    };
  }
  // Objection detection
  const objectionPatterns = ["not interested", "no thank", "not a good time", "too busy", "not right now", "maybe later", "not looking", "happy where", "satisfied with"];
  if (objectionPatterns.some(p => lower.includes(p))) {
    return {
      classification: "objection",
      sentiment: "negative",
      suggestedAction: "Pause cadence. Route to advisor for personalized objection handling. Do not auto-respond.",
      shouldPauseCadence: true,
      shouldRouteToManualQueue: true,
      recommendedResponseTemplate: "OBJECTION_HANDLING_TEMPLATE",
    };
  }
  // Info request detection
  const infoPatterns = ["more information", "more details", "can you explain", "what does", "how does", "tell me about", "curious about", "question about"];
  if (infoPatterns.some(p => lower.includes(p))) {
    return {
      classification: "info_request",
      sentiment: "positive",
      suggestedAction: "Pause cadence. Route to advisor with relevant content recommendations. Respond within 4 hours.",
      shouldPauseCadence: true,
      shouldRouteToManualQueue: true,
      recommendedResponseTemplate: "INFO_REQUEST_TEMPLATE",
    };
  }
  // Default: unclassified — route to manual queue for human review
  return {
    classification: "unclassified",
    sentiment: "neutral",
    suggestedAction: "Route to advisor's manual queue for classification and response.",
    shouldPauseCadence: true,
    shouldRouteToManualQueue: true,
  };
}

/**
 * Get the recommended cadence for a lead based on their segment and geography.
 */
export function recommendCadence(params: {
  segment: string;
  state?: string;
  propensityTier?: string;
  daysSinceLastContact?: number;
  isAffiliate?: boolean;
  isCoi?: boolean;
  isWtaPcmp?: boolean;
}): string {
  // Dormant re-engagement takes priority
  if (params.daysSinceLastContact && params.daysSinceLastContact >= 90) {
    return "DORMANT_REENGAGEMENT_v1";
  }
  // Affiliate onboarding
  if (params.isAffiliate) return "STEWARDLY_AFFILIATE_ONBOARDING_v1";
  // COI maintenance
  if (params.isCoi) return "COI_MAINTENANCE_QUARTERLY_v1";
  // WTA/PCMP B2B
  if (params.isWtaPcmp) return "WTA_PCMP_B2B_PROSPECT_v1";
  // Recruit candidates
  if (params.segment.toLowerCase().includes("recruit")) {
    return "RECRUIT_TIER1_12TOUCH_v1";
  }
  // HNW prospects — geography-based
  if (params.state === "NM") return "HNW_PROSPECT_NM_12TOUCH_v1";
  return "HNW_PROSPECT_12TOUCH_v1";
}

log.info("Cadence engine initialized with %d cadences", CADENCE_LIBRARY.length);
