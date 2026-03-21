/**
 * Rich Response Component Library (C14)
 * Renders structured AI responses: calculator results, model outputs,
 * comparisons, timelines, quizzes, progress, knowledge cards, action confirmations.
 */
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Calculator, TrendingUp, BarChart3, BookOpen, CheckCircle2, XCircle,
  ChevronDown, ChevronUp, ExternalLink, Lightbulb, AlertTriangle,
  ArrowRight, Clock, Target, Award, Brain, Scale, Download,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────
export type RichResponseType =
  | "calculator_result"
  | "model_result"
  | "recommendation"
  | "plan"
  | "comparison"
  | "progress"
  | "quiz"
  | "action_confirmation"
  | "knowledge_card"
  | "timeline";

export interface RichResponseData {
  type: RichResponseType;
  title: string;
  data: any;
}

// ─── Main Dispatcher ─────────────────────────────────────────────────────────
export function RichResponse({ response }: { response: RichResponseData }) {
  switch (response.type) {
    case "calculator_result": return <CalculatorResult data={response.data} title={response.title} />;
    case "model_result": return <ModelResult data={response.data} title={response.title} />;
    case "recommendation": return <RecommendationCard data={response.data} title={response.title} />;
    case "plan": return <PlanView data={response.data} title={response.title} />;
    case "comparison": return <ComparisonView data={response.data} title={response.title} />;
    case "progress": return <ProgressView data={response.data} title={response.title} />;
    case "quiz": return <QuizCard data={response.data} title={response.title} />;
    case "action_confirmation": return <ActionConfirmation data={response.data} title={response.title} />;
    case "knowledge_card": return <KnowledgeCard data={response.data} title={response.title} />;
    case "timeline": return <TimelineView data={response.data} title={response.title} />;
    default: return null;
  }
}

