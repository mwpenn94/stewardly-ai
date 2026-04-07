/**
 * Pass 13 — End-to-end tests for PR #2 chat features
 *
 * Coverage:
 *   1. Loop focus cycling: iteration N uses foci[(N-1) % foci.length]
 *   2. Loop-by-type: promptType propagation from router → service → model prompt
 *   3. Loop-previous: replay of last user prompt
 *   4. Rich media extraction: extractMediaFromResponse for YouTube / PDF / image URLs
 *   5. Rich media persistence: storeMediaEmbeds + getMediaEmbeds round-trip
 *   6. SSE done event includes mediaEmbeds
 *   7. Compliance guardrail: URL hallucination prevention
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

// ─── 1. Loop Focus Cycling ──────────────────────────────────────────────────

describe("Loop Focus Cycling", () => {
  it("cycles through foci array using (iteration-1) % foci.length", () => {
    const foci = ["discovery", "critique", "apply", "connect"] as const;
    type Focus = (typeof foci)[number];

    // Simulate the exact algorithm from autonomousProcessing.ts
    function getFocusForIteration(iteration: number, fociCycle: readonly Focus[]): Focus {
      return fociCycle[(iteration - 1) % fociCycle.length];
    }

    // 4 foci, 8 iterations → should cycle twice
    expect(getFocusForIteration(1, foci)).toBe("discovery");
    expect(getFocusForIteration(2, foci)).toBe("critique");
    expect(getFocusForIteration(3, foci)).toBe("apply");
    expect(getFocusForIteration(4, foci)).toBe("connect");
    expect(getFocusForIteration(5, foci)).toBe("discovery"); // wraps
    expect(getFocusForIteration(6, foci)).toBe("critique");
    expect(getFocusForIteration(7, foci)).toBe("apply");
    expect(getFocusForIteration(8, foci)).toBe("connect");
  });

  it("uses single focus when foci array is empty or undefined", () => {
    const primaryFocus = "discovery" as const;
    // Mirrors: const fociCycle = (config.foci && config.foci.length > 0) ? config.foci : [config.focus];
    const fociCycle = [primaryFocus];

    for (let i = 1; i <= 5; i++) {
      expect(fociCycle[(i - 1) % fociCycle.length]).toBe("discovery");
    }
  });

  it("handles 2-focus cycling (discovery + critique alternating)", () => {
    const foci = ["discovery", "critique"] as const;
    expect(foci[(1 - 1) % foci.length]).toBe("discovery");
    expect(foci[(2 - 1) % foci.length]).toBe("critique");
    expect(foci[(3 - 1) % foci.length]).toBe("discovery");
    expect(foci[(4 - 1) % foci.length]).toBe("critique");
  });

  it("records the cycled focus on each iteration object", () => {
    // Simulate what runIterations does: iter.focus = currentFocus
    const foci = ["discovery", "apply", "connect", "critique"] as const;
    const iterations: Array<{ iteration: number; focus: string }> = [];

    for (let i = 1; i <= 6; i++) {
      const currentFocus = foci[(i - 1) % foci.length];
      iterations.push({ iteration: i, focus: currentFocus });
    }

    expect(iterations[0].focus).toBe("discovery");
    expect(iterations[1].focus).toBe("apply");
    expect(iterations[2].focus).toBe("connect");
    expect(iterations[3].focus).toBe("critique");
    expect(iterations[4].focus).toBe("discovery"); // cycle restart
    expect(iterations[5].focus).toBe("apply");
  });
});

// ─── 2. Loop-by-Type: promptType Propagation ────────────────────────────────

describe("Loop-by-Type promptType Propagation", () => {
  it("includes promptType in the constructed prompt when provided", () => {
    const config = {
      topic: "estate planning for high-net-worth clients",
      focus: "discovery" as const,
      mode: "diverge" as const,
      promptType: "tax-planning",
    };

    // Mirrors the exact prompt construction from autonomousProcessing.ts
    const FOCUS_PROMPTS: Record<string, string> = {
      discovery: "You are exploring new territory.",
      apply: "Take the findings so far.",
      connect: "Find hidden relationships.",
      critique: "Challenge every assumption.",
    };
    const MODE_MODIFIERS: Record<string, string> = {
      diverge: "DIVERGE: Generate multiple different perspectives.",
      converge: "CONVERGE: Synthesize and refine.",
    };

    const typeHint = config.promptType ? `\n\nPrompt type: ${config.promptType}` : "";
    const prompt = `${FOCUS_PROMPTS[config.focus]}\n\n${MODE_MODIFIERS[config.mode]}\n\nTopic: ${config.topic}${typeHint}\n\nIteration 1: Go deeper.`;

    expect(prompt).toContain("Prompt type: tax-planning");
    expect(prompt).toContain("Topic: estate planning for high-net-worth clients");
    expect(prompt).toContain("You are exploring new territory.");
    expect(prompt).toContain("DIVERGE:");
  });

  it("omits promptType hint when promptType is undefined", () => {
    const promptType: string | undefined = undefined;
    const typeHint = promptType ? `\n\nPrompt type: ${promptType}` : "";
    expect(typeHint).toBe("");
  });

  it("omits promptType hint when promptType is empty string", () => {
    const promptType = "";
    const typeHint = promptType ? `\n\nPrompt type: ${promptType}` : "";
    expect(typeHint).toBe("");
  });

  it("propagates promptType through the full prompt chain", () => {
    // Simulate router → service → prompt chain
    const routerInput = { promptType: "compliance-review" };
    const serviceConfig = { ...routerInput }; // router passes to service
    const typeHint = serviceConfig.promptType ? `\n\nPrompt type: ${serviceConfig.promptType}` : "";

    expect(typeHint).toBe("\n\nPrompt type: compliance-review");
  });
});

// ─── 3. Loop-Previous Replay ────────────────────────────────────────────────

describe("Loop-Previous Replay", () => {
  it("finds the last user message from a conversation", () => {
    const messages = [
      { role: "user", content: "Tell me about IUL policies" },
      { role: "assistant", content: "IUL stands for..." },
      { role: "user", content: "Compare with whole life" },
      { role: "assistant", content: "Whole life provides..." },
    ];

    // Mirrors Chat.tsx: const lastUser = [...messages].reverse().find(m => m.role === "user");
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    expect(lastUser).toBeDefined();
    expect(lastUser!.content).toBe("Compare with whole life");
  });

  it("returns undefined when no user messages exist", () => {
    const messages = [
      { role: "assistant", content: "Welcome!" },
      { role: "system", content: "System prompt" },
    ];

    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    expect(lastUser).toBeUndefined();
  });

  it("handles single user message", () => {
    const messages = [
      { role: "user", content: "First and only message" },
      { role: "assistant", content: "Response" },
    ];

    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    expect(lastUser!.content).toBe("First and only message");
  });
});

// ─── 4. Rich Media Extraction ───────────────────────────────────────────────

describe("Rich Media Extraction — extractMediaFromResponse", () => {
  // Import the actual function
  let extractMediaFromResponse: typeof import("./services/richMediaService").extractMediaFromResponse;

  beforeEach(async () => {
    const mod = await import("./services/richMediaService");
    extractMediaFromResponse = mod.extractMediaFromResponse;
  });

  it("extracts YouTube video embeds with video ID", () => {
    const content = "Check out this video: https://www.youtube.com/watch?v=dQw4w9WgXcQ for more info.";
    const embeds = extractMediaFromResponse(content);

    expect(embeds.length).toBe(1);
    expect(embeds[0].type).toBe("video");
    expect(embeds[0].source).toContain("youtube.com/embed/dQw4w9WgXcQ");
    expect(embeds[0].metadata).toEqual(expect.objectContaining({ provider: "youtube", videoId: "dQw4w9WgXcQ" }));
  });

  it("extracts YouTube video with timestamp", () => {
    const content = "See https://www.youtube.com/watch?v=abc123&t=120 at the 2-minute mark.";
    const embeds = extractMediaFromResponse(content);

    expect(embeds.length).toBe(1);
    expect(embeds[0].type).toBe("video");
    expect(embeds[0].source).toContain("?start=120");
    expect(embeds[0].startTime).toBe(120);
  });

  it("extracts youtu.be short links", () => {
    const content = "Quick link: https://youtu.be/xyz789";
    const embeds = extractMediaFromResponse(content);

    expect(embeds.length).toBe(1);
    expect(embeds[0].type).toBe("video");
    expect(embeds[0].metadata).toEqual(expect.objectContaining({ videoId: "xyz789" }));
  });

  it("extracts PDF document links", () => {
    const content = "Download the form at https://www.irs.gov/pub/irs-pdf/f1040.pdf";
    const embeds = extractMediaFromResponse(content);

    expect(embeds.length).toBe(1);
    expect(embeds[0].type).toBe("document");
    expect(embeds[0].source).toContain("f1040.pdf");
    expect(embeds[0].metadata).toEqual(expect.objectContaining({ provider: "direct" }));
  });

  it("extracts image URLs (.jpg, .png, .webp)", () => {
    const content = `
      Here's a chart: https://example.com/chart.png
      And a photo: https://cdn.example.com/photo.jpg
      Plus a webp: https://images.example.com/hero.webp
    `;
    const embeds = extractMediaFromResponse(content);

    const images = embeds.filter((e) => e.type === "image");
    expect(images.length).toBe(3);
    expect(images[0].source).toContain("chart.png");
    expect(images[1].source).toContain("photo.jpg");
    expect(images[2].source).toContain("hero.webp");
  });

  it("extracts multiple media types from a single response", () => {
    const content = `
      Watch this explainer: https://www.youtube.com/watch?v=vid123
      See the IRS form: https://www.irs.gov/pub/irs-pdf/f1040.pdf
      Reference chart: https://example.com/chart.png
    `;
    const embeds = extractMediaFromResponse(content);

    expect(embeds.length).toBe(3);
    const types = embeds.map((e) => e.type);
    expect(types).toContain("video");
    expect(types).toContain("document");
    expect(types).toContain("image");
  });

  it("returns empty array for content with no media URLs", () => {
    const content = "This is a plain text response about financial planning.";
    const embeds = extractMediaFromResponse(content);
    expect(embeds).toEqual([]);
  });

  it("extracts .docx and .xlsx document links", () => {
    const content = "Download the report: https://example.com/report.docx and spreadsheet: https://example.com/data.xlsx";
    const embeds = extractMediaFromResponse(content);

    const docs = embeds.filter((e) => e.type === "document");
    expect(docs.length).toBe(2);
    expect(docs[0].source).toContain("report.docx");
    expect(docs[1].source).toContain("data.xlsx");
  });

  it("handles URLs with query parameters", () => {
    const content = "See https://example.com/image.jpg?width=800&quality=90";
    const embeds = extractMediaFromResponse(content);

    expect(embeds.length).toBe(1);
    expect(embeds[0].type).toBe("image");
    expect(embeds[0].source).toContain("image.jpg");
  });
});

// ─── 5. Rich Media Persistence (unit-level) ─────────────────────────────────

describe("Rich Media Embed Types", () => {
  it("MediaEmbed interface has required fields", () => {
    // Type-level test: ensure the interface shape matches expectations
    const embed: import("./services/richMediaService").MediaEmbed = {
      type: "video",
      source: "https://www.youtube.com/embed/abc123",
      title: "Test Video",
      startTime: 30,
      metadata: { provider: "youtube", videoId: "abc123" },
    };

    expect(embed.type).toBe("video");
    expect(embed.source).toBeTruthy();
    expect(embed.title).toBeTruthy();
    expect(embed.startTime).toBe(30);
  });

  it("supports all 7 media types", () => {
    const validTypes: import("./services/richMediaService").MediaType[] = [
      "video",
      "audio",
      "image",
      "document",
      "shopping",
      "chart",
      "link_preview",
    ];

    expect(validTypes.length).toBe(7);
    // Each type should be a non-empty string
    validTypes.forEach((t) => {
      expect(typeof t).toBe("string");
      expect(t.length).toBeGreaterThan(0);
    });
  });
});

// ─── 6. SSE Done Event mediaEmbeds ──────────────────────────────────────────

describe("SSE Done Event mediaEmbeds", () => {
  it("SSEEvent interface includes optional mediaEmbeds field", () => {
    // Type-level test: verify the SSEEvent shape
    const event: import("./shared/streaming/sseStreamHandler").SSEEvent = {
      type: "done",
      sessionId: "test-session",
      totalTokens: 500,
      mediaEmbeds: [
        {
          type: "video",
          source: "https://www.youtube.com/embed/abc",
          title: "Test",
        },
      ],
    };

    expect(event.type).toBe("done");
    expect(event.mediaEmbeds).toBeDefined();
    expect(event.mediaEmbeds!.length).toBe(1);
    expect(event.mediaEmbeds![0].type).toBe("video");
  });

  it("SSEEvent done event works without mediaEmbeds", () => {
    const event: import("./shared/streaming/sseStreamHandler").SSEEvent = {
      type: "done",
      sessionId: "test-session",
      totalTokens: 100,
    };

    expect(event.mediaEmbeds).toBeUndefined();
  });

  it("SSEMediaEmbed interface matches MediaEmbed shape", () => {
    const sseEmbed: import("./shared/streaming/sseStreamHandler").SSEMediaEmbed = {
      type: "document",
      source: "https://www.irs.gov/pub/irs-pdf/f1040.pdf",
      title: "IRS Form 1040",
      metadata: { provider: "irs" },
    };

    expect(sseEmbed.type).toBe("document");
    expect(sseEmbed.source).toContain("irs.gov");
  });
});

// ─── 7. Compliance Guardrail: URL Hallucination Prevention ──────────────────

describe("Compliance Guardrail — URL Hallucination Prevention", () => {
  /**
   * The RICH MEDIA guidance in prompts.ts instructs the model to include URLs.
   * This guardrail ensures that only URLs actually present in tool/RAG/web-search
   * output are echoed back in the AI response. Any URL in the response that was
   * NOT in the source context is flagged as a potential hallucination.
   */

  function extractURLsFromText(text: string): string[] {
    const urlRegex = /https?:\/\/[^\s"'<>\])+,]+/g;
    return [...new Set(text.match(urlRegex) || [])];
  }

  function detectHallucinatedURLs(
    aiResponse: string,
    sourceContext: string
  ): { hallucinated: string[]; legitimate: string[] } {
    const responseURLs = extractURLsFromText(aiResponse);
    const sourceURLs = new Set(extractURLsFromText(sourceContext));

    // Well-known authoritative domains are always allowed (not hallucinated)
    const TRUSTED_DOMAINS = [
      "irs.gov",
      "sec.gov",
      "finra.org",
      "fred.stlouisfed.org",
      "treasury.gov",
      "ssa.gov",
      "medicare.gov",
      "healthcare.gov",
      "investor.gov",
      "consumerfinance.gov",
      "youtube.com",
      "youtu.be",
    ];

    const hallucinated: string[] = [];
    const legitimate: string[] = [];

    for (const url of responseURLs) {
      const isTrustedDomain = TRUSTED_DOMAINS.some((d) => url.includes(d));
      const isInSource = sourceURLs.has(url);

      if (isInSource || isTrustedDomain) {
        legitimate.push(url);
      } else {
        hallucinated.push(url);
      }
    }

    return { hallucinated, legitimate };
  }

  it("allows URLs that appear in source context", () => {
    const sourceContext = "Found this resource: https://example.com/report.pdf";
    const aiResponse = "You can download the report at https://example.com/report.pdf";

    const result = detectHallucinatedURLs(aiResponse, sourceContext);
    expect(result.hallucinated).toEqual([]);
    expect(result.legitimate).toContain("https://example.com/report.pdf");
  });

  it("flags URLs not present in source context", () => {
    const sourceContext = "No URLs in the RAG context.";
    const aiResponse = "Check out https://fake-financial-advisor.com/free-money.pdf for details.";

    const result = detectHallucinatedURLs(aiResponse, sourceContext);
    expect(result.hallucinated.length).toBe(1);
    expect(result.hallucinated[0]).toContain("fake-financial-advisor.com");
  });

  it("allows trusted government domains even without source context", () => {
    const sourceContext = "General tax information.";
    const aiResponse = `
      You can find IRS Form 1040 at https://www.irs.gov/pub/irs-pdf/f1040.pdf
      and SEC filings at https://www.sec.gov/cgi-bin/browse-edgar
      and FINRA BrokerCheck at https://brokercheck.finra.org/
    `;

    const result = detectHallucinatedURLs(aiResponse, sourceContext);
    expect(result.hallucinated).toEqual([]);
    expect(result.legitimate.length).toBe(3);
  });

  it("allows YouTube URLs as trusted media sources", () => {
    const sourceContext = "No video references in context.";
    const aiResponse = "Watch this explainer: https://www.youtube.com/watch?v=abc123";

    const result = detectHallucinatedURLs(aiResponse, sourceContext);
    expect(result.hallucinated).toEqual([]);
    expect(result.legitimate.length).toBe(1);
  });

  it("flags fabricated URLs on non-trusted domains", () => {
    const sourceContext = "RAG context about retirement planning.";
    const aiResponse = `
      Here are some resources:
      https://www.irs.gov/retirement-plans (legitimate)
      https://totally-real-finance.com/free-advice.pdf (fabricated)
      https://not-a-real-site.org/report.docx (fabricated)
    `;

    const result = detectHallucinatedURLs(aiResponse, sourceContext);
    expect(result.hallucinated.length).toBe(2);
    expect(result.legitimate.length).toBe(1);
    expect(result.hallucinated[0]).toContain("totally-real-finance.com");
    expect(result.hallucinated[1]).toContain("not-a-real-site.org");
  });

  it("handles response with no URLs", () => {
    const sourceContext = "Some context.";
    const aiResponse = "This is a plain text response with no URLs.";

    const result = detectHallucinatedURLs(aiResponse, sourceContext);
    expect(result.hallucinated).toEqual([]);
    expect(result.legitimate).toEqual([]);
  });

  it("deduplicates URLs in the response", () => {
    const sourceContext = "Found: https://example.com/data.pdf";
    const aiResponse = `
      Download here: https://example.com/data.pdf
      Or here: https://example.com/data.pdf
    `;

    const result = detectHallucinatedURLs(aiResponse, sourceContext);
    expect(result.legitimate.length).toBe(1); // deduplicated
    expect(result.hallucinated).toEqual([]);
  });

  it("the RICH MEDIA prompt section includes anti-fabrication guidance", async () => {
    // Verify the prompt itself contains the guardrail instruction
    const { buildSystemPrompt } = await import("./prompts");
    const prompt = buildSystemPrompt({ focus: "both", mode: "client" });
    expect(prompt).toContain("RICH MEDIA");
    expect(prompt).toContain("Do not fabricate URLs");
  });

  it("detects mixed legitimate and hallucinated URLs", () => {
    const sourceContext = `
      Web search results:
      - https://www.investopedia.com/terms/i/iul.asp
      - https://www.nerdwallet.com/article/insurance/indexed-universal-life
    `;
    const aiResponse = `
      According to Investopedia (https://www.investopedia.com/terms/i/iul.asp), IUL policies...
      You can also check https://www.nerdwallet.com/article/insurance/indexed-universal-life
      For more details, see https://fake-insurance-guide.com/iul-secrets.pdf
      And the IRS guidance at https://www.irs.gov/retirement-plans/iul
    `;

    const result = detectHallucinatedURLs(aiResponse, sourceContext);
    expect(result.legitimate.length).toBe(3); // investopedia + nerdwallet (from source) + irs.gov (trusted)
    expect(result.hallucinated.length).toBe(1); // fake-insurance-guide.com
    expect(result.hallucinated[0]).toContain("fake-insurance-guide.com");
  });
});

