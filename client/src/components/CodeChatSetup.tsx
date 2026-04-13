/**
 * CodeChatSetup -- 3-step wizard for configuring Code Chat:
 *   Step 1: Connect (GitHub OAuth or API key)
 *   Step 2: Choose Repos
 *   Step 3: Permissions (read always on, write/execute toggleable)
 */
import { useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ArrowRight,
  ArrowLeft,
  CheckCircle,
  Github,
  Key,
  FolderGit2,
  Shield,
  BookOpen,
  Pencil,
  Terminal,
  AlertTriangle,
  Loader2,
  X,
} from "lucide-react";

// ── Types ───────────────────────────────────────────────────────────
export interface CodeChatSetupProps {
  onComplete: (config: CodeChatConfig) => void;
  onCancel: () => void;
  availableRepos?: string[];
  githubConnected?: boolean;
}

export interface CodeChatConfig {
  connectionMethod: "oauth" | "apikey";
  apiKey?: string;
  selectedRepos: string[];
  permissions: {
    read: true; // always on
    write: boolean;
    execute: boolean;
  };
}

// ── Animation variants ──────────────────────────────────────────────
import type { Variants } from "framer-motion";

const stepVariants: Variants = {
  enter: { x: 60, opacity: 0 },
  center: { x: 0, opacity: 1, transition: { duration: 0.3, ease: "easeOut" as const } },
  exit: { x: -60, opacity: 0, transition: { duration: 0.2, ease: "easeIn" as const } },
};

// ── Step labels ─────────────────────────────────────────────────────
const STEP_LABELS = ["Connect", "Choose Repos", "Permissions"] as const;

const STEP_ICONS = [Github, FolderGit2, Shield] as const;