// ─── Calculator Result ───────────────────────────────────────────────────────
function CalculatorResult({ data, title }: { data: any; title: string }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <Card className="border-emerald-500/30 bg-emerald-500/5">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Calculator className="h-4 w-4 text-emerald-500" />
          <CardTitle className="text-sm">{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {data.primaryResult && (
          <div className="text-2xl font-bold text-emerald-400">
            {data.primaryResult.label}: {data.primaryResult.value}
          </div>
        )}
        {data.metrics && (
          <div className="grid grid-cols-2 gap-2">
            {data.metrics.map((m: any, i: number) => (
              <div key={i} className="rounded-md bg-background/50 p-2">
                <div className="text-xs text-muted-foreground">{m.label}</div>
                <div className="font-semibold">{m.value}</div>
              </div>
            ))}
          </div>
        )}
        {data.breakdown && (
          <>
            <Button variant="ghost" size="sm" onClick={() => setExpanded(!expanded)} className="w-full">
              {expanded ? <ChevronUp className="h-3 w-3 mr-1" /> : <ChevronDown className="h-3 w-3 mr-1" />}
              {expanded ? "Hide" : "Show"} Breakdown
            </Button>
            {expanded && (
              <div className="space-y-1 text-sm">
                {data.breakdown.map((b: any, i: number) => (
                  <div key={i} className="flex justify-between py-1 border-b border-border/30">
                    <span className="text-muted-foreground">{b.label}</span>
                    <span className="font-medium">{b.value}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
        {data.assumptions && (
          <div className="text-xs text-muted-foreground italic">
            Assumptions: {data.assumptions}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Model Result ────────────────────────────────────────────────────────────
function ModelResult({ data, title }: { data: any; title: string }) {
  return (
    <Card className="border-blue-500/30 bg-blue-500/5">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-blue-500" />
          <CardTitle className="text-sm">{title}</CardTitle>
          {data.confidence && (
            <Badge variant="outline" className="ml-auto text-xs">
              {Math.round(data.confidence * 100)}% confidence
            </Badge>
          )}
        </div>
        {data.modelName && <CardDescription className="text-xs">Model: {data.modelName}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-3">
        {data.score !== undefined && (
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span>Score</span>
              <span className="font-bold">{data.score}/100</span>
            </div>
            <Progress value={data.score} className="h-2" />
          </div>
        )}
        {data.factors && (
          <div className="space-y-1">
            {data.factors.map((f: any, i: number) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                {f.impact === "positive" ? (
                  <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />
                ) : f.impact === "negative" ? (
                  <XCircle className="h-3 w-3 text-red-500 shrink-0" />
                ) : (
                  <AlertTriangle className="h-3 w-3 text-yellow-500 shrink-0" />
                )}
                <span>{f.label}: {f.value}</span>
              </div>
            ))}
          </div>
        )}
        {data.recommendation && (
          <div className="rounded-md bg-blue-500/10 p-2 text-sm">
            <Lightbulb className="h-3 w-3 inline mr-1 text-blue-400" />
            {data.recommendation}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Recommendation Card ─────────────────────────────────────────────────────
function RecommendationCard({ data, title }: { data: any; title: string }) {
  return (
    <Card className="border-amber-500/30 bg-amber-500/5">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-amber-500" />
          <CardTitle className="text-sm">{title}</CardTitle>
          {data.priority && (
            <Badge variant={data.priority === "high" ? "destructive" : data.priority === "medium" ? "default" : "secondary"} className="ml-auto text-xs">
              {data.priority}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-sm">{data.summary}</p>
        {data.actions && (
          <div className="space-y-1">
            {data.actions.map((a: any, i: number) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <ArrowRight className="h-3 w-3 text-amber-500 shrink-0" />
                <span>{a}</span>
              </div>
            ))}
          </div>
        )}
        {data.rationale && (
          <div className="text-xs text-muted-foreground mt-2">
            <strong>Rationale:</strong> {data.rationale}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Plan View ───────────────────────────────────────────────────────────────
function PlanView({ data, title }: { data: any; title: string }) {
  return (
    <Card className="border-purple-500/30 bg-purple-500/5">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Scale className="h-4 w-4 text-purple-500" />
          <CardTitle className="text-sm">{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {data.steps?.map((step: any, i: number) => (
            <div key={i} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${step.completed ? "bg-green-500 text-white" : "bg-muted text-muted-foreground"}`}>
                  {i + 1}
                </div>
                {i < data.steps.length - 1 && <div className="w-px h-full bg-border mt-1" />}
              </div>
              <div className="pb-3">
                <div className="font-medium text-sm">{step.title}</div>
                {step.description && <div className="text-xs text-muted-foreground">{step.description}</div>}
                {step.timeline && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                    <Clock className="h-3 w-3" /> {step.timeline}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Comparison View ─────────────────────────────────────────────────────────
function ComparisonView({ data, title }: { data: any; title: string }) {
  return (
    <Card className="border-cyan-500/30 bg-cyan-500/5">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-cyan-500" />
          <CardTitle className="text-sm">{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        {data.items && data.items.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-1 text-muted-foreground font-medium">Feature</th>
                  {data.items.map((item: any, i: number) => (
                    <th key={i} className="text-center py-1 font-medium">{item.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.dimensions?.map((dim: string, di: number) => (
                  <tr key={di} className="border-b border-border/30">
                    <td className="py-1 text-muted-foreground">{dim}</td>
                    {data.items.map((item: any, ii: number) => (
                      <td key={ii} className="text-center py-1">{item.values?.[di] ?? "—"}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data.winner && (
          <div className="mt-2 rounded-md bg-cyan-500/10 p-2 text-sm flex items-center gap-2">
            <Award className="h-4 w-4 text-cyan-400" />
            <span>Best match: <strong>{data.winner}</strong></span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Progress View ───────────────────────────────────────────────────────────
function ProgressView({ data, title }: { data: any; title: string }) {
  return (
    <Card className="border-green-500/30 bg-green-500/5">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-green-500" />
          <CardTitle className="text-sm">{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {data.overall !== undefined && (
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span>Overall Progress</span>
              <span className="font-bold">{data.overall}%</span>
            </div>
            <Progress value={data.overall} className="h-3" />
          </div>
        )}
        {data.categories && (
          <div className="space-y-2">
            {data.categories.map((cat: any, i: number) => (
              <div key={i} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{cat.label}</span>
                  <span>{cat.value}%</span>
                </div>
                <Progress value={cat.value} className="h-1.5" />
              </div>
            ))}
          </div>
        )}
        {data.nextMilestone && (
          <div className="text-xs text-muted-foreground">
            Next milestone: {data.nextMilestone}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Quiz Card ───────────────────────────────────────────────────────────────
function QuizCard({ data, title }: { data: any; title: string }) {
  const [selected, setSelected] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);

  return (
    <Card className="border-violet-500/30 bg-violet-500/5">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-violet-500" />
          <CardTitle className="text-sm">{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm font-medium">{data.question}</p>
        <div className="space-y-1.5">
          {data.options?.map((opt: string, i: number) => (
            <button
              key={i}
              onClick={() => { if (!revealed) setSelected(i); }}
              className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                revealed
                  ? i === data.correctIndex
                    ? "bg-green-500/20 border border-green-500/40"
                    : i === selected
                      ? "bg-red-500/20 border border-red-500/40"
                      : "bg-muted/30"
                  : i === selected
                    ? "bg-violet-500/20 border border-violet-500/40"
                    : "bg-muted/30 hover:bg-muted/50"
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
        {selected !== null && !revealed && (
          <Button size="sm" onClick={() => setRevealed(true)} className="w-full">
            Check Answer
          </Button>
        )}
        {revealed && data.explanation && (
          <div className="rounded-md bg-violet-500/10 p-2 text-sm">
            <Lightbulb className="h-3 w-3 inline mr-1 text-violet-400" />
            {data.explanation}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Action Confirmation ─────────────────────────────────────────────────────
function ActionConfirmation({ data, title }: { data: any; title: string }) {
  const [confirmed, setConfirmed] = useState(false);
  return (
    <Card className="border-orange-500/30 bg-orange-500/5">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-orange-500" />
          <CardTitle className="text-sm">{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm">{data.description}</p>
        {data.impacts && (
          <div className="space-y-1">
            {data.impacts.map((impact: string, i: number) => (
              <div key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                <ArrowRight className="h-3 w-3 shrink-0" />
                <span>{impact}</span>
              </div>
            ))}
          </div>
        )}
        {!confirmed ? (
          <div className="flex gap-2">
            <Button size="sm" variant="destructive" onClick={() => setConfirmed(true)}>
              Confirm
            </Button>
            <Button size="sm" variant="outline">Cancel</Button>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm text-green-500">
            <CheckCircle2 className="h-4 w-4" /> Action confirmed
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Knowledge Card ──────────────────────────────────────────────────────────
function KnowledgeCard({ data, title }: { data: any; title: string }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <Card className="border-teal-500/30 bg-teal-500/5">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-teal-500" />
          <CardTitle className="text-sm">{title}</CardTitle>
          {data.category && <Badge variant="outline" className="ml-auto text-xs">{data.category}</Badge>}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-sm">{expanded ? data.fullContent : data.summary}</p>
        {data.fullContent && data.fullContent !== data.summary && (
          <Button variant="ghost" size="sm" onClick={() => setExpanded(!expanded)}>
            {expanded ? "Show less" : "Read more"}
          </Button>
        )}
        {data.sources && (
          <div className="flex flex-wrap gap-1">
            {data.sources.map((s: any, i: number) => (
              <Badge key={i} variant="secondary" className="text-xs">
                {s.name || s}
              </Badge>
            ))}
          </div>
        )}
        {data.relatedTopics && (
          <div className="text-xs text-muted-foreground">
            Related: {data.relatedTopics.join(", ")}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Timeline View ───────────────────────────────────────────────────────────
function TimelineView({ data, title }: { data: any; title: string }) {
  return (
    <Card className="border-indigo-500/30 bg-indigo-500/5">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-indigo-500" />
          <CardTitle className="text-sm">{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-0">
          {data.events?.map((event: any, i: number) => (
            <div key={i} className="flex gap-3 pb-3">
              <div className="flex flex-col items-center">
                <div className={`w-2 h-2 rounded-full mt-1.5 ${event.highlight ? "bg-indigo-500" : "bg-muted-foreground/40"}`} />
                {i < data.events.length - 1 && <div className="w-px flex-1 bg-border mt-1" />}
              </div>
              <div>
                <div className="text-xs text-muted-foreground">{event.date}</div>
                <div className="text-sm font-medium">{event.title}</div>
                {event.description && <div className="text-xs text-muted-foreground">{event.description}</div>}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Parse rich responses from AI message content ────────────────────────────
export function parseRichResponses(content: string): { text: string; responses: RichResponseData[] } {
  const responses: RichResponseData[] = [];
  let cleanText = content;

  // Match ```stewardly-rich {...} ``` blocks
  const richBlockRegex = /```stewardly-rich\s*\n([\s\S]*?)\n```/g;
  let match;
  while ((match = richBlockRegex.exec(content)) !== null) {
    try {
      const parsed = JSON.parse(match[1]);
      if (parsed.type && parsed.title) {
        responses.push(parsed as RichResponseData);
      }
    } catch {
      // Skip malformed blocks
    }
    cleanText = cleanText.replace(match[0], "");
  }

  return { text: cleanText.trim(), responses };
}
