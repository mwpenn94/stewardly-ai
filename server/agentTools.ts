/**
 * Agent Tools — Manus-Next capabilities surfaced directly in the AI chat.
 *
 * These tools give the chat AI the ability to:
 *   - read_webpage: fetch and summarize any URL
 *   - wide_research: parallel multi-query deep research
 *   - execute_code: sandboxed JS evaluation
 *   - analyze_data: structured data analysis
 *   - generate_image: AI image generation
 *   - generate_document: create structured documents/reports
 *
 * All tools follow the same { type, function: { name, description, parameters } }
 * shape used by SEARCH_TOOLS and CALCULATOR_TOOLS.
 */

import type { Tool } from "./webSearch";

// ── Tool Definitions ────────────────────────────────────────────────────

export const AGENT_TOOLS: Tool[] = [
  {
    type: "function",
    function: {
      name: "read_webpage",
      description:
        "Fetch and summarize the contents of any webpage URL. Use when the user shares a link, asks about a specific webpage, or when you need to read an article, documentation, or any web content. Returns the page title, a summary, and key extracted content.",
      parameters: {
        type: "object",
        properties: {
          url: {
            type: "string",
            description: "The full URL to fetch (must start with http:// or https://)",
          },
          focus: {
            type: "string",
            description:
              "Optional: specific topic or question to focus on when reading the page. Helps extract the most relevant content.",
          },
        },
        required: ["url"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "wide_research",
      description:
        "Conduct deep, parallel research across multiple queries simultaneously. Use when the user needs comprehensive research on a topic, wants to compare information from multiple angles, or needs a thorough analysis that requires searching several related queries. Returns synthesized findings from all queries.",
      parameters: {
        type: "object",
        properties: {
          queries: {
            type: "array",
            items: { type: "string" },
            description:
              "2-5 related search queries to research in parallel. Each query should explore a different angle of the same topic.",
          },
          topic: {
            type: "string",
            description: "The overarching topic being researched (used to synthesize results).",
          },
        },
        required: ["queries", "topic"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "execute_code",
      description:
        "Execute JavaScript code in a sandboxed environment. Use for mathematical calculations, data transformations, date computations, financial formulas, statistical analysis, or any computation the user needs. The code runs in a safe sandbox with no network or filesystem access. Returns the console output and final expression value.",
      parameters: {
        type: "object",
        properties: {
          code: {
            type: "string",
            description:
              "JavaScript code to execute. Use console.log() for output. The last expression value is also captured. Math, Date, JSON, and standard JS built-ins are available.",
          },
          description: {
            type: "string",
            description: "Brief description of what this code does (shown to the user).",
          },
        },
        required: ["code"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "analyze_data",
      description:
        "Analyze structured data and produce insights, statistics, and summaries. Use when the user provides data (numbers, tables, lists) and wants analysis, trends, comparisons, or statistical summaries. Can handle financial data, survey results, performance metrics, etc.",
      parameters: {
        type: "object",
        properties: {
          data: {
            type: "string",
            description:
              "The data to analyze — can be JSON, CSV-formatted text, a table, or a list of values.",
          },
          analysis_type: {
            type: "string",
            enum: [
              "summary_statistics",
              "trend_analysis",
              "comparison",
              "distribution",
              "correlation",
              "forecast",
              "custom",
            ],
            description: "The type of analysis to perform.",
          },
          question: {
            type: "string",
            description: "Specific question to answer about the data.",
          },
        },
        required: ["data", "analysis_type"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "generate_image",
      description:
        "Generate an image using AI based on a text description. Use when the user asks you to create, draw, illustrate, visualize, or generate any image, diagram, chart concept, infographic, or visual content. Returns a URL to the generated image.",
      parameters: {
        type: "object",
        properties: {
          prompt: {
            type: "string",
            description:
              "Detailed description of the image to generate. Be specific about style, composition, colors, and content.",
          },
        },
        required: ["prompt"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "generate_document",
      description:
        "Generate a structured document or report. Use when the user asks you to create a report, summary document, analysis paper, plan, proposal, or any structured written deliverable. Returns the document content in markdown format.",
      parameters: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description: "Title of the document.",
          },
          type: {
            type: "string",
            enum: [
              "report",
              "analysis",
              "plan",
              "proposal",
              "summary",
              "guide",
              "comparison",
              "review",
            ],
            description: "The type of document to generate.",
          },
          outline: {
            type: "string",
            description:
              "Key sections or topics to cover in the document. Can be a comma-separated list or brief outline.",
          },
          context: {
            type: "string",
            description:
              "Additional context, data, or background information to incorporate into the document.",
          },
        },
        required: ["title", "type"],
        additionalProperties: false,
      },
    },
  },
];

// ── Tool Execution ──────────────────────────────────────────────────────

export async function executeAgentTool(
  toolName: string,
  args: Record<string, any>,
): Promise<string> {
  switch (toolName) {
    case "read_webpage":
      return await readWebpage(args.url, args.focus);
    case "wide_research":
      return await wideResearch(args.queries, args.topic);
    case "execute_code":
      return await executeCode(args.code, args.description);
    case "analyze_data":
      return await analyzeData(args.data, args.analysis_type, args.question);
    case "generate_image":
      return await generateImageTool(args.prompt);
    case "generate_document":
      return await generateDocumentTool(args.title, args.type, args.outline, args.context);
    default:
      return JSON.stringify({ error: `Unknown agent tool: ${toolName}` });
  }
}

// ── read_webpage ────────────────────────────────────────────────────────

async function readWebpage(url: string, focus?: string): Promise<string> {
  try {
    if (!url || (!url.startsWith("http://") && !url.startsWith("https://"))) {
      return JSON.stringify({ error: "Invalid URL — must start with http:// or https://" });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Stewardly/1.0; +https://stewardly.manus.space)",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });
    clearTimeout(timeout);

    if (!response.ok) {
      return JSON.stringify({ error: `Failed to fetch: HTTP ${response.status}` });
    }

    const html = await response.text();
    // Basic HTML to text extraction
    const text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "")
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "")
      .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, " ")
      .trim();

    // Extract title
    const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : "Untitled";

    // Truncate to reasonable size
    const maxChars = 6000;
    const truncated = text.length > maxChars ? text.slice(0, maxChars) + "..." : text;

    return JSON.stringify({
      url,
      title,
      content: truncated,
      charCount: text.length,
      ...(focus ? { focus } : {}),
    });
  } catch (err: any) {
    return JSON.stringify({ error: `Failed to read webpage: ${err.message}` });
  }
}

// ── wide_research ───────────────────────────────────────────────────────

async function wideResearch(queries: string[], topic: string): Promise<string> {
  try {
    if (!queries || !Array.isArray(queries) || queries.length === 0) {
      return JSON.stringify({ error: "queries must be a non-empty array of strings" });
    }

    // Import web search utility
    const { executeWebSearch } = await import("./shared/stewardlyWiring");

    // Run all queries in parallel (max 5)
    const limitedQueries = queries.slice(0, 5);
    const results = await Promise.allSettled(
      limitedQueries.map(async (query) => {
        try {
          const result = await executeWebSearch(query, { maxResults: 5, maxChars: 2000 });
          return { query, result, status: "success" as const };
        } catch (err: any) {
          return { query, result: err.message, status: "error" as const };
        }
      }),
    );

    const findings = results.map((r, i) => {
      if (r.status === "fulfilled") {
        return { query: limitedQueries[i], ...r.value };
      }
      return { query: limitedQueries[i], result: "Search failed", status: "error" as const };
    });

    return JSON.stringify({
      topic,
      queriesExecuted: limitedQueries.length,
      findings,
      instruction:
        "Synthesize these parallel research results into a comprehensive answer. Cite specific findings and note any contradictions between sources.",
    });
  } catch (err: any) {
    return JSON.stringify({ error: `Wide research failed: ${err.message}` });
  }
}

// ── execute_code ────────────────────────────────────────────────────────

async function executeCode(code: string, description?: string): Promise<string> {
  try {
    if (!code || typeof code !== "string") {
      return JSON.stringify({ error: "code must be a non-empty string" });
    }

    // Sandboxed execution using vm module
    const { createContext, runInContext } = await import("node:vm");

    const logs: string[] = [];
    const sandbox = {
      console: {
        log: (...args: any[]) => logs.push(args.map(String).join(" ")),
        warn: (...args: any[]) => logs.push("[warn] " + args.map(String).join(" ")),
        error: (...args: any[]) => logs.push("[error] " + args.map(String).join(" ")),
      },
      Math,
      Date,
      JSON,
      parseInt,
      parseFloat,
      isNaN,
      isFinite,
      Number,
      String,
      Boolean,
      Array,
      Object,
      Map,
      Set,
      RegExp,
      Error,
      Promise: undefined, // no async to prevent escaping sandbox
      setTimeout: undefined,
      setInterval: undefined,
      fetch: undefined,
      require: undefined,
      process: undefined,
      global: undefined,
      globalThis: undefined,
    };

    const context = createContext(sandbox);
    const result = runInContext(code, context, { timeout: 5_000 });

    return JSON.stringify({
      success: true,
      output: logs.length > 0 ? logs.join("\n") : undefined,
      result: result !== undefined ? String(result) : undefined,
      ...(description ? { description } : {}),
    });
  } catch (err: any) {
    return JSON.stringify({
      success: false,
      error: err.message,
      ...(err.message.includes("timed out") ? { hint: "Code execution timed out (5s limit)" } : {}),
    });
  }
}

// ── analyze_data ────────────────────────────────────────────────────────

async function analyzeData(
  data: string,
  analysisType: string,
  question?: string,
): Promise<string> {
  try {
    const { invokeLLM } = await import("./_core/llm");

    const result = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You are a data analyst. Analyze the provided data and return structured JSON results.
Analysis type: ${analysisType}
${question ? `Specific question: ${question}` : ""}

Return a JSON object with:
- summary: brief text summary of findings
- metrics: key numeric metrics discovered
- insights: array of insight strings
- recommendations: array of actionable recommendations
- visualizationSuggestion: what chart type would best represent this data`,
        },
        {
          role: "user",
          content: `Analyze this data:\n\n${data}`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "data_analysis",
          strict: true,
          schema: {
            type: "object",
            properties: {
              summary: { type: "string" },
              metrics: {
                type: "object",
                additionalProperties: false,
                properties: {
                  count: { type: "number" },
                  mean: { type: "number" },
                  median: { type: "number" },
                  min: { type: "number" },
                  max: { type: "number" },
                  stdDev: { type: "number" },
                },
                required: ["count", "mean", "median", "min", "max", "stdDev"],
              },
              insights: { type: "array", items: { type: "string" } },
              recommendations: { type: "array", items: { type: "string" } },
              visualizationSuggestion: { type: "string" },
            },
            required: ["summary", "metrics", "insights", "recommendations", "visualizationSuggestion"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = result.choices?.[0]?.message?.content;
    return content || JSON.stringify({ error: "No analysis produced" });
  } catch (err: any) {
    return JSON.stringify({ error: `Data analysis failed: ${err.message}` });
  }
}

// ── generate_image ──────────────────────────────────────────────────────

async function generateImageTool(prompt: string): Promise<string> {
  try {
    const { generateImage } = await import("./_core/imageGeneration");
    const { url } = await generateImage({ prompt });
    return JSON.stringify({
      success: true,
      url,
      prompt,
      instruction: "Display this image to the user using markdown: ![Generated Image](url)",
    });
  } catch (err: any) {
    return JSON.stringify({ error: `Image generation failed: ${err.message}` });
  }
}

// ── generate_document ───────────────────────────────────────────────────

async function generateDocumentTool(
  title: string,
  type: string,
  outline?: string,
  context?: string,
): Promise<string> {
  try {
    const { invokeLLM } = await import("./_core/llm");

    const result = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You are a professional document writer. Create a well-structured ${type} document.
Title: ${title}
${outline ? `Outline/sections to cover: ${outline}` : ""}
${context ? `Context/background: ${context}` : ""}

Write the complete document in markdown format. Include:
- Clear section headings
- Professional tone
- Data and specifics where relevant
- Actionable conclusions or recommendations
- Proper formatting with tables where appropriate`,
        },
        {
          role: "user",
          content: `Generate the ${type}: "${title}"`,
        },
      ],
    });

    const content = result.choices?.[0]?.message?.content || "";
    return JSON.stringify({
      success: true,
      title,
      type,
      content,
      wordCount: content.split(/\s+/).length,
    });
  } catch (err: any) {
    return JSON.stringify({ error: `Document generation failed: ${err.message}` });
  }
}
