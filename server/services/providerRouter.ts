/**
 * Provider Router — Multi-provider abstraction with failover
 * Default: forge-only mode (zero config needed). Optional: Anthropic, OpenAI, Ollama.
 */
import { logger } from "../_core/logger";

const log = logger.child({ module: "providerRouter" });

interface Provider {
  name: string;
  url: string;
  key: string | null;
  models: string[];
  priority: number;
  healthy: boolean;
  lastCheck: number;
  failures: number;
}

const providers: Provider[] = [];
let initialized = false;

function initProviders(): void {
  if (initialized) return;
  initialized = true;

  if (process.env.BUILT_IN_FORGE_API_URL && process.env.BUILT_IN_FORGE_API_KEY) {
    providers.push({ name: "forge", url: process.env.BUILT_IN_FORGE_API_URL, key: process.env.BUILT_IN_FORGE_API_KEY, models: ["*"], priority: 1, healthy: true, lastCheck: 0, failures: 0 });
  }
  if (process.env.ANTHROPIC_API_KEY) {
    providers.push({ name: "anthropic", url: "https://api.anthropic.com/v1", key: process.env.ANTHROPIC_API_KEY, models: ["claude-*"], priority: 2, healthy: true, lastCheck: 0, failures: 0 });
  }
  if (process.env.OPENAI_API_KEY) {
    providers.push({ name: "openai", url: "https://api.openai.com/v1", key: process.env.OPENAI_API_KEY, models: ["gpt-*", "o*"], priority: 3, healthy: true, lastCheck: 0, failures: 0 });
  }
  if (process.env.OLLAMA_URL) {
    providers.push({ name: "ollama", url: process.env.OLLAMA_URL, key: null, models: ["llama*", "mistral*"], priority: 4, healthy: true, lastCheck: 0, failures: 0 });
  }
}

export function getAvailableProviders(): Array<{ name: string; models: string[]; healthy: boolean }> {
  initProviders();
  return providers.map(p => ({ name: p.name, models: p.models, healthy: p.healthy }));
}

export function selectProvider(model?: string): Provider | null {
  initProviders();
  const healthy = providers.filter(p => p.healthy).sort((a, b) => a.priority - b.priority);

  if (!model) return healthy[0] || null;

  for (const p of healthy) {
    if (p.models.includes("*") || p.models.some(m => {
      const pattern = m.replace("*", ".*");
      return new RegExp(`^${pattern}$`).test(model);
    })) {
      return p;
    }
  }
  return healthy[0] || null;
}

export function markFailure(providerName: string): void {
  const p = providers.find(pr => pr.name === providerName);
  if (!p) return;
  p.failures++;
  if (p.failures >= 3) {
    p.healthy = false;
    log.warn({ provider: providerName }, "Provider circuit breaker tripped — 3 failures");
    // Reset after 60s
    setTimeout(() => { p.healthy = true; p.failures = 0; }, 60000);
  }
}

export function markSuccess(providerName: string): void {
  const p = providers.find(pr => pr.name === providerName);
  if (p) { p.failures = 0; p.healthy = true; }
}
