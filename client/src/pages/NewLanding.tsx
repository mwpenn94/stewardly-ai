/**
 * NewLanding -- public marketing / landing page for Stewardly.
 *
 * Mounted at a separate route from `/` (which redirects to /chat).
 * This page is the outward-facing "what is Stewardly" page with
 * capability cards, trust signals, a how-it-works section, and CTAs.
 */
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  Brain,
  Shield,
  Calculator,
  Users,
  MessageSquare,
  BarChart3,
  BookOpen,
  Zap,
  ArrowRight,
  Sparkles,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";

// ── Animation variants ──────────────────────────────────────────────
const fadeUp: import("framer-motion").Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: "easeOut" as const },
  }),
};

const staggerContainer: import("framer-motion").Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
};

// ── Helpers ─────────────────────────────────────────────────────────
function getTimeGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

// ── Data ────────────────────────────────────────────────────────────
const CAPABILITIES = [
  {
    icon: Brain,
    title: "Multi-Model Intelligence",
    description:
      "Query Claude, GPT, and Gemini simultaneously. Consensus scoring surfaces the best answer, not just the fastest.",
    accent: "text-chart-1",
    bg: "bg-chart-1/10",
  },
  {
    icon: Shield,
    title: "Compliance-Native",
    description:
      "FINRA 2210, Reg BI, and CAN-SPAM guardrails baked into every interaction. PII screening on all I/O.",
    accent: "text-chart-2",
    bg: "bg-chart-2/10",
  },
  {
    icon: Calculator,
    title: "Wealth Engine Calculators",
    description:
      "UWE, BIE, HE, Monte Carlo, and benchmarks -- full TypeScript ports of WealthBridge v7 with PDF reports.",
    accent: "text-chart-3",
    bg: "bg-chart-3/10",
  },
  {
    icon: Users,
    title: "Client Relationship Intelligence",
    description:
      "Lead pipeline, propensity scoring, CRM sync (GHL/Wealthbox/Redtail), and automated nurture campaigns.",
    accent: "text-chart-4",
    bg: "bg-chart-4/10",
  },
  {
    icon: BookOpen,
    title: "Continuous Learning",
    description:
      "SRS flashcards, practice quizzes, and 366+ definitions from EMBA modules. Licensure tracking with CE credit alerts.",
    accent: "text-chart-5",
    bg: "bg-chart-5/10",
  },
  {
    icon: BarChart3,
    title: "Live Market Data",
    description:
      "FRED/SOFR rates, census data, and real-time improvement signals on a 6-hour schedule.",
    accent: "text-accent",
    bg: "bg-accent/10",
  },
] as const;

const HOW_IT_WORKS = [
  {
    step: 1,
    icon: MessageSquare,
    title: "Start a conversation",
    description: "Ask anything -- financial planning, compliance questions, or calculator requests.",
  },
  {
    step: 2,
    icon: Brain,
    title: "AI orchestrates",
    description: "The ReAct loop selects tools, queries models, and applies compliance guardrails automatically.",
  },
  {
    step: 3,
    icon: Zap,
    title: "Get actionable answers",
    description: "Receive compliant recommendations backed by calculations, citations, and audit trails.",
  },
  {
    step: 4,
    icon: Sparkles,
    title: "Learn and improve",
    description: "The platform learns from every interaction -- RAG training, memory, and proactive insights.",
  },
] as const;

const TRUST_STATS = [
  { value: "352", label: "Database tables" },
  { value: "3,215", label: "Passing tests" },
  { value: "78", label: "API endpoints" },
  { value: "0", label: "TypeScript errors" },
] as const;

