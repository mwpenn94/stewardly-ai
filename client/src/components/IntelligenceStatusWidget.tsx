/**
 * IntelligenceStatusWidget — Shows AI system status on dashboard
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Brain, Search, Database, Zap, Shield, Activity } from "lucide-react";

interface StatusItem {
  label: string;
  value: string;
  status: "active" | "inactive" | "warning";
  icon: React.ElementType;
}

const STATUS_ITEMS: StatusItem[] = [
  { label: "contextualLLM", value: "Active", status: "active", icon: Brain },
  { label: "Models Available", value: "16", status: "active", icon: Zap },
  { label: "Web Search", value: "google_search", status: "active", icon: Search },
  { label: "Guardrails", value: "PII + Injection", status: "active", icon: Shield },
  { label: "Memory Engine", value: "6 categories", status: "active", icon: Database },
  { label: "Usage Tracking", value: "Per-call", status: "active", icon: Activity },
];

export function IntelligenceStatusWidget() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Brain className="h-4 w-4 text-blue-500" />
          Intelligence Status
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2">
          {STATUS_ITEMS.map((item) => (
            <div key={item.label} className="flex items-center gap-2 text-xs">
              <item.icon className="h-3 w-3 text-muted-foreground" />
              <span className="text-muted-foreground">{item.label}</span>
              <Badge
                variant={item.status === "active" ? "default" : "secondary"}
                className="ml-auto text-[10px] h-4 px-1"
              >
                {item.value}
              </Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
