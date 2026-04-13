import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Maximize2, Minimize2, BarChart3, LineChart, PieChart } from "lucide-react";

export interface ChartData {
  type: "bar" | "line" | "pie" | "doughnut" | "area";
  title?: string;
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    backgroundColor?: string | string[];
    borderColor?: string;
  }[];
}

interface InlineChartProps {
  data: ChartData;
  className?: string;
}

// Pass 101 Stewardship Gold: chart palette now leads with gold to match
// the new design system's --chart-1 token. Gold → emerald → sky → rose
// → purple → orange → indigo mirrors the canonical chart order the
// platform uses everywhere else. Values are rgba() because chart.js
// needs hex/rgba, not oklch(), at runtime.
const CHART_COLORS = [
  "rgba(212, 168, 67, 0.8)",  // Stewardship Gold (matches --chart-1)
  "rgba(20, 184, 166, 0.8)",  // teal-500 (chart-2)
  "rgba(14, 165, 233, 0.8)",  // sky-500 (chart-3)
  "rgba(239, 68, 68, 0.8)",   // red-500 (chart-4)
  "rgba(168, 85, 247, 0.8)",  // purple-500 (chart-5)
  "rgba(249, 115, 22, 0.8)",  // orange-500
  "rgba(34, 197, 94, 0.8)",   // green-500
  "rgba(99, 102, 241, 0.8)",  // indigo-500
];

const CHART_BORDERS = [
  "rgba(212, 168, 67, 1)",
  "rgba(20, 184, 166, 1)",
  "rgba(14, 165, 233, 1)",
  "rgba(239, 68, 68, 1)",
  "rgba(168, 85, 247, 1)",
  "rgba(249, 115, 22, 1)",
  "rgba(34, 197, 94, 1)",
  "rgba(99, 102, 241, 1)",
];

export default function InlineChart({ data, className = "" }: InlineChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<any>(null);
  const [expanded, setExpanded] = useState(false);
  const [chartLoaded, setChartLoaded] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadChart() {
      // Dynamically import Chart.js
      const { Chart, registerables } = await import("chart.js");
      Chart.register(...registerables);

      if (!mounted || !canvasRef.current) return;

      // Destroy previous chart
      if (chartRef.current) {
        chartRef.current.destroy();
      }

      const ctx = canvasRef.current.getContext("2d");
      if (!ctx) return;

      const chartType = data.type === "area" ? "line" : data.type;

      const datasets = data.datasets.map((ds, i) => ({
        ...ds,
        backgroundColor: ds.backgroundColor || (
          chartType === "pie" || chartType === "doughnut"
            ? CHART_COLORS.slice(0, ds.data.length)
            : CHART_COLORS[i % CHART_COLORS.length]
        ),
        borderColor: ds.borderColor || CHART_BORDERS[i % CHART_BORDERS.length],
        borderWidth: chartType === "pie" || chartType === "doughnut" ? 2 : 2,
        fill: data.type === "area",
        tension: 0.3,
        pointRadius: chartType === "line" ? 3 : undefined,
        pointHoverRadius: chartType === "line" ? 6 : undefined,
      }));

      chartRef.current = new Chart(ctx, {
        type: chartType as any,
        data: {
          labels: data.labels,
          datasets,
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: data.datasets.length > 1 || chartType === "pie" || chartType === "doughnut",
              position: "bottom",
              labels: {
                color: "rgba(255,255,255,0.7)",
                font: { size: 11 },
                padding: 12,
              },
            },
            title: {
              display: !!data.title,
              text: data.title || "",
              color: "rgba(255,255,255,0.9)",
              font: { size: 14, weight: "bold" as const },
              padding: { bottom: 12 },
            },
          },
          scales: chartType !== "pie" && chartType !== "doughnut" ? {
            x: {
              ticks: { color: "rgba(255,255,255,0.5)", font: { size: 10 } },
              grid: { color: "rgba(255,255,255,0.06)" },
            },
            y: {
              ticks: { color: "rgba(255,255,255,0.5)", font: { size: 10 } },
              grid: { color: "rgba(255,255,255,0.06)" },
            },
          } : undefined,
        },
      });

      setChartLoaded(true);
    }

    loadChart();

    return () => {
      mounted = false;
      if (chartRef.current) {
        chartRef.current.destroy();
      }
    };
  }, [data, expanded]);

  const handleDownload = () => {
    if (!canvasRef.current) return;
    const link = document.createElement("a");
    link.download = `${data.title || "chart"}.png`;
    link.href = canvasRef.current.toDataURL("image/png");
    link.click();
  };

  const typeIcon = data.type === "bar" ? <BarChart3 className="w-3.5 h-3.5" /> :
    data.type === "line" || data.type === "area" ? <LineChart className="w-3.5 h-3.5" /> :
    <PieChart className="w-3.5 h-3.5" />;

  return (
    <div className={`rounded-xl border border-border bg-card/50 backdrop-blur-sm overflow-hidden ${className}`}>
      {/* Chart header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/50 bg-secondary/20">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {typeIcon}
          <span>{data.title || "Chart"}</span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" className="h-9 w-9 p-0" onClick={handleDownload} title="Download PNG">
            <Download className="w-3 h-3" />
          </Button>
          <Button variant="ghost" size="sm" className="h-9 w-9 p-0" onClick={() => setExpanded(!expanded)} title={expanded ? "Collapse" : "Expand"}>
            {expanded ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
          </Button>
        </div>
      </div>

      {/* Chart canvas */}
      <div className={`p-3 transition-all ${expanded ? "h-[400px]" : "h-[220px]"}`}>
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}

/**
 * Parse chart data from AI response markdown.
 * Looks for ```chart JSON blocks in the response.
 */
export function parseChartBlocks(text: string): { text: string; charts: ChartData[] } {
  const charts: ChartData[] = [];
  const cleaned = text.replace(/```chart\n([\s\S]*?)```/g, (_, json) => {
    try {
      const data = JSON.parse(json.trim());
      if (data.type && data.labels && data.datasets) {
        charts.push(data);
        return `[CHART:${charts.length - 1}]`;
      }
    } catch { /* ignore parse errors */ }
    return _;
  });
  return { text: cleaned, charts };
}
