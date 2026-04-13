/**
 * Relationships Hub (C25)
 * Consolidates: Professional Directory, COI Network, Meetings, Email Campaigns
 * Tabs: Network | Meetings | Outreach
 */
import { useState } from "react";
import AppShell from "@/components/AppShell";
import { SEOHead } from "@/components/SEOHead";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Link } from "wouter";
import { navigateToChat } from "@/lib/navigateToChat";
import {
  Users, Calendar, Mail, Search, Filter, Plus,
  UserPlus, Video, Phone, MessageSquare, Clock, Star,
  Building2, Loader2, ChevronRight, Globe, MapPin,
  Send, FileText, BarChart3, Eye,
} from "lucide-react";

export default function RelationshipsHub() {
  const [activeTab, setActiveTab] = useState("network");
  const [searchQuery, setSearchQuery] = useState("");

  // Wire to real data where available
  const leadsQ = trpc.leadPipeline.getPipeline.useQuery(undefined, { retry: false });
  const leadCount = ((leadsQ.data as any)?.leads ?? []).length;

  return (
    <AppShell title="Relationships">
      <SEOHead title="Relationships" description="Professional network, meetings, and outreach campaigns" />
    <div className="min-h-screen">
      {/* Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container py-4">
          <div>
            <h1 className="text-xl font-bold">Relationships</h1>
            <p className="text-sm text-muted-foreground">Network, meetings, and outreach</p>
          </div>
        </div>
      </div>

      <div className="container py-6">
        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <QuickStat icon={Users} label="Leads" value={String(leadCount)} color="text-blue-500" />
          <QuickStat icon={Calendar} label="Upcoming" value="0" color="text-purple-500" />
          <QuickStat icon={Mail} label="Campaigns" value="0" color="text-green-500" />
          <QuickStat icon={Star} label="COI Partners" value="0" color="text-amber-500" />
        </div>

        {/* Search */}
        <div className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search contacts, meetings, campaigns..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
          </div>
          <Button variant="outline" size="icon" aria-label="Filter"><Filter className="h-4 w-4" /></Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="network" className="gap-1">
              <Users className="h-3 w-3" /> Network
            </TabsTrigger>
            <TabsTrigger value="meetings" className="gap-1">
              <Calendar className="h-3 w-3" /> Meetings
            </TabsTrigger>
            <TabsTrigger value="outreach" className="gap-1">
              <Mail className="h-3 w-3" /> Outreach
            </TabsTrigger>
          </TabsList>

          <TabsContent value="network" className="space-y-4 mt-4">
            <NetworkSection searchQuery={searchQuery} />
          </TabsContent>

          <TabsContent value="meetings" className="space-y-4 mt-4">
            <MeetingsSection />
          </TabsContent>

          <TabsContent value="outreach" className="space-y-4 mt-4">
            <OutreachSection />
          </TabsContent>
        </Tabs>
      </div>
    </div>
    </AppShell>
  );
}

