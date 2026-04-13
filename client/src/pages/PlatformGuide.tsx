import { useState } from "react";
import { SEOHead } from "@/components/SEOHead";
import { useAuth } from "@/_core/hooks/useAuth";
import { Redirect } from "wouter";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Search, BookOpen, Palette, Layout, Database, Code2, Shield, Cpu,
  Globe, Layers, FileText, Users,
  Zap, Network, Lock, TestTube, Workflow, Copy, Check,
  Monitor, Smartphone, Eye
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

// ── Copy-to-clipboard helper ──────────────────────────────────────────
function CopyBlock({ code, language = "typescript" }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="relative group">
      <pre className="bg-sidebar rounded-lg p-4 overflow-x-auto text-sm font-mono text-muted-foreground border border-border">
        <code>{code}</code>
      </pre>
      <Button
        variant="ghost" size="icon"
        className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
        aria-label="Copy code"
        onClick={handleCopy}
      >
        {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
      </Button>
    </div>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────
function StatCard({ label, value, icon: Icon }: { label: string; value: string | number; icon: any }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-2xl font-bold font-mono tabular-nums font-heading">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

// ── Section wrapper ───────────────────────────────────────────────────
function Section({ id, title, icon: Icon, children }: { id: string; title: string; icon: any; children: React.ReactNode }) {
  return (
    <section id={id} className="space-y-4">
      <div className="flex items-center gap-2">
        <Icon className="h-5 w-5 text-primary" />
        <h2 className="text-xl font-bold font-heading">{title}</h2>
      </div>
      {children}
    </section>
  );
}

// ── Color swatch ──────────────────────────────────────────────────────
function ColorSwatch({ name, cssVar, hex }: { name: string; cssVar: string; hex: string }) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-border p-2">
      <div className="h-8 w-8 rounded-md border border-border" style={{ backgroundColor: hex }} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{name}</p>
        <p className="text-xs text-muted-foreground font-mono">{cssVar}</p>
      </div>
      <Badge variant="outline" className="text-xs font-mono shrink-0">{hex}</Badge>
    </div>
  );
}

// ── Route table row ───────────────────────────────────────────────────
function RouteRow({ path, page, role, desc }: { path: string; page: string; role: string; desc: string }) {
  return (
    <tr className="border-b border-border hover:bg-muted/30 transition-colors">
      <td className="py-2 px-3 font-mono text-xs text-primary">{path}</td>
      <td className="py-2 px-3 text-sm">{page}</td>
      <td className="py-2 px-3"><Badge variant="outline" className="text-xs">{role}</Badge></td>
      <td className="py-2 px-3 text-sm text-muted-foreground">{desc}</td>
    </tr>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════
export default function PlatformGuide() {
  const { user, loading } = useAuth();
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("overview");

  // SEOHead handles the title now

  if (loading) return null;
  if (!user || (user as any).role !== "admin") return <Redirect to="/chat" />;

  const sections = [
    { id: "overview", label: "Overview", icon: BookOpen },
    { id: "design", label: "Design System", icon: Palette },
    { id: "architecture", label: "Architecture", icon: Layers },
    { id: "routes", label: "Routes & Nav", icon: Layout },
    { id: "database", label: "Database", icon: Database },
    { id: "api", label: "API Surface", icon: Code2 },
    { id: "services", label: "Services", icon: Cpu },
    { id: "auth", label: "Auth & Roles", icon: Shield },
    { id: "testing", label: "Testing", icon: TestTube },
    { id: "patterns", label: "Dev Patterns", icon: Workflow },
  ];

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      <SEOHead title="Platform Guide — Stewardly" description="Internal documentation for the Stewardly AI platform architecture, APIs, and development patterns" />
      {/* Left sidebar TOC */}
      <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-border bg-sidebar p-4">
        <div className="flex items-center gap-2 mb-6">
          <BookOpen className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-bold font-heading">Platform Guide</h1>
        </div>
        <div className="relative mb-4">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search guide..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9 bg-background"
          />
        </div>
        <nav className="flex-1 space-y-1" role="tablist" aria-label="Guide sections" aria-orientation="vertical">
          {sections
            .filter(s => !search || s.label.toLowerCase().includes(search.toLowerCase()))
            .map(s => (
              <button
                key={s.id}
                role="tab"
                aria-selected={activeTab === s.id}
                onClick={() => setActiveTab(s.id)}
                className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors cursor-pointer ${
                  activeTab === s.id
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <s.icon className="h-4 w-4" />
                {s.label}
              </button>
            ))}
        </nav>
        <Separator className="my-4" />
        <div className="text-xs text-muted-foreground space-y-1">
          <p>Admin-only reference</p>
          <p>Last updated: April 2026</p>
          <Badge variant="outline" className="text-xs">v2.0</Badge>
        </div>
      </aside>

      {/* Main content */}
      <ScrollArea className="flex-1">
        <div className="max-w-4xl mx-auto p-6 lg:p-8 space-y-8">

          {/* Mobile tab selector */}
          <div className="lg:hidden">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="w-full flex-wrap h-auto gap-1 bg-sidebar p-1">
                {sections.map(s => (
                  <TabsTrigger key={s.id} value={s.id} className="text-xs gap-1">
                    <s.icon className="h-3 w-3" />
                    {s.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>

          {/* ── OVERVIEW TAB ─────────────────────────────────────── */}
          {activeTab === "overview" && (
            <div className="space-y-6">
              <div>
                <h1 className="text-3xl font-bold font-heading mb-2">Stewardly AI Platform Guide</h1>
                <p className="text-muted-foreground text-lg">
                  Comprehensive reference for the Digital Financial Twin platform — architecture, design system, API surface, database schema, and developer patterns.
                </p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard label="Lines of Code" value="197K+" icon={Code2} />
                <StatCard label="Database Tables" value={270} icon={Database} />
                <StatCard label="API Routers" value="51 (860 procs)" icon={Globe} />
                <StatCard label="Tests Passing" value="2,162" icon={TestTube} />
                <StatCard label="Source Files" value={893} icon={FileText} />
                <StatCard label="Frontend Pages" value={76} icon={Layout} />
                <StatCard label="Server Services" value={112} icon={Cpu} />
                <StatCard label="Custom Hooks" value={16} icon={Zap} />
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="font-heading">Technology Stack</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border text-left">
                          <th className="py-2 px-3 font-medium">Layer</th>
                          <th className="py-2 px-3 font-medium">Technology</th>
                          <th className="py-2 px-3 font-medium">Version</th>
                        </tr>
                      </thead>
                      <tbody className="text-muted-foreground">
                        {[
                          ["Frontend", "React", "19.2"],
                          ["Styling", "Tailwind CSS", "4.x"],
                          ["Components", "shadcn/ui + Radix", "Latest"],
                          ["Routing", "Wouter", "3.3"],
                          ["Data", "TanStack Query + tRPC", "5.90 / 11.6"],
                          ["Server", "Express", "4.21"],
                          ["ORM", "Drizzle ORM", "0.44"],
                          ["Database", "MySQL / TiDB", "8.x"],
                          ["Auth", "Manus OAuth + JWT", "jose 6.1"],
                          ["Build", "Vite", "6.x"],
                          ["Testing", "Vitest", "2.1"],
                          ["Storage", "AWS S3", "SDK v3"],
                          ["Charts", "Recharts + Chart.js", "2.15 / 5.x"],
                        ].map(([layer, tech, ver]) => (
                          <tr key={layer} className="border-b border-border/50">
                            <td className="py-2 px-3 font-medium text-foreground">{layer}</td>
                            <td className="py-2 px-3">{tech}</td>
                            <td className="py-2 px-3"><Badge variant="outline" className="text-xs">{ver}</Badge></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="font-heading">Request Flow</CardTitle>
                </CardHeader>
                <CardContent>
                  <CopyBlock language="text" code={`Browser → Vite Dev Server (HMR) → React App
    ↓
tRPC Client (Superjson) → /api/trpc/* → Express Middleware
    ↓
tRPC Context (JWT → user) → publicProcedure | protectedProcedure | adminProcedure
    ↓
Router Handler → Service Layer → Drizzle ORM → MySQL/TiDB
    ↓
Response (typed, Superjson) → React Query Cache → UI`} />
                </CardContent>
              </Card>
            </div>
          )}

          {/* ── DESIGN SYSTEM TAB ────────────────────────────────── */}
          {activeTab === "design" && (
            <div className="space-y-6">
              <Section id="colors" title="Color Palette" icon={Palette}>
                <p className="text-sm text-muted-foreground">
                  Deep navy + sky blue professional aesthetic using OKLCH color values for perceptual uniformity. Dark mode is the default theme.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <ColorSwatch name="Background" cssVar="--background" hex="#0F172A" />
                  <ColorSwatch name="Foreground" cssVar="--foreground" hex="#E8ECF4" />
                  <ColorSwatch name="Card" cssVar="--card" hex="#1A2340" />
                  <ColorSwatch name="Primary" cssVar="--primary" hex="#0EA5E9" />
                  <ColorSwatch name="Secondary" cssVar="--secondary" hex="#1E293B" />
                  <ColorSwatch name="Muted" cssVar="--muted" hex="#1E2A3E" />
                  <ColorSwatch name="Muted Foreground" cssVar="--muted-foreground" hex="#8B9AB8" />
                  <ColorSwatch name="Destructive" cssVar="--destructive" hex="#F43F5E" />
                  <ColorSwatch name="Border" cssVar="--border" hex="#2D3A52" />
                  <ColorSwatch name="Sidebar" cssVar="--sidebar" hex="#0B1120" />
                  <ColorSwatch name="Chart 1 (Sky)" cssVar="--chart-1" hex="#0EA5E9" />
                  <ColorSwatch name="Chart 2 (Emerald)" cssVar="--chart-2" hex="#10B981" />
                  <ColorSwatch name="Chart 3 (Amber)" cssVar="--chart-3" hex="#F59E0B" />
                  <ColorSwatch name="Chart 4 (Rose)" cssVar="--chart-4" hex="#F43F5E" />
                  <ColorSwatch name="Chart 5 (Purple)" cssVar="--chart-5" hex="#8B5CF6" />
                </div>
              </Section>

              <Section id="typography" title="Typography" icon={FileText}>
                <Card>
                  <CardContent className="pt-6 space-y-4">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Headings — Satoshi (Fontshare CDN)</p>
                      <p className="text-3xl font-heading font-bold">The quick brown fox jumps</p>
                    </div>
                    <Separator />
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Body — DM Sans (Google Fonts)</p>
                      <p className="text-base">The quick brown fox jumps over the lazy dog. 0123456789</p>
                    </div>
                    <Separator />
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Monospace — JetBrains Mono</p>
                      <p className="text-sm font-mono">const result = await fetchData();</p>
                    </div>
                  </CardContent>
                </Card>
                <CopyBlock code={`--font-sans: "DM Sans", ui-sans-serif, system-ui, sans-serif;
--font-heading: "Satoshi", "DM Sans", ui-sans-serif, system-ui, sans-serif;
--font-mono: "JetBrains Mono", ui-monospace, monospace;`} />
              </Section>

              <Section id="spacing" title="Spacing & Radius" icon={Layout}>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { name: "sm", value: "6px", desc: "Badges, small buttons" },
                    { name: "md", value: "8px", desc: "Inputs, small cards" },
                    { name: "lg", value: "10px", desc: "Cards, dialogs" },
                    { name: "xl", value: "14px", desc: "Large containers" },
                  ].map(r => (
                    <div key={r.name} className="border border-border rounded-lg p-3 text-center">
                      <div className="mx-auto mb-2 h-12 w-12 bg-primary/20 border border-primary/40" style={{ borderRadius: r.value }} />
                      <p className="text-sm font-medium">radius-{r.name}</p>
                      <p className="text-xs text-muted-foreground">{r.value}</p>
                      <p className="text-xs text-muted-foreground mt-1">{r.desc}</p>
                    </div>
                  ))}
                </div>
              </Section>

              <Section id="responsive" title="Responsive Breakpoints" icon={Monitor}>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Card>
                    <CardContent className="pt-4 flex items-center gap-3">
                      <Smartphone className="h-8 w-8 text-muted-foreground" />
                      <div>
                        <p className="font-medium">Mobile</p>
                        <p className="text-xs text-muted-foreground">&lt; 768px — Collapsed sidebar, stacked layouts</p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4 flex items-center gap-3">
                      <Monitor className="h-8 w-8 text-muted-foreground" />
                      <div>
                        <p className="font-medium">Tablet</p>
                        <p className="text-xs text-muted-foreground">768-1024px — Compact sidebar, 2-col grids</p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4 flex items-center gap-3">
                      <Eye className="h-8 w-8 text-muted-foreground" />
                      <div>
                        <p className="font-medium">Desktop</p>
                        <p className="text-xs text-muted-foreground">&gt; 1024px — Full sidebar, multi-column</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </Section>
            </div>
          )}

          {/* ── ARCHITECTURE TAB ─────────────────────────────────── */}
          {activeTab === "architecture" && (
            <div className="space-y-6">
              <Section id="dir-structure" title="Directory Structure" icon={Layers}>
                <CopyBlock language="text" code={`wealthbridge-ai/
├── client/
│   ├── public/              # favicon.ico, robots.txt only
│   ├── index.html           # Entry HTML with Google Fonts CDN
│   └── src/
│       ├── App.tsx           # Route definitions (221 lines)
│       ├── main.tsx          # Provider wiring
│       ├── index.css         # Design tokens (OKLCH)
│       ├── pages/            # 76 page components
│       ├── components/       # 42 custom + 53 shadcn/ui
│       ├── hooks/            # 16 custom hooks
│       ├── contexts/         # Theme + Notification contexts
│       └── lib/              # tRPC client, utils
├── server/
│   ├── _core/               # Framework plumbing (DO NOT EDIT)
│   ├── routers.ts           # Main appRouter (51 sub-routers, 860 procedures)
│   ├── routers/             # 53 feature router modules
│   ├── services/            # 112 business logic services
│   ├── shared/              # Cross-cutting AI capabilities
│   ├── db.ts                # Query helpers (896 lines)
│   └── storage.ts           # S3 file storage
├── drizzle/
│   └── schema.ts            # 270 tables (5,206 lines)
├── shared/                  # Client-server shared types
└── migrations/              # SQL migration history`} />
              </Section>

              <Section id="ai-layers" title="AI Configuration Layers" icon={Cpu}>
                <Card>
                  <CardContent className="pt-6">
                    <div className="space-y-3">
                      {[
                        { layer: "Layer 1 — Platform", table: "platform_ai_settings", scope: "Global defaults", by: "Global Admin" },
                        { layer: "Layer 2 — Organization", table: "org_ai_settings", scope: "Org overrides", by: "Org Admin" },
                        { layer: "Layer 3 — User", table: "user_ai_preferences", scope: "Individual prefs", by: "End User" },
                      ].map((l, i) => (
                        <div key={i} className="flex items-center gap-4 rounded-lg border border-border p-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-bold">
                            {i + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm">{l.layer}</p>
                            <p className="text-xs text-muted-foreground font-mono">{l.table}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-muted-foreground">{l.scope}</p>
                            <Badge variant="outline" className="text-xs">{l.by}</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-3">
                      Resolution: User prefs → Org settings → Platform defaults (bottom-up)
                    </p>
                  </CardContent>
                </Card>
              </Section>

              <Section id="shared-intelligence" title="Shared Intelligence Layer" icon={Network}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { name: "contextualLLM", desc: "Context-aware LLM invocation with memory" },
                    { name: "deepContextAssembler", desc: "Multi-source context assembly" },
                    { name: "memoryEngine", desc: "Episodic and semantic memory management" },
                    { name: "reactLoop", desc: "ReAct (Reasoning + Acting) loop" },
                    { name: "improvementEngine", desc: "Self-improvement signal detection" },
                    { name: "sseStreamHandler", desc: "SSE streaming for real-time responses" },
                    { name: "aiConfigResolver", desc: "3-layer AI configuration resolution" },
                  ].map(m => (
                    <div key={m.name} className="flex items-start gap-2 rounded-md border border-border p-3">
                      <Cpu className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      <div>
                        <p className="text-sm font-mono font-medium">{m.name}</p>
                        <p className="text-xs text-muted-foreground">{m.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            </div>
          )}

          {/* ── ROUTES TAB ───────────────────────────────────────── */}
          {activeTab === "routes" && (
            <div className="space-y-6">
              <Section id="public-routes" title="Public Routes" icon={Globe}>
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/30">
                      <tr className="border-b border-border text-left">
                        <th className="py-2 px-3 font-medium">Path</th>
                        <th className="py-2 px-3 font-medium">Page</th>
                        <th className="py-2 px-3 font-medium">Role</th>
                        <th className="py-2 px-3 font-medium">Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      <RouteRow path="/" page="Landing" role="public" desc="Marketing landing page" />
                      <RouteRow path="/signin" page="SignIn" role="public" desc="Authentication entry" />
                      <RouteRow path="/org/:slug" page="OrgLanding" role="public" desc="Org-branded landing" />
                      <RouteRow path="/welcome" page="Welcome" role="public" desc="Post-signup onboarding" />
                      <RouteRow path="/terms" page="Terms" role="public" desc="Terms of service" />
                      <RouteRow path="/privacy" page="Privacy" role="public" desc="Privacy policy" />
                    </tbody>
                  </table>
                </div>
              </Section>

              <Section id="core-routes" title="Authenticated Routes" icon={Layout}>
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/30">
                      <tr className="border-b border-border text-left">
                        <th className="py-2 px-3 font-medium">Path</th>
                        <th className="py-2 px-3 font-medium">Page</th>
                        <th className="py-2 px-3 font-medium">Min Role</th>
                        <th className="py-2 px-3 font-medium">Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      <RouteRow path="/chat" page="Chat" role="user" desc="Main AI conversation" />
                      <RouteRow path="/operations" page="OperationsHub" role="user" desc="Workflow & tasks" />
                      <RouteRow path="/intelligence-hub" page="IntelligenceHub" role="user" desc="AI models & data" />
                      <RouteRow path="/advisory" page="AdvisoryHub" role="user" desc="Products & cases" />
                      <RouteRow path="/relationships" page="RelationshipsHub" role="user" desc="Client network" />
                      <RouteRow path="/market-data" page="MarketData" role="user" desc="Market intelligence" />
                      <RouteRow path="/integrations" page="Integrations" role="user" desc="Connected services" />
                      <RouteRow path="/settings/:tab" page="SettingsHub" role="user" desc="12 settings tabs" />
                      <RouteRow path="/help" page="Help" role="user" desc="Documentation" />
                      <RouteRow path="/portal" page="Portal" role="advisor" desc="Client management" />
                      <RouteRow path="/organizations" page="Organizations" role="advisor" desc="Org management" />
                      <RouteRow path="/manager" page="ManagerDashboard" role="manager" desc="Team dashboard" />
                      <RouteRow path="/admin" page="GlobalAdmin" role="admin" desc="Platform admin" />
                      <RouteRow path="/admin/intelligence" page="AdminIntelligence" role="admin" desc="AI monitoring" />
                      <RouteRow path="/admin/guide" page="PlatformGuide" role="admin" desc="This page" />
                    </tbody>
                  </table>
                </div>
              </Section>

              <Section id="nav-structure" title="Sidebar Navigation" icon={Layout}>
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-sm text-muted-foreground mb-3">
                      Role-based sidebar filtering via <code className="text-xs bg-muted px-1 py-0.5 rounded">hasMinRole(userRole, minRole)</code> in AppShell.tsx
                    </p>
                    <div className="space-y-2">
                      {[
                        { role: "user", level: 0, items: "Chat, Operations, Intelligence, Advisory, Relationships, Market Data, Documents, Integrations, Passive Actions, My Progress, Settings, Help" },
                        { role: "advisor", level: 1, items: "+ Portal, Organizations, Integration Health, Improvement Engine" },
                        { role: "manager", level: 2, items: "+ Manager Dashboard" },
                        { role: "admin", level: 3, items: "+ Global Admin, Platform Guide" },
                      ].map(r => (
                        <div key={r.role} className="flex items-start gap-3 rounded-md border border-border p-3">
                          <Badge variant={r.role === "admin" ? "default" : "outline"} className="shrink-0 mt-0.5">
                            {r.role} (L{r.level})
                          </Badge>
                          <p className="text-sm text-muted-foreground">{r.items}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </Section>
            </div>
          )}

          {/* ── DATABASE TAB ──────────────────────────────────────── */}
          {activeTab === "database" && (
            <div className="space-y-6">
              <Section id="db-overview" title="Schema Overview" icon={Database}>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <StatCard label="Total Tables" value={270} icon={Database} />
                  <StatCard label="Schema Lines" value="5,206" icon={FileText} />
                  <StatCard label="Query Helpers" value="896 lines" icon={Code2} />
                </div>
              </Section>

              <Section id="db-groups" title="Table Groups" icon={Layers}>
                <div className="space-y-2">
                  {[
                    { group: "Core Identity", count: "3", desc: "users, user_profiles, user_organization_roles" },
                    { group: "Organizations", count: "3", desc: "organizations, org relationships, landing config" },
                    { group: "Conversations", count: "3", desc: "conversations, messages, conversation_folders" },
                    { group: "AI Configuration", count: "3", desc: "platform, org, and user AI settings" },
                    { group: "Memory & Context", count: "3", desc: "memory_episodes, context_snapshots, reasoning_traces" },
                    { group: "Advisory", count: "3", desc: "insurance_quotes, applications, estate_documents" },
                    { group: "Premium Finance", count: "3", desc: "cases, gate_reviews, rates" },
                    { group: "Compliance", count: "3", desc: "events, reg_bi_documentation, fairness_tests" },
                    { group: "Market Data", count: "3", desc: "cache, freshness_registry, rate_profiles" },
                    { group: "Integrations", count: "3", desc: "carrier_connections, data_sources, ingestion_jobs" },
                    { group: "Analytics", count: "3", desc: "platform_events, feature_usage, analytics_events" },
                    { group: "Self-Improvement", count: "4", desc: "signals, hypotheses, test_results, reasoning_traces" },
                  ].map(g => (
                    <div key={g.group} className="flex items-center gap-3 rounded-md border border-border p-3">
                      <Badge variant="outline" className="shrink-0 w-8 justify-center">{g.count}</Badge>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{g.group}</p>
                        <p className="text-xs text-muted-foreground truncate">{g.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </Section>

              <Section id="db-naming" title="Column Naming Convention" icon={Code2}>
                <Card className="border-amber-500/30 bg-amber-500/5">
                  <CardContent className="pt-6">
                    <p className="text-sm font-medium text-amber-400 mb-2">Critical: camelCase Column Names</p>
                    <p className="text-sm text-muted-foreground mb-3">
                      The database uses camelCase column names. All raw SQL queries must match this convention.
                    </p>
                    <CopyBlock code={`-- ✅ Correct
SELECT \`createdAt\`, \`userId\` FROM \`messages\` WHERE \`conversationId\` = ?

-- ❌ Incorrect (will fail)
SELECT created_at, user_id FROM messages WHERE conversation_id = ?`} />
                  </CardContent>
                </Card>
              </Section>
            </div>
          )}

          {/* ── API SURFACE TAB ──────────────────────────────────── */}
          {activeTab === "api" && (
            <div className="space-y-6">
              <Section id="api-routers" title="tRPC Router Catalog (95 routers)" icon={Code2}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {[
                    { name: "auth", auth: "public", desc: "Authentication state" },
                    { name: "chat", auth: "protected", desc: "AI chat operations" },
                    { name: "conversations", auth: "protected", desc: "Conversation CRUD" },
                    { name: "documents", auth: "protected", desc: "Document management" },
                    { name: "products", auth: "protected", desc: "Product catalog" },
                    { name: "suitability", auth: "protected", desc: "Risk profiling" },
                    { name: "market", auth: "protected", desc: "Market data" },
                    { name: "settings", auth: "protected", desc: "User settings" },
                    { name: "organizations", auth: "protected", desc: "Org management" },
                    { name: "portal", auth: "advisor+", desc: "Professional portal" },
                    { name: "compliance", auth: "advisor+", desc: "Compliance tools" },
                    { name: "aiLayers", auth: "admin", desc: "AI configuration" },
                    { name: "improvementEngine", auth: "advisor+", desc: "Self-improvement" },
                    { name: "modelEngine", auth: "protected", desc: "Multi-model inference" },
                    { name: "dataIngestion", auth: "protected", desc: "Data pipelines" },
                    { name: "verification", auth: "protected", desc: "Data verification" },
                    { name: "knowledgeBase", auth: "protected", desc: "Knowledge management" },
                    { name: "analytics", auth: "protected", desc: "Usage analytics" },
                    { name: "consent", auth: "protected", desc: "Consent management" },
                    { name: "notifications", auth: "protected", desc: "Notification system" },
                  ].map(r => (
                    <div key={r.name} className="flex items-center gap-2 rounded-md border border-border p-2">
                      <code className="text-xs text-primary font-mono">{r.name}</code>
                      <Badge variant="outline" className="text-xs shrink-0">{r.auth}</Badge>
                      <span className="text-xs text-muted-foreground truncate">{r.desc}</span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Showing 20 of 95 routers. Full list in STEWARDLY_COMPREHENSIVE_GUIDE.md
                </p>
              </Section>

              <Section id="procedure-types" title="Procedure Types" icon={Shield}>
                <div className="space-y-2">
                  {[
                    { type: "publicProcedure", middleware: "None", use: "Public endpoints (auth.me, landing data)" },
                    { type: "protectedProcedure", middleware: "JWT validation + user injection", use: "All authenticated operations" },
                    { type: "adminProcedure", middleware: "JWT + role check (admin only)", use: "Platform administration" },
                  ].map(p => (
                    <div key={p.type} className="flex items-start gap-3 rounded-md border border-border p-3">
                      <code className="text-xs text-primary font-mono shrink-0 mt-0.5">{p.type}</code>
                      <div>
                        <p className="text-xs text-muted-foreground">{p.middleware}</p>
                        <p className="text-sm">{p.use}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            </div>
          )}

          {/* ── SERVICES TAB ─────────────────────────────────────── */}
          {activeTab === "services" && (
            <div className="space-y-6">
              <Section id="service-categories" title="112 Server Services" icon={Cpu}>
                {[
                  { cat: "AI & Intelligence", count: 18, services: "contextualLLM, deepContextAssembler, memoryEngine, reactLoop, adaptiveContext, adaptivePrompts, modelEngine, multiModal, promptABTesting, capabilityModes, llmFailover, aiToolsRegistry, aiBoundaries, aiBadge, orgAiConfig, propagationEngine, statisticalModels, predictiveInsights" },
                  { cat: "Data & Integration", count: 16, services: "dataIngestion, dataIngestionEnhanced, scheduledIngestion, foundationLayer, governmentDataPipelines, platformPipelines, searchEnhanced, marketStreaming, investmentIntelligence, iulMarketData, creditBureau, snapTrade, plaidProduction, webhookIngestion, webhookReceiver, crmSync" },
                  { cat: "Financial Domain", count: 14, services: "insuranceData, productSuitability, suitabilityEngine, adaptiveRateManagement, calculatorPersistence, estatePlanningKnowledge, financialLiteracy, whatIfScenarios, medicareParameters, ssaParameters, taxParameters, nitrogenRisk, accountReconciliation, recommendation" },
                  { cat: "Compliance & Security", count: 10, services: "compliancePrediction, compliancePrescreening, regBIDocumentation, regulatoryImpact, regulatoryMonitor, dynamicDisclaimers, dynamicPermissions, fairnessTesting, encryption, keyRotation" },
                  { cat: "Infrastructure", count: 12, services: "scheduler, cronManager, scheduledTasks, errorHandling, dbResilience, infrastructureResilience, loadTesting, pipelineSelfTest, canaryDeployment, retentionEnforcement, qualityNormalization, infrastructureDocs" },
                  { cat: "User Experience", count: 10, services: "exponentialEngine, selfDiscovery, roleOnboarding, commandPalette, passiveActions, accessibilityEngine, pwaOffline, websocketNotifications, fieldSharing, proactiveEscalation" },
                  { cat: "Content & Communication", count: 8, services: "knowledgeBase, knowledgeIngestion, knowledgeGraphDynamic, documentExtractor, documentTemplates, pdfGenerator, exportService, emailCampaign" },
                  { cat: "Auth & Identity", count: 7, services: "socialOAuth, googleAuth, linkedinAuth, emailAuth, postSignupEnrichment, profileMerger, apolloService" },
                ].map(c => (
                  <Card key={c.cat} className="mb-3">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base font-heading">{c.cat}</CardTitle>
                        <Badge variant="outline">{c.count} services</Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-xs text-muted-foreground font-mono leading-relaxed">{c.services}</p>
                    </CardContent>
                  </Card>
                ))}
              </Section>
            </div>
          )}

          {/* ── AUTH TAB ──────────────────────────────────────────── */}
          {activeTab === "auth" && (
            <div className="space-y-6">
              <Section id="auth-flow" title="Authentication Flow" icon={Lock}>
                <Card>
                  <CardContent className="pt-6">
                    <ol className="space-y-3">
                      {[
                        "User clicks Sign In → redirected to Manus OAuth portal",
                        "OAuth callback at /api/oauth/callback validates token",
                        "JWT session cookie set with user data",
                        "All subsequent requests include cookie → ctx.user populated",
                        "Role-based access enforced at procedure and UI levels",
                      ].map((step, i) => (
                        <li key={i} className="flex items-start gap-3">
                          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">
                            {i + 1}
                          </div>
                          <p className="text-sm text-muted-foreground">{step}</p>
                        </li>
                      ))}
                    </ol>
                  </CardContent>
                </Card>
              </Section>

              <Section id="social-auth" title="Social Auth Providers" icon={Users}>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { name: "Manus OAuth", status: "Active", data: "Base identity" },
                    { name: "Google", status: "Active", data: "Phone, birthday, orgs" },
                    { name: "LinkedIn", status: "Active", data: "Headline, industry" },
                    { name: "Email/Password", status: "Active", data: "Basic auth" },
                  ].map(p => (
                    <Card key={p.name}>
                      <CardContent className="pt-4">
                        <div className="flex items-center justify-between mb-1">
                          <p className="font-medium text-sm">{p.name}</p>
                          <Badge className="bg-emerald-500/10 text-emerald-400 text-xs">{p.status}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">{p.data}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </Section>

              <Section id="role-hierarchy" title="Role Hierarchy" icon={Shield}>
                <CopyBlock code={`admin  (level 3) → Can access everything
  ↑
manager (level 2) → Team management + all advisor features
  ↑
advisor (level 1) → Professional tools + all user features
  ↑
user    (level 0) → Consumer-facing features`} />
              </Section>
            </div>
          )}

          {/* ── TESTING TAB ──────────────────────────────────────── */}
          {activeTab === "testing" && (
            <div className="space-y-6">
              <Section id="test-overview" title="Test Suite" icon={TestTube}>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <StatCard label="Total Tests" value="2,162" icon={TestTube} />
                  <StatCard label="Test Files" value={81} icon={FileText} />
                  <StatCard label="Pass Rate" value="100%" icon={Check} />
                  <StatCard label="Framework" value="Vitest" icon={Zap} />
                </div>
              </Section>

              <Section id="test-patterns" title="Test Patterns" icon={Code2}>
                <CopyBlock code={`import { describe, it, expect } from "vitest";

describe("Feature Name", () => {
  it("should perform expected behavior", async () => {
    const result = await someFunction(input);
    expect(result).toMatchObject({ expected: "shape" });
  });

  // Network-dependent tests get extended timeouts
  it("should fetch external data", async () => {
    const data = await fetchExternalAPI();
    expect(data).toBeDefined();
  }, 15000); // 15s timeout
});`} />
              </Section>
            </div>
          )}

          {/* ── DEV PATTERNS TAB ─────────────────────────────────── */}
          {activeTab === "patterns" && (
            <div className="space-y-6">
              <Section id="new-feature" title="Adding a New Feature" icon={Workflow}>
                <Card>
                  <CardContent className="pt-6">
                    <ol className="space-y-3">
                      {[
                        { step: "Schema", desc: "Add table to drizzle/schema.ts with camelCase column names" },
                        { step: "Migration", desc: "Run pnpm drizzle-kit generate, review SQL, apply via webdev_execute_sql" },
                        { step: "DB Helper", desc: "Add query function to server/db.ts" },
                        { step: "Router", desc: "Create procedure in server/routers.ts or server/routers/<feature>.ts" },
                        { step: "UI", desc: "Create page in client/src/pages/<Feature>.tsx" },
                        { step: "Route", desc: "Register in client/src/App.tsx" },
                        { step: "Nav", desc: "Add to AppShell.tsx navItems if sidebar entry needed" },
                        { step: "Test", desc: "Write Vitest specs in server/<feature>.test.ts" },
                      ].map((s, i) => (
                        <li key={i} className="flex items-start gap-3">
                          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">
                            {i + 1}
                          </div>
                          <div>
                            <p className="text-sm font-medium">{s.step}</p>
                            <p className="text-xs text-muted-foreground">{s.desc}</p>
                          </div>
                        </li>
                      ))}
                    </ol>
                  </CardContent>
                </Card>
              </Section>

              <Section id="trpc-pattern" title="tRPC Procedure Pattern" icon={Code2}>
                <CopyBlock code={`// server/routers/<feature>.ts
export const myFeatureRouter = router({
  getData: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      return await getFeatureData(ctx.user.id, input.id);
    }),
  
  updateData: protectedProcedure
    .input(z.object({ id: z.number(), value: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return await updateFeatureData(ctx.user.id, input.id, input.value);
    }),
});

// client/src/pages/<Feature>.tsx
function FeaturePage() {
  const { data, isLoading } = trpc.myFeature.getData.useQuery({ id: 1 });
  const updateMutation = trpc.myFeature.updateData.useMutation({
    onSuccess: () => {
      trpc.useUtils().myFeature.getData.invalidate();
    },
  });
  
  if (isLoading) return <Skeleton />;
  return <div>{data.value}</div>;
}`} />
              </Section>

              <Section id="naming" title="File Naming Conventions" icon={FileText}>
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/30">
                      <tr className="border-b border-border text-left">
                        <th className="py-2 px-3 font-medium">Type</th>
                        <th className="py-2 px-3 font-medium">Convention</th>
                        <th className="py-2 px-3 font-medium">Example</th>
                      </tr>
                    </thead>
                    <tbody className="text-muted-foreground">
                      {[
                        ["Pages", "PascalCase", "AdvisoryHub.tsx"],
                        ["Components", "PascalCase", "VoiceOrb.tsx"],
                        ["Hooks", "camelCase + use prefix", "useVoiceRecognition.ts"],
                        ["Services", "camelCase", "adaptiveRateManagement.ts"],
                        ["Routers", "camelCase", "organizations.ts"],
                        ["Tests", "camelCase + .test.ts", "schemaMigration.test.ts"],
                        ["DB columns", "camelCase in SQL", "createdAt, userId"],
                        ["DB tables", "snake_case", "insurance_quotes"],
                      ].map(([type, conv, ex]) => (
                        <tr key={type} className="border-b border-border/50">
                          <td className="py-2 px-3 font-medium text-foreground">{type}</td>
                          <td className="py-2 px-3">{conv}</td>
                          <td className="py-2 px-3 font-mono text-xs">{ex}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Section>
            </div>
          )}

        </div>
      </ScrollArea>
    </div>
  );
}
