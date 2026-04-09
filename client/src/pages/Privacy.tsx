import { Button } from "@/components/ui/button";
import { ArrowLeft, Shield, Database, Eye, Lock, Trash2, Download, Server, Clock } from "lucide-react";
import { useLocation } from "wouter";

const SECTIONS = [
  {
    id: "collection",
    icon: <Database className="w-5 h-5" />,
    title: "Data We Collect",
    content: [
      { subtitle: "Account Information", text: "When you create an account, we collect your name and authentication credentials through our OAuth provider. We do not store passwords directly." },
      { subtitle: "Conversation Data", text: "Messages you send and receive in chat are stored to maintain conversation history and improve your experience. You can delete individual conversations or all data at any time." },
      { subtitle: "Uploaded Documents", text: "Files you upload to your Knowledge Base are stored securely in cloud storage (S3). Document metadata is stored in our database. You control visibility settings for each document." },
      { subtitle: "Financial Profile", text: "If you complete the suitability assessment, your responses are stored to personalize financial guidance. This data is never shared with third parties without your explicit consent." },
      { subtitle: "Usage Analytics", text: "We collect anonymized usage data (page views, feature usage) to improve the platform. No personally identifiable information is included in analytics." },
      { subtitle: "Voice Data", text: "When you use voice features, audio is processed in real-time for transcription. We do not store raw audio recordings. Only the transcribed text is retained as part of your conversation." },
    ],
  },
  {
    id: "processing",
    icon: <Server className="w-5 h-5" />,
    title: "How We Process Your Data",
    content: [
      { subtitle: "AI Processing", text: "Your messages are sent to AI language models to generate responses. We use PII masking to strip sensitive information (SSNs, account numbers, phone numbers) before sending data to AI models. The AI does not retain your data between sessions." },
      { subtitle: "Personalization", text: "We use your conversation history, uploaded documents, and preferences to personalize AI responses. This processing happens on our servers and is not shared externally." },
      { subtitle: "Compliance Logging", text: "For financial advisory interactions, we maintain an audit trail as required by regulatory standards. This includes confidence scores, disclaimer tracking, and review status." },
      { subtitle: "Memory System", text: "Our AI extracts key facts from conversations (with your awareness) to provide continuity across sessions. You can view, edit, or delete any stored memories in Settings." },
    ],
  },
  {
    id: "retention",
    icon: <Clock className="w-5 h-5" />,
    title: "Data Retention",
    content: [
      { subtitle: "Conversations", text: "Conversation data is retained until you delete it. You can delete individual conversations or request deletion of all data." },
      { subtitle: "Documents", text: "Uploaded documents are retained until you delete them. Deleted documents are permanently removed from storage within 30 days." },
      { subtitle: "Account Data", text: "Account information is retained while your account is active. Upon account deletion, all associated data is permanently removed within 30 days." },
      { subtitle: "Audit Logs", text: "Compliance audit logs may be retained for up to 7 years as required by financial regulatory standards, even after account deletion." },
      { subtitle: "Analytics", text: "Anonymized analytics data is retained indefinitely as it contains no personally identifiable information." },
    ],
  },
  {
    id: "rights",
    icon: <Eye className="w-5 h-5" />,
    title: "Your Rights",
    content: [
      { subtitle: "Access", text: "You can access all your data through the Settings > Privacy & Data tab. This includes conversations, documents, memories, and profile information." },
      { subtitle: "Export", text: "You can export your conversations in Markdown or JSON format. Full data export is available through Settings > Privacy & Data." },
      { subtitle: "Deletion", text: "You can delete individual conversations, documents, and memories at any time. Full account deletion removes all associated data." },
      { subtitle: "Correction", text: "You can update your profile information, memories, and preferences at any time through Settings." },
      { subtitle: "Consent Withdrawal", text: "You can withdraw consent for specific data processing activities (voice, document upload, AI chat) through Settings > Privacy & Data." },
    ],
  },
  {
    id: "security",
    icon: <Lock className="w-5 h-5" />,
    title: "Security Measures",
    content: [
      { subtitle: "Encryption", text: "All data is encrypted in transit (TLS 1.3) and at rest (AES-256). Database connections use SSL." },
      { subtitle: "Access Control", text: "Role-based access control ensures that only authorized users can access data. Professional and management roles have tiered access with full audit logging." },
      { subtitle: "PII Protection", text: "Sensitive information is automatically detected and masked before being sent to AI models or stored in audit logs." },
      { subtitle: "Infrastructure", text: "Our infrastructure is hosted on secure cloud providers with SOC 2 compliance. Regular security audits are conducted." },
    ],
  },
];