function QuickStat({ icon: Icon, label, value, color }: { icon: any; label: string; value: string; color: string }) {
  return (
    <Card>
      <CardContent className="p-3 flex items-center gap-3">
        <Icon className={`h-5 w-5 ${color}`} />
        <div>
          <div className="text-lg font-bold font-mono tabular-nums">{value}</div>
          <div className="text-xs text-muted-foreground">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function NetworkSection({ searchQuery }: { searchQuery: string }) {
  const coiCategories = [
    { role: "CPAs / Accountants", icon: Building2, prompt: "Help me manage my CPA and accountant network. Show me strategies for building referral relationships with accounting professionals and how to create mutual value." },
    { role: "Estate Attorneys", icon: FileText, prompt: "Help me build and manage my estate attorney network. What are best practices for collaborating with estate attorneys on client cases?" },
    { role: "Property & Casualty", icon: Globe, prompt: "Help me develop my P&C insurance network. How can I create cross-referral opportunities with property and casualty agents?" },
    { role: "Mortgage Brokers", icon: MapPin, prompt: "Help me expand my mortgage broker network. What strategies work best for building referral partnerships with mortgage professionals?" },
    { role: "Business Brokers", icon: Building2, prompt: "Help me connect with business brokers. How can I position my services to complement business transition and succession planning?" },
    { role: "Other Advisors", icon: Users, prompt: "Help me manage my broader professional network. Show me strategies for building relationships with other financial advisors and complementary professionals." },
  ];

  return (
    <div className="relative space-y-4">
      {/* Warm gold radial glow */}
      <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(ellipse at 30% 50%, oklch(0.76 0.14 80 / 0.15) 0%, transparent 70%)' }} />
      <div className="flex justify-between items-center">
        <h3 className="font-semibold">Professional Network</h3>
        <Button size="sm" onClick={() => navigateToChat("Help me add a new professional contact to my network. I need to record their name, firm, role, specialty, and how we're connected.")}>
          <UserPlus className="h-3 w-3 mr-1" /> Add Contact
        </Button>
      </div>

      {/* COI Network */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Centers of Influence</CardTitle>
          <CardDescription>Your professional referral network</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {coiCategories.map((cat) => (
              <button key={cat.role} type="button" className="p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer text-left" onClick={() => navigateToChat(cat.prompt)} aria-label={`Explore ${cat.role}`}>
                <cat.icon className="h-4 w-4 text-muted-foreground mb-1" />
                <div className="text-sm font-medium">{cat.role}</div>
                <div className="text-xs text-muted-foreground">Explore →</div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Client Book */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Client Book</CardTitle>
          <CardDescription>Your clients and their relationship status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground text-sm">
            <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
            Client relationships will appear here as you onboard clients.
            <br />
            <Button variant="link" size="sm" className="mt-1 text-xs" onClick={() => navigateToChat("Help me manage my client book. Show me how to organize clients, track relationship status, and identify opportunities for deeper engagement.")}>
              Ask the AI to help manage your client book →
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function MeetingsSection() {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold">Meetings</h3>
        <Button size="sm" onClick={() => navigateToChat("Help me schedule a meeting. I need to set up a consultation with a client or professional contact. Walk me through the details needed.")}>
          <Plus className="h-3 w-3 mr-1" /> Schedule
        </Button>
      </div>

      {/* Upcoming Meetings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Upcoming Meetings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground text-sm">
            <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
            No upcoming meetings scheduled.
            <br />
            <Button variant="link" size="sm" className="mt-1 text-xs" onClick={() => navigateToChat("Help me schedule a video consultation with a client. I need to set the agenda, prepare talking points, and send an invitation.")}>
              Ask the AI to schedule a consultation →
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Meeting Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-2">
          <Button variant="outline" className="h-auto py-3 flex-col gap-1" onClick={() => navigateToChat("Help me set up a video call with a client. I need to prepare an agenda, key discussion points, and any documents to share during the call.")}>
            <Video className="h-4 w-4" />
            <span className="text-xs">Video Call</span>
          </Button>
          <Button variant="outline" className="h-auto py-3 flex-col gap-1" onClick={() => navigateToChat("Help me prepare for a phone call with a client. Create a call script with key talking points, questions to ask, and follow-up items.")}>
            <Phone className="h-4 w-4" />
            <span className="text-xs">Phone Call</span>
          </Button>
          <Button variant="outline" className="h-auto py-3 flex-col gap-1" onClick={() => navigateToChat("Prepare a pre-meeting brief for my upcoming client meeting. Include the client's profile summary, recent interactions, open items, and recommended discussion topics.", "financial")}>
            <FileText className="h-4 w-4" />
            <span className="text-xs">Pre-Meeting Brief</span>
          </Button>
          <Button variant="outline" className="h-auto py-3 flex-col gap-1" onClick={() => navigateToChat("Help me create structured meeting notes. I'll provide the key points discussed, and you help me organize them into action items, decisions made, and follow-up tasks.")}>
            <MessageSquare className="h-4 w-4" />
            <span className="text-xs">Meeting Notes</span>
          </Button>
        </CardContent>
      </Card>

      {/* Past Meetings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Meeting History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-muted-foreground text-sm">
            <Clock className="h-6 w-6 mx-auto mb-2 opacity-50" />
            Past meetings with transcripts and notes will appear here.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function OutreachSection() {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold">Message Campaigns</h3>
        <Button size="sm" onClick={() => navigateToChat("Help me create a new in-app message campaign. I need to define the audience, craft the message, and set up the sending schedule. What type of campaign should we create?")}>
          <Plus className="h-3 w-3 mr-1" /> New Campaign
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Active Campaigns</CardTitle>
          <CardDescription>In-app message campaigns and their performance</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground text-sm">
            <Mail className="h-8 w-8 mx-auto mb-2 opacity-50" />
            No active campaigns.
            <br />
            <Button variant="link" size="sm" className="mt-1 text-xs" onClick={() => navigateToChat("Help me create my first in-app message campaign. I want to reach out to my client base with a professional notification.")}>
              Ask the AI to help create one →
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Campaign Templates */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Campaign Templates</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-2">
          {[
            { name: "Client Newsletter", icon: FileText, prompt: "Help me create a professional client newsletter. Include sections for market updates, firm news, educational content, and a personal note. Make it engaging and compliant." },
            { name: "Market Update", icon: BarChart3, prompt: "Draft a market update email for my clients. Cover recent market performance, economic outlook, and what it means for their portfolios. Keep it concise and actionable." },
            { name: "COI Outreach", icon: Users, prompt: "Help me draft a professional outreach email to potential Centers of Influence (CPAs, attorneys, etc.). I want to introduce my services and propose a mutually beneficial referral relationship." },
            { name: "Follow-Up", icon: Send, prompt: "Help me create a follow-up email template for after client meetings. Include a summary of what we discussed, action items, next steps, and a professional closing." },
          ].map((template) => (
            <Button key={template.name} variant="outline" className="h-auto py-3 flex-col gap-1" onClick={() => navigateToChat(template.prompt)}>
              <template.icon className="h-4 w-4" />
              <span className="text-xs">{template.name}</span>
            </Button>
          ))}
        </CardContent>
      </Card>

      {/* Campaign Analytics */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Campaign Analytics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="text-center p-3 rounded-lg bg-muted/30">
              <div className="text-lg font-bold">—</div>
              <div className="text-xs text-muted-foreground">Sent</div>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/30">
              <div className="text-lg font-bold">—</div>
              <div className="text-xs text-muted-foreground">Opened</div>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/30">
              <div className="text-lg font-bold">—</div>
              <div className="text-xs text-muted-foreground">Clicked</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
