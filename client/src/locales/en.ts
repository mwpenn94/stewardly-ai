/**
 * English translations (base language) — G31
 *
 * Keys are organized by feature area. When adding new user-facing
 * strings, add them here first, then use t("key") in components.
 *
 * Naming convention: feature.context.element
 * e.g., "chat.input.placeholder", "nav.sidebar.settings"
 */

const en = {
  // ── Common / Global ──────────────────────────────────────────
  "common.loading": "Loading...",
  "common.error": "Something went wrong",
  "common.retry": "Try again",
  "common.save": "Save",
  "common.cancel": "Cancel",
  "common.delete": "Delete",
  "common.edit": "Edit",
  "common.create": "Create",
  "common.search": "Search",
  "common.close": "Close",
  "common.back": "Back",
  "common.next": "Next",
  "common.previous": "Previous",
  "common.confirm": "Confirm",
  "common.yes": "Yes",
  "common.no": "No",
  "common.ok": "OK",
  "common.done": "Done",
  "common.more": "More",
  "common.less": "Less",
  "common.all": "All",
  "common.none": "None",
  "common.comingSoon": "Feature coming soon",
  "common.morning": "Good morning",
  "common.afternoon": "Good afternoon",
  "common.evening": "Good evening",
  "common.signIn": "Sign In",
  "common.signOut": "Sign Out",
  "common.settings": "Settings",
  "common.profile": "Profile",
  "common.help": "Help",
  "common.send": "Send",
  "common.copy": "Copy",
  "common.copied": "Copied!",
  "common.download": "Download",
  "common.upload": "Upload",

  // ── Navigation ──────────────────────────────────────────────
  "nav.chat": "Chat",
  "nav.wealth": "Wealth Engine",
  "nav.people": "People",
  "nav.intelligence": "Intelligence",
  "nav.team": "Team",
  "nav.organizations": "Organizations",
  "nav.settings": "Settings",
  "nav.learning": "Learning",
  "nav.compliance": "Compliance",
  "nav.calendar": "Calendar",
  "nav.documents": "Documents",
  "nav.analytics": "Analytics",
  "nav.newConversation": "New Conversation",
  "nav.searchPages": "Search pages...",

  // ── Chat ────────────────────────────────────────────────────
  "chat.greeting": "{{timeOfDay}}, {{name}}",
  "chat.greetingAnon": "Welcome to Stewardly",
  "chat.howCanIHelp": "How can I help you today?",
  "chat.input.placeholder": "Ask about platform management, analytics, or financial strategies...",
  "chat.input.placeholderAnon": "Ask a question to get started...",
  "chat.resumeWhereYouLeftOff": "Resume where you left off",
  "chat.sendMessage": "Send message",
  "chat.sending": "Sending message",
  "chat.thinking": "Thinking...",
  "chat.streaming": "Responding...",
  "chat.regenerate": "Regenerate response",
  "chat.fork": "Fork conversation",
  "chat.pin": "Pin message",
  "chat.unpin": "Unpin message",
  "chat.readAloud": "Read aloud",
  "chat.stopReading": "Stop reading",
  "chat.downloadAudio": "Download audio",
  "chat.copyMessage": "Copy message",
  "chat.thumbsUp": "Good response",
  "chat.thumbsDown": "Poor response",
  "chat.newFolder": "New Folder",
  "chat.deleteConversation": "Delete conversation",
  "chat.renameConversation": "Rename conversation",
  "chat.emptyState.title": "Start a conversation",
  "chat.emptyState.description": "Ask about financial planning, market analysis, or client management",

  // ── Voice ───────────────────────────────────────────────────
  "voice.handsFree": "Hands-Free",
  "voice.handsFreeDesc": "Listen → respond → repeat",
  "voice.conversational": "Conversational",
  "voice.conversationalDesc": "Full-duplex — speak anytime",
  "voice.listening": "Listening...",
  "voice.processing": "Thinking...",
  "voice.speaking": "Speaking...",
  "voice.ready": "Ready — speak anytime",
  "voice.modeActive": "Conversational voice mode active",
  "voice.modeActiveDesc": "Speak naturally — I'll listen and respond",
  "voice.notSupported": "Voice not supported in this browser",
  "voice.speakToInterrupt": "Speak to interrupt",
  "voice.tapToClose": "Tap anywhere to close",
  "voice.saySomething": "Say something",
  "voice.end": "End",
  "voice.pauseSpeech": "Pause speech",
  "voice.resumeSpeech": "Resume speech",

  // ── Settings ────────────────────────────────────────────────
  "settings.title": "Settings",
  "settings.general": "General",
  "settings.appearance": "Appearance",
  "settings.voice": "Voice & Audio",
  "settings.privacy": "Privacy",
  "settings.integrations": "Integrations",
  "settings.description": "Account settings and preferences",
  "settings.language": "Language",
  "settings.languageDesc": "Choose your preferred language",
  "settings.theme": "Theme",
  "settings.darkMode": "Dark Mode",
  "settings.lightMode": "Light Mode",
  "settings.system": "System",

  // ── Wealth Engine ───────────────────────────────────────────
  "wealth.title": "Wealth Engine",
  "wealth.netWorth": "Net Worth",
  "wealth.assets": "Assets",
  "wealth.liabilities": "Liabilities",
  "wealth.income": "Income",
  "wealth.expenses": "Expenses",
  "wealth.projections": "Projections",
  "wealth.scenarios": "Scenarios",
  "wealth.calculator": "Calculator",

  // ── People / CRM ────────────────────────────────────────────
  "people.title": "People Hub",
  "people.clients": "Clients",
  "people.prospects": "Prospects",
  "people.contacts": "Contacts",
  "people.addClient": "Add Client",
  "people.overview": "Overview",
  "people.relationships": "Relationships",
  "people.communications": "Communications",

  // ── Learning ────────────────────────────────────────────────
  "learning.title": "Learning Center",
  "learning.flashcards": "Flashcards",
  "learning.achievements": "Achievements",
  "learning.progress": "Progress",
  "learning.streak": "Day Streak",
  "learning.mastered": "Mastered",
  "learning.studyNow": "Study Now",

  // ── Compliance ──────────────────────────────────────────────
  "compliance.title": "Compliance",
  "compliance.audit": "Audit Trail",
  "compliance.policies": "Policies",
  "compliance.alerts": "Alerts",
  "compliance.review": "Review",

  // ── Onboarding ──────────────────────────────────────────────
  "onboarding.welcome": "Welcome to Stewardly",
  "onboarding.getStarted": "Get Started",
  "onboarding.skip": "Skip Tour",
  "onboarding.next": "Next",
  "onboarding.previous": "Previous",
  "onboarding.finish": "Finish",
  "onboarding.step": "Step {{current}} of {{total}}",

  // ── Errors ──────────────────────────────────────────────────
  "error.network": "Network error — please check your connection",
  "error.unauthorized": "Please sign in to continue",
  "error.forbidden": "You don't have permission to do that",
  "error.notFound": "Page not found",
  "error.serverError": "Server error — please try again later",
  "error.timeout": "Request timed out",

  // ── Accessibility ───────────────────────────────────────────
  "a11y.skipToContent": "Skip to main content",
  "a11y.openMenu": "Open menu",
  "a11y.closeMenu": "Close menu",
  "a11y.expandSidebar": "Expand sidebar",
  "a11y.collapseSidebar": "Collapse sidebar",
  "a11y.liveCaption": "Live response caption",
  "a11y.voiceModeDialog": "Conversational voice mode",
};

export default en;
export type TranslationKeys = keyof typeof en;
