/**
 * Relationships Hub (C25)
 * Consolidates: Professional Directory, COI Network, Meetings, Email Campaigns
 * Tabs: Network | Meetings | Outreach
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Link } from "wouter";
import {
  ArrowLeft, Users, Calendar, Mail, Search, Filter, Plus,
  UserPlus, Video, Phone, MessageSquare, Clock, Star,
  Building2, Loader2, ChevronRight, Globe, MapPin,
  Send, FileText, BarChart3, Eye,
} from "lucide-react";

export default function RelationshipsHub() {
  const [activeTab, setActiveTab] = useState("network");
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container py-4">
          <div className="flex items-center gap-3">
            <Link href="/chat">
              <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
            </Link>
            <div>
              <h1 className="text-xl font-bold">Relationships</h1>
              <p className="text-sm text-muted-foreground">Network, meetings, and outreach</p>
            </div>
          </div>
        </div>
      </div>

      <div className="container py-6">
        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <QuickStat icon={Users} label="Connections" value="—" color="text-blue-500" />
          <QuickStat icon={Calendar} label="Upcoming" value="—" color="text-purple-500" />
          <QuickStat icon={Mail} label="Campaigns" value="—" color="text-green-500" />
          <QuickStat icon={Star} label="COI Partners" value="—" color="text-amber-500" />
        </div>

        {/* Search */}
        <div className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search contacts, meetings, campaigns..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
          </div>
          <Button variant="outline" size="icon"><Filter className="h-4 w-4" /></Button>
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
  );
}

function QuickStat({ icon: Icon, label, value, color }: { icon: any; label: string; value: string; color: string }) {
  return (
    <Card>
      <CardContent className="p-3 flex items-center gap-3">
        <Icon className={`h-5 w-5 ${color}`} />
        <div>
          <div className="text-lg font-bold">{value}</div>
          <div className="text-xs text-muted-foreground">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function NetworkSection({ searchQuery }: { searchQuery: string }) {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold">Professional Network</h3>
        <Button size="sm" onClick={() => toast.info("Feature coming soon")}>
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
            {[
              { role: "CPAs / Accountants", icon: Building2, count: "—" },
              { role: "Estate Attorneys", icon: FileText, count: "—" },
              { role: "Property & Casualty", icon: Globe, count: "—" },
              { role: "Mortgage Brokers", icon: MapPin, count: "—" },
              { role: "Business Brokers", icon: Building2, count: "—" },
              { role: "Other Advisors", icon: Users, count: "—" },
            ].map((cat) => (
              <div key={cat.role} className="p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => toast.info("Ask the AI about your " + cat.role + " network")}>
                <cat.icon className="h-4 w-4 text-muted-foreground mb-1" />
                <div className="text-sm font-medium">{cat.role}</div>
                <div className="text-xs text-muted-foreground">{cat.count} contacts</div>
              </div>
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
            <span className="text-xs">Ask the AI to help manage your client book.</span>
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
        <Button size="sm" onClick={() => toast.info("Ask the AI to schedule a meeting")}>
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
            <span className="text-xs">Ask the AI to schedule a video consultation.</span>
          </div>
        </CardContent>
      </Card>

      {/* Meeting Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-2">
          <Button variant="outline" className="h-auto py-3 flex-col gap-1" onClick={() => toast.info("Ask the AI to schedule a video call")}>
            <Video className="h-4 w-4" />
            <span className="text-xs">Video Call</span>
          </Button>
          <Button variant="outline" className="h-auto py-3 flex-col gap-1" onClick={() => toast.info("Ask the AI to schedule a phone call")}>
            <Phone className="h-4 w-4" />
            <span className="text-xs">Phone Call</span>
          </Button>
          <Button variant="outline" className="h-auto py-3 flex-col gap-1" onClick={() => toast.info("Ask the AI to prepare a meeting brief")}>
            <FileText className="h-4 w-4" />
            <span className="text-xs">Pre-Meeting Brief</span>
          </Button>
          <Button variant="outline" className="h-auto py-3 flex-col gap-1" onClick={() => toast.info("Ask the AI to create meeting notes")}>
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
        <h3 className="font-semibold">Email Campaigns</h3>
        <Button size="sm" onClick={() => toast.info("Ask the AI to create an email campaign")}>
          <Plus className="h-3 w-3 mr-1" /> New Campaign
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Active Campaigns</CardTitle>
          <CardDescription>Email campaigns and their performance</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground text-sm">
            <Mail className="h-8 w-8 mx-auto mb-2 opacity-50" />
            No active campaigns. Ask the AI to help create one.
            <br />
            <span className="text-xs">AI can draft, schedule, and track email campaigns.</span>
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
            { name: "Client Newsletter", icon: FileText },
            { name: "Market Update", icon: BarChart3 },
            { name: "COI Outreach", icon: Users },
            { name: "Follow-Up", icon: Send },
          ].map((template) => (
            <Button key={template.name} variant="outline" className="h-auto py-3 flex-col gap-1" onClick={() => toast.info("Ask the AI to create a " + template.name)}>
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
          <div className="grid grid-cols-3 gap-3">
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
