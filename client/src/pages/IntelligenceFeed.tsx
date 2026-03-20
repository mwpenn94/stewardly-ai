import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Bell, Brain, TrendingUp, AlertTriangle, Lightbulb,
  CheckCircle2, Clock, ChevronRight, Sparkles,
  MessageSquare, Target, Shield, Loader2,
} from "lucide-react";

const PRIORITY_COLORS: Record<string, string> = {
  critical: "bg-red-500/15 text-red-400 border-red-500/30",
  high: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  medium: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  low: "bg-slate-500/15 text-slate-400 border-slate-500/30",
};

const TYPE_ICONS: Record<string, typeof Bell> = {
  nudge: MessageSquare,
  celebration: Sparkles,
  reminder: Clock,
  education: Lightbulb,
  insight: Brain,
  alert: AlertTriangle,
  recommendation: Target,
  compliance: Shield,
  milestone: CheckCircle2,
  risk_change: TrendingUp,
  opportunity: Lightbulb,
};

function CoachingCard({ message, onMarkRead }: { message: any; onMarkRead: (id: string) => void }) {
  const Icon = TYPE_ICONS[message.messageType] || Bell;
  const priorityClass = PRIORITY_COLORS[message.priority] || PRIORITY_COLORS.medium;

  return (
    <Card className={`border transition-all hover:shadow-md ${message.readAt ? "opacity-60" : ""}`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${priorityClass}`}>
            <Icon className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="text-sm font-semibold truncate">{message.title}</h4>
              <Badge variant="outline" className="text-[9px] shrink-0">
                {message.messageType}
              </Badge>
              {!message.readAt && (
                <span className="w-2 h-2 rounded-full bg-accent shrink-0" />
              )}
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">{message.content}</p>
            {message.category && (
              <span className="text-[10px] text-muted-foreground/70 mt-1 block">{message.category}</span>
            )}
          </div>
          {!message.readAt && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-[10px] shrink-0"
              onClick={() => onMarkRead(message.id)}
            >
              <CheckCircle2 className="w-3 h-3 mr-1" /> Read
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function PropagationEventCard({ event, onAction }: { event: any; onAction: (id: string, action: string) => void }) {
  const Icon = TYPE_ICONS[event.eventType] || Bell;
  const priorityClass = PRIORITY_COLORS[event.priority] || PRIORITY_COLORS.medium;
  const payload = typeof event.payload === "string" ? JSON.parse(event.payload) : event.payload;

  return (
    <Card className="border transition-all hover:shadow-md">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${priorityClass}`}>
            <Icon className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline" className="text-[9px]">
                {event.sourceLayer} → {event.targetLayer}
              </Badge>
              <Badge variant="outline" className="text-[9px]">
                {event.eventType}
              </Badge>
              <Badge className={`text-[9px] ${priorityClass}`}>
                {event.priority}
              </Badge>
            </div>
            {payload?.insight && (
              <p className="text-xs text-muted-foreground leading-relaxed mt-1">{payload.insight}</p>
            )}
            {payload?.type && (
              <p className="text-xs text-muted-foreground leading-relaxed mt-1">
                {payload.type}: {payload.filename || payload.model || ""}
              </p>
            )}
            <div className="flex items-center gap-1 mt-2">
              <Button variant="outline" size="sm" className="h-6 text-[10px]" onClick={() => onAction(event.id, "acknowledge")}>
                Acknowledge
              </Button>
              <Button variant="outline" size="sm" className="h-6 text-[10px]" onClick={() => onAction(event.id, "act")}>
                Act
              </Button>
              <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => onAction(event.id, "dismiss")}>
                Dismiss
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function IntelligenceFeed() {
  const { user, isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState("coaching");

  const coachingQuery = trpc.propagation.getCoachingMessages.useQuery(
    { limit: 30 },
    { enabled: isAuthenticated },
  );

  const eventsQuery = trpc.propagation.getMyEvents.useQuery(
    { limit: 30 },
    { enabled: isAuthenticated },
  );

  const markRead = trpc.propagation.markCoachingRead.useMutation({
    onSuccess: () => {
      coachingQuery.refetch();
      toast.success("Marked as read");
    },
  });

  const recordAction = trpc.propagation.recordAction.useMutation({
    onSuccess: () => {
      eventsQuery.refetch();
      toast.success("Action recorded");
    },
  });

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md">
          <CardContent className="p-8 text-center">
            <Brain className="w-12 h-12 mx-auto mb-4 text-accent" />
            <h2 className="text-lg font-semibold mb-2">Intelligence Feed</h2>
            <p className="text-sm text-muted-foreground">
              Sign in to view personalized coaching messages, alerts, and intelligence insights.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const coachingMessages = coachingQuery.data ?? [];
  const events = eventsQuery.data ?? [];
  const unreadCoaching = coachingMessages.filter((m: any) => !m.readAt).length;

  return (
    <div className="container max-w-4xl py-8">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-accent/15 flex items-center justify-center">
            <Brain className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Intelligence Feed</h1>
            <p className="text-sm text-muted-foreground">
              Coaching messages, alerts, and cross-layer intelligence
            </p>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="coaching" className="gap-1.5">
            <MessageSquare className="w-3.5 h-3.5" />
            Coaching
            {unreadCoaching > 0 && (
              <Badge className="ml-1 h-4 px-1.5 text-[9px] bg-accent">{unreadCoaching}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="events" className="gap-1.5">
            <Bell className="w-3.5 h-3.5" />
            Events
            {events.length > 0 && (
              <Badge variant="outline" className="ml-1 h-4 px-1.5 text-[9px]">{events.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="coaching">
          {coachingQuery.isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : coachingMessages.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Sparkles className="w-10 h-10 mx-auto mb-3 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">No coaching messages yet.</p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  Messages will appear as the AI learns more about your financial profile.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {coachingMessages.map((msg: any) => (
                <CoachingCard
                  key={msg.id}
                  message={msg}
                  onMarkRead={(id) => markRead.mutate({ messageId: id })}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="events">
          {eventsQuery.isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : events.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Bell className="w-10 h-10 mx-auto mb-3 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">No intelligence events yet.</p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  Events will appear as data flows through integrations and models.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {events.map((evt: any) => (
                <PropagationEventCard
                  key={evt.id}
                  event={evt}
                  onAction={(id, action) => recordAction.mutate({ eventId: id, actionType: action as any })}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