export default function Privacy() {
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="border-b border-border/50 bg-card/30 backdrop-blur-sm sticky top-0 z-30 relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(ellipse at 20% 50%, oklch(0.76 0.14 80 / 0.15) 0%, transparent 70%)' }} />
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/chat")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <Shield className="w-4 h-4 text-accent" />
          <h1 className="text-sm font-semibold">Privacy Policy</h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Intro */}
        <div className="mb-10">
          <h1 className="text-2xl font-bold mb-3">Privacy Policy</h1>
          <p className="text-muted-foreground text-sm leading-relaxed max-w-2xl">
            Stewardly is committed to protecting your privacy. This policy explains what data we collect,
            how we process it, how long we retain it, and what rights you have over your information.
            We believe in transparency and give you full control over your data.
          </p>
          <p className="text-muted-foreground/70 text-xs mt-3">Last updated: March 20, 2026</p>
        </div>

        {/* Quick navigation */}
        <div className="flex flex-wrap gap-2 mb-8">
          {SECTIONS.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-card border border-border/50 text-xs text-muted-foreground hover:text-foreground hover:border-accent/30 transition-colors"
            >
              {s.icon}
              {s.title}
            </a>
          ))}
        </div>

        {/* Sections */}
        <div className="space-y-10">
          {SECTIONS.map((section) => (
            <section key={section.id} id={section.id}>
              <div className="flex items-center gap-2 mb-4">
                <div className="p-2 rounded-lg bg-accent/10 text-accent">{section.icon}</div>
                <h2 className="text-lg font-semibold">{section.title}</h2>
              </div>
              <div className="space-y-4 pl-2 border-l-2 border-border/30 ml-4">
                {section.content.map((item, i) => (
                  <div key={i} className="pl-4">
                    <h3 className="text-sm font-medium mb-1">{item.subtitle}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{item.text}</p>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>

        {/* AI-Specific Disclosures */}
        <section className="mt-10 p-6 rounded-xl bg-card border border-border/50">
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Shield className="w-5 h-5 text-accent" />
            AI-Specific Disclosures
          </h2>
          <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
            <p>
              Stewardly uses artificial intelligence to provide advisory services. All AI-generated responses
              are clearly marked with an "AI" badge. The AI does not make autonomous financial decisions
              on your behalf.
            </p>
            <p>
              For financial advisory interactions, responses are subject to compliance review and may be
              flagged for human professional review based on confidence scoring. High-stakes financial
              recommendations always include appropriate disclaimers.
            </p>
            <p>
              The AI models used by Stewardly do not retain your personal data between sessions. Your
              conversation context is assembled fresh for each interaction from your stored profile,
              memories, and documents.
            </p>
          </div>
        </section>

        {/* Contact */}
        <section className="mt-10 mb-16 p-6 rounded-xl bg-accent/5 border border-accent/20">
          <h2 className="text-lg font-semibold mb-2">Questions or Concerns?</h2>
          <p className="text-sm text-muted-foreground mb-4">
            If you have questions about this privacy policy or want to exercise your data rights,
            you can reach us through the in-app Help & Support page or manage your data directly
            in Settings.
          </p>
          <div className="flex gap-3">
            <Button size="sm" variant="outline" onClick={() => navigate("/help")}>
              Help & Support
            </Button>
            <Button size="sm" variant="outline" onClick={() => navigate("/settings/privacy")}>
              Privacy Settings
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
