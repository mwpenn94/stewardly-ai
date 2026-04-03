/**
 * OpenTelemetry — GenAI semantic conventions for LLM tracing
 * No-ops gracefully when @opentelemetry packages not installed.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let api: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let tracer: any = null;

export async function initOTel(): Promise<void> {
  if (!process.env.OTEL_EXPORTER_OTLP_ENDPOINT) return;

  try {
    api = await (Function('return import("@opentelemetry/api")')() as Promise<any>);
    const { NodeTracerProvider } = await (Function('return import("@opentelemetry/sdk-trace-node")')() as Promise<any>);
    const { OTLPTraceExporter } = await (Function('return import("@opentelemetry/exporter-trace-otlp-http")')() as Promise<any>);
    const { SimpleSpanProcessor } = await (Function('return import("@opentelemetry/sdk-trace-base")')() as Promise<any>);

    const provider = new NodeTracerProvider();
    provider.addSpanProcessor(new SimpleSpanProcessor(new OTLPTraceExporter()));
    provider.register();
    tracer = api.trace.getTracer("stewardly-ai", "1.0.0");
    console.log("[OTel] Initialized successfully");
  } catch {
    console.warn("[OTel] Packages not installed, tracing disabled");
  }
}

export interface LLMSpanAttrs {
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  operation?: string;
}

export function createLLMSpan(name: string, attrs?: LLMSpanAttrs) {
  if (!tracer) return { span: null, end: (_attrs?: LLMSpanAttrs) => {} };

  const span = tracer.startSpan(name, {
    attributes: {
      "gen_ai.system": "anthropic",
      "gen_ai.request.model": attrs?.model || "unknown",
      "gen_ai.operation.name": attrs?.operation || "chat",
    },
  });

  return {
    span,
    end: (endAttrs?: LLMSpanAttrs) => {
      if (endAttrs?.inputTokens) span.setAttribute("gen_ai.usage.input_tokens", endAttrs.inputTokens);
      if (endAttrs?.outputTokens) span.setAttribute("gen_ai.usage.output_tokens", endAttrs.outputTokens);
      span.end();
    },
  };
}

export function getTracer() {
  return tracer;
}