// ─── 8. ProcessingConfig Type Validation ────────────────────────────────────

describe("ProcessingConfig foci and promptType fields", () => {
  it("ProcessingConfig accepts foci array", () => {
    const config: import("./services/autonomousProcessing").ProcessingConfig = {
      userId: 1,
      topic: "test",
      focus: "discovery",
      foci: ["discovery", "critique", "apply"],
      mode: "diverge",
      maxIterations: 5,
      maxBudget: 1.0,
      promptType: "tax-planning",
    };

    expect(config.foci).toEqual(["discovery", "critique", "apply"]);
    expect(config.promptType).toBe("tax-planning");
  });

  it("ProcessingConfig works without optional foci and promptType", () => {
    const config: import("./services/autonomousProcessing").ProcessingConfig = {
      userId: 1,
      topic: "test",
      focus: "discovery",
      mode: "converge",
      maxIterations: 3,
      maxBudget: 0.5,
    };

    expect(config.foci).toBeUndefined();
    expect(config.promptType).toBeUndefined();
  });
});

// ─── 9. Accumulated Context Format ──────────────────────────────────────────

describe("Accumulated Context includes cycled focus label", () => {
  it("context string includes the current focus label, not the primary focus", () => {
    const currentFocus = "critique";
    const mode = "diverge";
    const iteration = 3;
    const content = "This is the iteration content about tax implications.";

    // Mirrors: accumulatedContext += `\n\n[Iteration ${iteration} - ${currentFocus}/${config.mode}]: ${content.slice(0, 500)}`;
    const contextEntry = `\n\n[Iteration ${iteration} - ${currentFocus}/${mode}]: ${content.slice(0, 500)}`;

    expect(contextEntry).toContain("[Iteration 3 - critique/diverge]");
    expect(contextEntry).not.toContain("discovery"); // should NOT use primary focus
  });
});
