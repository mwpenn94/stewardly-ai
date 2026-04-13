/**
 * ReasoningChain Component
 * Displays collapsible reasoning transparency for AI responses.
 * Shows the chain of thought, data sources consulted, and confidence breakdown.
 */
import { useState } from "react";
import {
  ChevronDown, ChevronUp, Brain, Database, Shield, BookOpen,
  Info, Sparkles, TrendingUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ReasoningStep {
  label: string;
  detail: string;
  icon?: "data" | "compliance" | "knowledge" | "analysis" | "model";
  confidence?: number;
}

interface ReasoningChainProps {
  confidenceScore: number;
  complianceStatus?: "approved" | "pending" | "flagged";
  focus?: string;
  mode?: string;
  hasRAG?: boolean;
  hasSuitability?: boolean;
  responseLength?: number;
}

const STEP_ICONS = {
  data: <Database className="w-3 h-3" />,
  compliance: <Shield className="w-3 h-3" />,
  knowledge: <BookOpen className="w-3 h-3" />,
  analysis: <TrendingUp className="w-3 h-3" />,
  model: <Sparkles className="w-3 h-3" />,
};

function buildReasoningSteps(props: ReasoningChainProps): ReasoningStep[] {
  const steps: ReasoningStep[] = [];

  // Step 1: Input analysis
  steps.push({
    label: "Query Analysis",
    detail: `Classified as ${props.focus || "general"} focus in ${props.mode || "client"} mode`,
    icon: "analysis",
    confidence: 0.95,
  });

  // Step 2: Knowledge retrieval
  if (props.hasRAG) {
    steps.push({
      label: "Knowledge Base Retrieval",
      detail: "Retrieved relevant context from uploaded documents and knowledge base via RAG",
      icon: "knowledge",
      confidence: 0.85,
    });
  } else {
    steps.push({
      label: "Knowledge Base",
      detail: "No matching documents found in knowledge base; using general training data",
      icon: "knowledge",
      confidence: 0.6,
    });
  }

  // Step 3: Suitability check
  if (props.hasSuitability) {
    steps.push({
      label: "Suitability Profile",
      detail: "Applied user's suitability profile (risk tolerance, goals, time horizon) to personalize response",
      icon: "data",
      confidence: 0.9,
    });
  } else {
    steps.push({
      label: "Suitability Profile",
      detail: "No suitability assessment completed; response uses general financial guidance",
      icon: "data",
      confidence: 0.5,
    });
  }

  // Step 4: AI generation
  steps.push({
    label: "AI Response Generation",
    detail: `Generated ${props.responseLength ? (props.responseLength > 500 ? "detailed" : "concise") : ""} response using premium language model`,
    icon: "model",
    confidence: props.confidenceScore,
  });

  // Step 5: Compliance check
  const complianceDetail = props.complianceStatus === "approved"
    ? "Response passed automated compliance screening"
    : props.complianceStatus === "flagged"
    ? "Response flagged for human review — may contain financial advice requiring verification"
    : "Response pending compliance review";
  steps.push({
    label: "Compliance Screening",
    detail: complianceDetail,
    icon: "compliance",
    confidence: props.complianceStatus === "approved" ? 0.95 : props.complianceStatus === "flagged" ? 0.4 : 0.7,
  });

  return steps;
}

export function ReasoningChain(props: ReasoningChainProps) {
  const [expanded, setExpanded] = useState(false);
  const steps = buildReasoningSteps(props);

  const confidenceLabel = props.confidenceScore >= 0.8 ? "High" : props.confidenceScore >= 0.6 ? "Medium" : "Low";
  const confidenceColor = props.confidenceScore >= 0.8 ? "text-green-400" : props.confidenceScore >= 0.6 ? "text-yellow-400" : "text-red-400";
  const confidenceBg = props.confidenceScore >= 0.8 ? "bg-green-500/10" : props.confidenceScore >= 0.6 ? "bg-yellow-500/10" : "bg-red-500/10";

  return (
    <div className="mt-1.5">
      <button
        onClick={() => setExpanded(!expanded)}
        className={`flex items-center gap-1.5 text-[10px] px-2 py-1 rounded-md transition-all hover:bg-secondary/60 ${
          expanded ? "bg-secondary/40" : ""
        }`}
      >
        <Brain className="w-3 h-3 text-accent/70" />
        <span className="text-muted-foreground">Reasoning</span>
        <Badge variant="outline" className={`${confidenceBg} ${confidenceColor} text-[9px] px-1.5 py-0 border-0`}>
          {confidenceLabel} ({Math.round(props.confidenceScore * 100)}%)
        </Badge>
        {props.complianceStatus && props.complianceStatus !== "approved" && (
          <Badge variant="outline" className="bg-red-500/10 text-red-400 text-[9px] px-1.5 py-0 border-0">
            {props.complianceStatus === "flagged" ? "Flagged" : "Pending"}
          </Badge>
        )}
        {expanded ? <ChevronUp className="w-3 h-3 text-muted-foreground" /> : <ChevronDown className="w-3 h-3 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="mt-2 ml-1 border-l-2 border-accent/20 pl-3 space-y-2 animate-in slide-in-from-top-2 duration-200">
          {steps.map((step, i) => (
            <div key={i} className="flex items-start gap-2">
              <div className={`mt-0.5 p-1 rounded ${
                step.confidence && step.confidence >= 0.8 ? "bg-green-500/10 text-green-400" :
                step.confidence && step.confidence >= 0.6 ? "bg-yellow-500/10 text-yellow-400" :
                "bg-red-500/10 text-red-400"
              }`}>
                {step.icon ? STEP_ICONS[step.icon] : <Info className="w-3 h-3" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-medium text-foreground/80">{step.label}</span>
                  {step.confidence != null && (
                    <span className={`text-[9px] ${
                      step.confidence >= 0.8 ? "text-green-400/70" :
                      step.confidence >= 0.6 ? "text-yellow-400/70" :
                      "text-red-400/70"
                    }`}>
                      {Math.round(step.confidence * 100)}%
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground leading-relaxed">{step.detail}</p>
              </div>
            </div>
          ))}

          {/* Overall confidence breakdown */}
          <div className="pt-2 border-t border-border/30">
            <div className="flex items-center gap-2">
              <span className="text-[9px] text-muted-foreground">Overall Confidence:</span>
              <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    props.confidenceScore >= 0.8 ? "bg-green-400" :
                    props.confidenceScore >= 0.6 ? "bg-yellow-400" :
                    "bg-red-400"
                  }`}
                  style={{ width: `${props.confidenceScore * 100}%` }}
                />
              </div>
              <span className={`text-[9px] font-medium ${confidenceColor}`}>
                {Math.round(props.confidenceScore * 100)}%
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
