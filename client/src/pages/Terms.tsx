import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";

export default function Terms() {
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen bg-background">
      <header className="h-12 border-b border-border flex items-center px-4">
        <Button variant="ghost" size="sm" className="gap-2 text-xs" onClick={() => navigate("/")}>
          <ArrowLeft className="w-3.5 h-3.5" /> Back
        </Button>
        <span className="text-sm font-medium ml-2">Terms of Service & Privacy Policy</span>
      </header>

      <ScrollArea className="h-[calc(100vh-3rem)]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-8">
          {/* Terms of Service */}
          <section>
            <h1 className="text-2xl font-semibold mb-1">Terms of Service</h1>
            <p className="text-xs text-muted-foreground mb-6">Last updated: March 2026</p>

            <div className="space-y-6 text-sm text-foreground/85 leading-relaxed">
              <div>
                <h2 className="text-base font-medium mb-2">1. Acceptance of Terms</h2>
                <p>By accessing or using this Stewardly platform ("Service"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, you may not use the Service. Your continued use of the Service constitutes acceptance of any updates to these Terms.</p>
              </div>

              <div>
                <h2 className="text-base font-medium mb-2">2. Description of Service</h2>
                <p>The Service provides an AI-powered personal assistant with general knowledge and financial expertise capabilities. The Service includes conversational AI, document analysis, financial calculators, suitability assessments, and related tools. The AI generates responses based on its training data and any documents or information you provide.</p>
              </div>

              <div>
                <h2 className="text-base font-medium mb-2">3. User Accounts and Roles</h2>
                <p>Access to the Service requires authentication. Users may be assigned roles (user, advisor, manager, or admin) that determine feature access and data visibility. You are responsible for maintaining the confidentiality of your account credentials and for all activities under your account.</p>
              </div>

              <div>
                <h2 className="text-base font-medium mb-2">4. Your Content and Data</h2>
                <p className="mb-2"><strong>Ownership:</strong> You retain ownership of all content you upload, including documents, images, conversation inputs, suitability assessment responses, and any other materials ("Your Content").</p>
                <p className="mb-2"><strong>License Grant:</strong> By uploading content, you grant the Service a limited, non-exclusive license to process, analyze, store, and use Your Content solely for the purpose of providing and improving the Service to you and, where applicable, to authorized professionals, managers, and administrators within your organization's access chain.</p>
                <p className="mb-2"><strong>Data Access Chain:</strong> Depending on your visibility settings, Your Content and derived insights (including suitability assessments, uploaded documents, and conversation context) may be accessible to:</p>
                <ul className="list-disc list-inside ml-4 space-y-1">
                  <li><strong>Private:</strong> Only you can access this data</li>
                  <li><strong>Professional:</strong> You and your assigned financial professional</li>
                  <li><strong>Management:</strong> You, your professional, and their management</li>
                  <li><strong>Admin:</strong> All authorized personnel including administrators</li>
                </ul>
                <p className="mt-2">You control the visibility level of each document and can change it at any time. Suitability assessment data defaults to "Professional" visibility to enable your advisor to serve you effectively.</p>
              </div>

              <div>
                <h2 className="text-base font-medium mb-2">5. AI-Generated Content Disclaimer</h2>
                <p className="mb-2"><strong>Not Professional Advice:</strong> AI-generated responses are for informational purposes only and do not constitute financial, legal, tax, or investment advice. Always consult qualified professionals before making financial decisions.</p>
                <p className="mb-2"><strong>Accuracy:</strong> While we strive for accuracy, AI responses may contain errors, omissions, or outdated information. The Service provides confidence scores as indicators, but these are estimates and should not be relied upon as guarantees of accuracy.</p>
                <p><strong>No Guarantees:</strong> Past performance data, projections, and calculations provided by the Service are illustrative only and do not guarantee future results.</p>
              </div>

              <div>
                <h2 className="text-base font-medium mb-2">6. Acceptable Use</h2>
                <p>You agree not to: (a) use the Service for any unlawful purpose; (b) upload content that infringes on third-party rights; (c) attempt to reverse-engineer or extract the AI models; (d) use the Service to generate misleading financial advice for others; (e) share your account credentials; or (f) attempt to circumvent access controls or role-based restrictions.</p>
              </div>

              <div>
                <h2 className="text-base font-medium mb-2">7. Data Retention and Deletion</h2>
                <p>Your Content is retained for as long as your account is active. You may delete individual documents, conversations, and memories at any time. Upon account deletion, we will remove your personal data within 30 days, except where retention is required by law or for legitimate business purposes (such as audit trails required by financial regulations).</p>
              </div>

              <div>
                <h2 className="text-base font-medium mb-2">8. Service Modifications</h2>
                <p>We reserve the right to modify, suspend, or discontinue any part of the Service at any time. We will make reasonable efforts to notify you of material changes. Continued use after changes constitutes acceptance of the modified Terms.</p>
              </div>

              <div>
                <h2 className="text-base font-medium mb-2">9. Limitation of Liability</h2>
                <p>To the maximum extent permitted by law, the Service and its operators shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the Service, including but not limited to financial losses resulting from reliance on AI-generated content.</p>
              </div>

              <div>
                <h2 className="text-base font-medium mb-2">10. Indemnification</h2>
                <p>You agree to indemnify and hold harmless the Service operators from any claims, damages, or expenses arising from your use of the Service, your violation of these Terms, or your violation of any third-party rights.</p>
              </div>
            </div>
          </section>

          <Separator />

          {/* Privacy Policy */}
          <section>
            <h1 className="text-2xl font-semibold mb-1">Privacy Policy</h1>
            <p className="text-xs text-muted-foreground mb-6">Last updated: March 2026</p>

            <div className="space-y-6 text-sm text-foreground/85 leading-relaxed">
              <div>
                <h2 className="text-base font-medium mb-2">1. Information We Collect</h2>
                <p className="mb-2">We collect the following categories of information:</p>
                <ul className="list-disc list-inside ml-4 space-y-1">
                  <li><strong>Account Information:</strong> Name, email address, and authentication credentials provided during registration</li>
                  <li><strong>Content You Provide:</strong> Documents, images, conversation messages, suitability assessment responses, voice inputs, and any other content you upload or input</li>
                  <li><strong>Usage Data:</strong> Interaction patterns, feature usage, timestamps, and session information</li>
                  <li><strong>Derived Data:</strong> AI-generated insights, style profiles, memory entries, confidence scores, and suitability profiles created from your interactions</li>
                  <li><strong>Technical Data:</strong> Browser type, device information, and IP address for security and service optimization</li>
                </ul>
              </div>

              <div>
                <h2 className="text-base font-medium mb-2">2. How We Use Your Information</h2>
                <p className="mb-2">Your information is used to:</p>
                <ul className="list-disc list-inside ml-4 space-y-1">
                  <li>Provide and personalize the AI assistant experience</li>
                  <li>Process and analyze uploaded documents to improve response quality</li>
                  <li>Generate suitability profiles and financial insights</li>
                  <li>Enable authorized professionals to serve you effectively (based on your visibility settings)</li>
                  <li>Maintain conversation history and memory for continuity</li>
                  <li>Improve the Service through aggregated, anonymized usage analytics</li>
                  <li>Ensure security and prevent unauthorized access</li>
                </ul>
              </div>

              <div>
                <h2 className="text-base font-medium mb-2">3. Data Sharing and Access</h2>
                <p className="mb-2">We do not sell your personal information. Your data may be shared with:</p>
                <ul className="list-disc list-inside ml-4 space-y-1">
                  <li><strong>Authorized Personnel:</strong> Based on the visibility level you set for each piece of content (private, professional, management, or admin)</li>
                  <li><strong>AI Processing:</strong> Your content is processed by AI models to generate responses. Conversations and documents are used as context for your personalized experience</li>
                  <li><strong>Service Providers:</strong> Third-party infrastructure providers that host and process data on our behalf, subject to confidentiality agreements</li>
                  <li><strong>Legal Requirements:</strong> When required by law, regulation, or legal process</li>
                </ul>
              </div>

              <div>
                <h2 className="text-base font-medium mb-2">4. Your Rights and Controls</h2>
                <p className="mb-2">You have the right to:</p>
                <ul className="list-disc list-inside ml-4 space-y-1">
                  <li><strong>Access:</strong> View all data we hold about you through your account settings</li>
                  <li><strong>Control Visibility:</strong> Set and change visibility levels for each document and data point</li>
                  <li><strong>Delete:</strong> Remove individual documents, conversations, memories, and your suitability profile at any time</li>
                  <li><strong>Export:</strong> Request a copy of your data in a portable format</li>
                  <li><strong>Withdraw Consent:</strong> Revoke consent for data processing (which may limit Service functionality)</li>
                  <li><strong>Account Deletion:</strong> Request complete account and data deletion</li>
                </ul>
              </div>

              <div>
                <h2 className="text-base font-medium mb-2">5. Data Security</h2>
                <p>We implement industry-standard security measures including encryption in transit and at rest, access controls, and regular security assessments. However, no system is completely secure, and we cannot guarantee absolute security of your data.</p>
              </div>

              <div>
                <h2 className="text-base font-medium mb-2">6. Data Retention</h2>
                <p>We retain your data for as long as your account is active or as needed to provide the Service. Conversation data, documents, and derived insights are retained until you delete them or close your account. Audit trail data may be retained longer as required by financial regulations.</p>
              </div>

              <div>
                <h2 className="text-base font-medium mb-2">7. Children's Privacy</h2>
                <p>The Service is not intended for users under the age of 18. We do not knowingly collect personal information from children.</p>
              </div>

              <div>
                <h2 className="text-base font-medium mb-2">8. Changes to This Policy</h2>
                <p>We may update this Privacy Policy from time to time. We will notify you of material changes through the Service or via email. Your continued use after changes constitutes acceptance of the updated policy.</p>
              </div>

              <div>
                <h2 className="text-base font-medium mb-2">9. Contact</h2>
                <p>For privacy-related inquiries, data access requests, or concerns, please contact your account administrator or use the in-app support features.</p>
              </div>
            </div>
          </section>

          <div className="pb-8" />
        </div>
      </ScrollArea>
    </div>
  );
}