// ── Component ───────────────────────────────────────────────────────
export default function NewLanding() {
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* ── Hero ──────────────────────────────────────────────────── */}
      <section className="relative isolate px-6 pt-20 pb-24 lg:pt-32 lg:pb-36">
        {/* Ambient glow backgrounds */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
        >
          <div className="absolute -top-40 left-1/2 -translate-x-1/2 h-[500px] w-[700px] rounded-full bg-accent/15 blur-[120px]" />
          <div className="absolute top-60 right-0 h-[300px] w-[400px] rounded-full bg-chart-2/10 blur-[100px]" />
          <div className="absolute bottom-0 left-0 h-[250px] w-[350px] rounded-full bg-chart-3/8 blur-[90px]" />
        </div>

        <motion.div
          className="mx-auto max-w-3xl text-center"
          initial="hidden"
          animate="visible"
          variants={staggerContainer}
        >
          <motion.p
            className="text-sm font-medium tracking-widest uppercase text-accent mb-4"
            variants={fadeUp}
            custom={0}
          >
            {getTimeGreeting()} -- welcome to Stewardly
          </motion.p>

          <motion.h1
            className="font-heading text-4xl sm:text-5xl lg:text-6xl leading-tight tracking-tight"
            variants={fadeUp}
            custom={1}
          >
            The AI platform built for{" "}
            <span className="text-accent">financial professionals</span>
          </motion.h1>

          <motion.p
            className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed"
            variants={fadeUp}
            custom={2}
          >
            Five layers of intelligence -- from multi-model consensus to
            compliance-native guardrails -- so you can advise with confidence
            and grow your practice.
          </motion.p>

          <motion.div
            className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
            variants={fadeUp}
            custom={3}
          >
            <Button
              size="lg"
              className="gap-2 text-base"
              onClick={() => navigate("/chat")}
            >
              Get started <ArrowRight className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="gap-2 text-base"
              onClick={() => navigate("/sign-in")}
            >
              Sign in
            </Button>
          </motion.div>
        </motion.div>
      </section>

      {/* ── Capabilities ─────────────────────────────────────────── */}
      <section className="px-6 py-20 lg:py-28">
        <motion.div
          className="mx-auto max-w-6xl"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          variants={staggerContainer}
        >
          <motion.h2
            className="font-heading text-3xl sm:text-4xl text-center mb-4"
            variants={fadeUp}
            custom={0}
          >
            What Stewardly does
          </motion.h2>
          <motion.p
            className="text-center text-muted-foreground mb-14 max-w-xl mx-auto"
            variants={fadeUp}
            custom={1}
          >
            Six core capabilities purpose-built for financial advisory practices.
          </motion.p>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {CAPABILITIES.map((cap, i) => {
              const Icon = cap.icon;
              return (
                <motion.div
                  key={cap.title}
                  className="group rounded-xl border border-border bg-card p-6 transition-shadow hover:shadow-lg hover:shadow-accent/5"
                  variants={fadeUp}
                  custom={i + 2}
                >
                  <div
                    className={`inline-flex items-center justify-center rounded-lg p-2.5 mb-4 ${cap.bg}`}
                  >
                    <Icon className={`w-5 h-5 ${cap.accent}`} />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">{cap.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {cap.description}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      </section>

      {/* ── How it works ─────────────────────────────────────────── */}
      <section className="px-6 py-20 lg:py-28 bg-secondary/30">
        <motion.div
          className="mx-auto max-w-4xl"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          variants={staggerContainer}
        >
          <motion.h2
            className="font-heading text-3xl sm:text-4xl text-center mb-14"
            variants={fadeUp}
            custom={0}
          >
            How it works
          </motion.h2>

          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            {HOW_IT_WORKS.map((item, i) => {
              const Icon = item.icon;
              return (
                <motion.div
                  key={item.step}
                  className="text-center"
                  variants={fadeUp}
                  custom={i + 1}
                >
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-accent/15 text-accent">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="text-xs font-bold uppercase tracking-widest text-accent mb-2">
                    Step {item.step}
                  </div>
                  <h3 className="font-semibold mb-1">{item.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {item.description}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      </section>

      {/* ── Trust / Security ─────────────────────────────────────── */}
      <section className="px-6 py-20 lg:py-28">
        <motion.div
          className="mx-auto max-w-4xl text-center"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          variants={staggerContainer}
        >
          <motion.div
            className="inline-flex items-center justify-center rounded-full bg-accent/10 p-3 mb-6"
            variants={fadeUp}
            custom={0}
          >
            <Lock className="w-6 h-6 text-accent" />
          </motion.div>

          <motion.h2
            className="font-heading text-3xl sm:text-4xl mb-4"
            variants={fadeUp}
            custom={1}
          >
            Built for trust
          </motion.h2>
          <motion.p
            className="text-muted-foreground mb-12 max-w-xl mx-auto"
            variants={fadeUp}
            custom={2}
          >
            Every layer is designed with financial compliance and data security
            in mind -- from PII screening to FINRA 17a-4 archiving.
          </motion.p>

          {/* Trust badges */}
          <motion.div
            className="flex flex-wrap items-center justify-center gap-4 mb-14"
            variants={fadeUp}
            custom={3}
          >
            {[
              { icon: Shield, label: "FINRA 2210 compliant" },
              { icon: Lock, label: "PII encryption at rest" },
              { icon: Zap, label: "SOC 2 architecture" },
              { icon: Brain, label: "Bias auditing" },
            ].map((badge) => {
              const BadgeIcon = badge.icon;
              return (
                <div
                  key={badge.label}
                  className="flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm"
                >
                  <BadgeIcon className="w-4 h-4 text-accent" />
                  <span>{badge.label}</span>
                </div>
              );
            })}
          </motion.div>

          {/* Stats */}
          <motion.div
            className="grid grid-cols-2 sm:grid-cols-4 gap-6"
            variants={fadeUp}
            custom={4}
          >
            {TRUST_STATS.map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-3xl font-bold text-accent font-heading">
                  {stat.value}
                </div>
                <div className="text-xs text-muted-foreground mt-1 uppercase tracking-wide">
                  {stat.label}
                </div>
              </div>
            ))}
          </motion.div>
        </motion.div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────────── */}
      <section className="relative px-6 py-20 lg:py-28">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
        >
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[400px] w-[600px] rounded-full bg-accent/10 blur-[120px]" />
        </div>

        <motion.div
          className="mx-auto max-w-2xl text-center"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          variants={staggerContainer}
        >
          <motion.h2
            className="font-heading text-3xl sm:text-4xl mb-4"
            variants={fadeUp}
            custom={0}
          >
            Ready to advise with AI?
          </motion.h2>
          <motion.p
            className="text-muted-foreground mb-8"
            variants={fadeUp}
            custom={1}
          >
            Start a conversation now -- no credit card, no setup, just answers.
          </motion.p>
          <motion.div variants={fadeUp} custom={2}>
            <Button
              size="lg"
              className="gap-2 text-base"
              onClick={() => navigate("/chat")}
            >
              <Sparkles className="w-4 h-4" />
              Open Stewardly
            </Button>
          </motion.div>
        </motion.div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────── */}
      <footer className="border-t border-border px-6 py-8">
        <div className="mx-auto max-w-4xl text-center text-xs text-muted-foreground space-y-3">
          <p>
            Stewardly is an AI-assisted platform. It does not provide personalized
            investment advice, tax advice, or legal advice. All recommendations
            should be reviewed by a qualified professional before acting.
          </p>
          <p>
            &copy; {new Date().getFullYear()} Stewardly. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