// ── Component ───────────────────────────────────────────────────────
export default function CodeChatSetup({
  onComplete,
  onCancel,
  availableRepos = [],
  githubConnected = false,
}: CodeChatSetupProps) {
  const [step, setStep] = useState(0);

  // Step 1 state
  const [connectionMethod, setConnectionMethod] = useState<"oauth" | "apikey">(
    githubConnected ? "oauth" : "apikey"
  );
  const [apiKey, setApiKey] = useState("");
  const [apiKeyError, setApiKeyError] = useState<string | null>(null);

  // Step 2 state
  const [selectedRepos, setSelectedRepos] = useState<string[]>([]);

  // Step 3 state
  const [writeEnabled, setWriteEnabled] = useState(false);
  const [executeEnabled, setExecuteEnabled] = useState(false);

  // ── Validation ──────────────────────────────────────────────────
  const isApiKeyValid = useMemo(() => {
    if (connectionMethod === "oauth") return true;
    return apiKey.startsWith("sk-") && apiKey.length > 10;
  }, [connectionMethod, apiKey]);

  const canAdvance = useMemo(() => {
    switch (step) {
      case 0:
        return connectionMethod === "oauth"
          ? githubConnected
          : isApiKeyValid;
      case 1:
        return selectedRepos.length > 0;
      case 2:
        return true; // permissions always valid (read is always on)
      default:
        return false;
    }
  }, [step, connectionMethod, githubConnected, isApiKeyValid, selectedRepos]);

  // ── Navigation ──────────────────────────────────────────────────
  const goNext = useCallback(() => {
    if (step === 0 && connectionMethod === "apikey") {
      if (!apiKey.startsWith("sk-")) {
        setApiKeyError("API key must start with \"sk-\"");
        return;
      }
      if (apiKey.length <= 10) {
        setApiKeyError("API key is too short");
        return;
      }
      setApiKeyError(null);
    }

    if (step < 2) {
      setStep((s) => s + 1);
    } else {
      onComplete({
        connectionMethod,
        apiKey: connectionMethod === "apikey" ? apiKey : undefined,
        selectedRepos,
        permissions: {
          read: true,
          write: writeEnabled,
          execute: executeEnabled,
        },
      });
    }
  }, [step, connectionMethod, apiKey, selectedRepos, writeEnabled, executeEnabled, onComplete]);

  const goBack = useCallback(() => {
    setStep((s) => Math.max(0, s - 1));
  }, []);

  const toggleRepo = useCallback((repo: string) => {
    setSelectedRepos((prev) =>
      prev.includes(repo) ? prev.filter((r) => r !== repo) : [...prev, repo]
    );
  }, []);

  // ── Render steps ────────────────────────────────────────────────
  function renderStep0() {
    return (
      <div className="space-y-6">
        <p className="text-sm text-muted-foreground">
          Connect your GitHub account so Code Chat can browse repositories,
          review PRs, and (optionally) make changes.
        </p>

        {/* OAuth option */}
        <button
          type="button"
          onClick={() => {
            setConnectionMethod("oauth");
            setApiKeyError(null);
          }}
          className={`w-full flex items-center gap-4 rounded-xl border p-4 text-left transition-colors ${
            connectionMethod === "oauth"
              ? "border-accent bg-accent/5"
              : "border-border hover:border-accent/30"
          }`}
        >
          <div className="flex items-center justify-center rounded-lg bg-accent/10 p-2.5">
            <Github className="w-5 h-5 text-accent" />
          </div>
          <div className="flex-1">
            <div className="font-semibold text-sm">GitHub OAuth</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {githubConnected
                ? "Connected -- your GitHub account is linked."
                : "Sign in with GitHub to authorize access."}
            </div>
          </div>
          {connectionMethod === "oauth" && (
            <CheckCircle className="w-5 h-5 text-accent shrink-0" />
          )}
        </button>

        {/* API key option */}
        <button
          type="button"
          onClick={() => setConnectionMethod("apikey")}
          className={`w-full flex items-start gap-4 rounded-xl border p-4 text-left transition-colors ${
            connectionMethod === "apikey"
              ? "border-accent bg-accent/5"
              : "border-border hover:border-accent/30"
          }`}
        >
          <div className="flex items-center justify-center rounded-lg bg-accent/10 p-2.5 mt-0.5">
            <Key className="w-5 h-5 text-accent" />
          </div>
          <div className="flex-1">
            <div className="font-semibold text-sm">API Key</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Paste a GitHub Personal Access Token (classic or fine-grained).
            </div>

            {connectionMethod === "apikey" && (
              <div className="mt-3" onClick={(e) => e.stopPropagation()}>
                <Input
                  type="password"
                  placeholder="sk-..."
                  value={apiKey}
                  onChange={(e) => {
                    setApiKey(e.target.value);
                    setApiKeyError(null);
                  }}
                  className="font-mono text-xs"
                  autoFocus
                />
                {apiKeyError && (
                  <div className="flex items-center gap-1.5 mt-2 text-xs text-destructive">
                    <AlertTriangle className="w-3 h-3 shrink-0" />
                    {apiKeyError}
                  </div>
                )}
              </div>
            )}
          </div>
          {connectionMethod === "apikey" && !apiKeyError && isApiKeyValid && (
            <CheckCircle className="w-5 h-5 text-accent shrink-0 mt-0.5" />
          )}
        </button>
      </div>
    );
  }

  function renderStep1() {
    const repos = availableRepos.length > 0
      ? availableRepos
      : ["stewardly-ai", "emba_modules", "wealth-bridge"];

    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Select which repositories Code Chat can access.
          {availableRepos.length === 0 && (
            <span className="block mt-1 text-xs italic">
              Showing defaults -- connect GitHub to see your actual repos.
            </span>
          )}
        </p>

        <div className="space-y-2">
          {repos.map((repo) => {
            const selected = selectedRepos.includes(repo);
            return (
              <button
                key={repo}
                type="button"
                onClick={() => toggleRepo(repo)}
                className={`w-full flex items-center gap-3 rounded-lg border p-3 text-left text-sm transition-colors ${
                  selected
                    ? "border-accent bg-accent/5"
                    : "border-border hover:border-accent/30"
                }`}
              >
                <FolderGit2 className={`w-4 h-4 shrink-0 ${selected ? "text-accent" : "text-muted-foreground"}`} />
                <span className="font-mono text-xs flex-1">{repo}</span>
                {selected && <CheckCircle className="w-4 h-4 text-accent shrink-0" />}
              </button>
            );
          })}
        </div>

        {selectedRepos.length > 0 && (
          <div className="text-xs text-muted-foreground">
            {selectedRepos.length} repo{selectedRepos.length !== 1 ? "s" : ""} selected
          </div>
        )}
      </div>
    );
  }

  function renderStep2() {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Configure what Code Chat is allowed to do. Read access is always
          enabled; write and execute are opt-in.
        </p>

        <div className="space-y-3">
          {/* Read -- always on */}
          <div className="flex items-center gap-4 rounded-lg border border-border bg-secondary/30 p-4">
            <div className="flex items-center justify-center rounded-lg bg-accent/10 p-2">
              <BookOpen className="w-4 h-4 text-accent" />
            </div>
            <div className="flex-1">
              <div className="font-semibold text-sm">Read</div>
              <div className="text-xs text-muted-foreground">
                Browse files, search code, list directories.
              </div>
            </div>
            <div className="rounded-full bg-accent/20 px-2.5 py-0.5 text-xs font-medium text-accent">
              Always on
            </div>
          </div>

          {/* Write -- toggleable */}
          <button
            type="button"
            onClick={() => setWriteEnabled((v) => !v)}
            className={`w-full flex items-center gap-4 rounded-lg border p-4 text-left transition-colors ${
              writeEnabled
                ? "border-accent bg-accent/5"
                : "border-border hover:border-accent/30"
            }`}
          >
            <div className="flex items-center justify-center rounded-lg bg-accent/10 p-2">
              <Pencil className="w-4 h-4 text-accent" />
            </div>
            <div className="flex-1">
              <div className="font-semibold text-sm">Write</div>
              <div className="text-xs text-muted-foreground">
                Create and edit files in selected repos.
              </div>
            </div>
            <div
              className={`w-10 h-6 rounded-full p-0.5 transition-colors ${
                writeEnabled ? "bg-accent" : "bg-border"
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-background shadow-sm transition-transform ${
                  writeEnabled ? "translate-x-4" : "translate-x-0"
                }`}
              />
            </div>
          </button>

          {/* Execute -- toggleable */}
          <button
            type="button"
            onClick={() => setExecuteEnabled((v) => !v)}
            className={`w-full flex items-center gap-4 rounded-lg border p-4 text-left transition-colors ${
              executeEnabled
                ? "border-accent bg-accent/5"
                : "border-border hover:border-accent/30"
            }`}
          >
            <div className="flex items-center justify-center rounded-lg bg-accent/10 p-2">
              <Terminal className="w-4 h-4 text-accent" />
            </div>
            <div className="flex-1">
              <div className="font-semibold text-sm">Execute</div>
              <div className="text-xs text-muted-foreground">
                Run bash commands (admin only, sandboxed).
              </div>
            </div>
            <div
              className={`w-10 h-6 rounded-full p-0.5 transition-colors ${
                executeEnabled ? "bg-accent" : "bg-border"
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-background shadow-sm transition-transform ${
                  executeEnabled ? "translate-x-4" : "translate-x-0"
                }`}
              />
            </div>
          </button>
        </div>

        {(writeEnabled || executeEnabled) && (
          <div className="flex items-start gap-2 rounded-lg border border-chart-4/30 bg-chart-4/5 p-3 text-xs text-chart-4">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>
              Write and execute permissions allow Code Chat to modify files and
              run commands. All actions are logged and audit-trailed.
            </span>
          </div>
        )}
      </div>
    );
  }

  // ── Main render ─────────────────────────────────────────────────
  return (
    <div className="w-full max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-heading text-xl">Code Chat Setup</h2>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
          aria-label="Cancel setup"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Step indicators */}
      <div className="flex items-center gap-1 mb-8">
        {STEP_LABELS.map((label, i) => {
          const StepIcon = STEP_ICONS[i];
          const isActive = i === step;
          const isDone = i < step;
          return (
            <div key={label} className="flex items-center flex-1">
              <div className="flex items-center gap-2 flex-1">
                <div
                  className={`flex items-center justify-center rounded-full w-7 h-7 text-xs font-bold transition-colors ${
                    isActive
                      ? "bg-accent text-accent-foreground"
                      : isDone
                        ? "bg-accent/30 text-accent"
                        : "bg-border text-muted-foreground"
                  }`}
                >
                  {isDone ? (
                    <CheckCircle className="w-4 h-4" />
                  ) : (
                    <StepIcon className="w-3.5 h-3.5" />
                  )}
                </div>
                <span
                  className={`text-xs font-medium hidden sm:inline ${
                    isActive ? "text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {label}
                </span>
              </div>
              {i < STEP_LABELS.length - 1 && (
                <div
                  className={`h-px flex-1 mx-2 transition-colors ${
                    isDone ? "bg-accent/50" : "bg-border"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Animated step content */}
      <div className="relative overflow-hidden min-h-[280px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            variants={stepVariants}
            initial="enter"
            animate="center"
            exit="exit"
          >
            {step === 0 && renderStep0()}
            {step === 1 && renderStep1()}
            {step === 2 && renderStep2()}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between mt-8 pt-4 border-t border-border">
        <Button
          variant="ghost"
          size="sm"
          onClick={step === 0 ? onCancel : goBack}
          className="gap-1.5"
        >
          {step === 0 ? (
            "Cancel"
          ) : (
            <>
              <ArrowLeft className="w-3.5 h-3.5" />
              Back
            </>
          )}
        </Button>

        <Button
          size="sm"
          onClick={goNext}
          disabled={!canAdvance}
          className="gap-1.5"
        >
          {step === 2 ? (
            <>
              <CheckCircle className="w-3.5 h-3.5" />
              Complete Setup
            </>
          ) : (
            <>
              Next
              <ArrowRight className="w-3.5 h-3.5" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
