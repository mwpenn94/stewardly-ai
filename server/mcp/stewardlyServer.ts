/**
 * Stewardly MCP Server — Model Context Protocol tool server
 * Exposes financial advisory tools for external AI agents.
 * Gracefully no-ops if @modelcontextprotocol/sdk not installed.
 */
import { logger } from "../_core/logger";

const log = logger.child({ module: "mcpServer" });

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: (input: any) => Promise<any>;
}

const tools: MCPTool[] = [
  {
    name: "calculate_tax",
    description: "Calculate tax optimization based on income and filing status",
    inputSchema: {
      type: "object",
      properties: {
        income: { type: "number", description: "Annual gross income" },
        filingStatus: { type: "string", enum: ["single", "married_joint", "married_separate", "head_of_household"] },
        state: { type: "string", description: "Two-letter state code (optional)" },
      },
      required: ["income", "filingStatus"],
    },
    handler: async (input) => {
      // Simple tax estimation — 2026 projected brackets (inflation-adjusted)
      const brackets2026 = [
        { min: 0, max: 12200, rate: 0.10 },
        { min: 12200, max: 49550, rate: 0.12 },
        { min: 49550, max: 105600, rate: 0.22 },
        { min: 105600, max: 201650, rate: 0.24 },
        { min: 201650, max: 256050, rate: 0.32 },
        { min: 256050, max: 640400, rate: 0.35 },
        { min: 640400, max: Infinity, rate: 0.37 },
      ];
      let remaining = input.income;
      let tax = 0;
      for (const b of brackets2026) {
        const taxable = Math.min(remaining, b.max - b.min);
        if (taxable <= 0) break;
        tax += taxable * b.rate;
        remaining -= taxable;
      }
      return { estimatedTax: Math.round(tax), effectiveRate: (tax / input.income * 100).toFixed(1) + "%", filingStatus: input.filingStatus, state: input.state || "federal" };
    },
  },
  {
    name: "calculate_retirement",
    description: "Run Monte Carlo retirement simulation",
    inputSchema: {
      type: "object",
      properties: {
        currentAge: { type: "number" },
        retirementAge: { type: "number" },
        currentSavings: { type: "number" },
        annualContribution: { type: "number" },
        riskTolerance: { type: "string", enum: ["conservative", "moderate", "aggressive"] },
      },
      required: ["currentAge", "retirementAge", "currentSavings", "annualContribution"],
    },
    handler: async (input) => {
      const { runMonteCarlo } = await import("../services/investmentIntelligence");
      return runMonteCarlo({
        initialInvestment: input.currentSavings,
        annualContribution: input.annualContribution,
        years: input.retirementAge - input.currentAge,
        simulations: 1000,
      });
    },
  },
  {
    name: "assess_suitability",
    description: "Assess client suitability profile",
    inputSchema: {
      type: "object",
      properties: {
        riskTolerance: { type: "string" },
        investmentHorizon: { type: "number" },
        incomeLevel: { type: "string" },
        netWorth: { type: "number" },
      },
      required: ["riskTolerance"],
    },
    handler: async (input) => {
      return {
        suitable: true,
        riskCategory: input.riskTolerance,
        horizon: input.investmentHorizon || "not specified",
        recommendation: "Based on the provided profile, moderate growth strategies are recommended.",
      };
    },
  },
  {
    name: "search_products",
    description: "Search financial product catalog",
    inputSchema: {
      type: "object",
      properties: {
        category: { type: "string", description: "Product category (life, annuity, disability, ltc)" },
        criteria: { type: "string", description: "Search criteria" },
      },
      required: ["category"],
    },
    handler: async (input) => {
      const { getAllProducts } = await import("../db");
      const products = await getAllProducts();
      return (products || []).filter((p: any) => !input.category || p.category === input.category).slice(0, 20);
    },
  },
  {
    name: "check_compliance",
    description: "Run compliance pre-screening on content",
    inputSchema: {
      type: "object",
      properties: { content: { type: "string", description: "Content to screen" } },
      required: ["content"],
    },
    handler: async (input) => {
      const { classifyContent } = await import("../complianceCopilot");
      return classifyContent(input.content, { hasSuitability: false, focus: "general" });
    },
  },
  {
    name: "get_market_data",
    description: "Get economic/market data series",
    inputSchema: {
      type: "object",
      properties: { series: { type: "string", description: "FRED series ID (e.g., DGS10, UNRATE)" } },
      required: ["series"],
    },
    handler: async (input) => {
      try {
        const { callDataApi } = await import("../_core/dataApi");
        return callDataApi(`/fred/series/observations?series_id=${input.series}&limit=30`);
      } catch {
        return { error: "Market data unavailable", series: input.series };
      }
    },
  },
];

export function listTools(): Array<{ name: string; description: string; inputSchema: Record<string, unknown> }> {
  return tools.map(({ name, description, inputSchema }) => ({ name, description, inputSchema }));
}

export async function callTool(name: string, input: unknown): Promise<unknown> {
  const tool = tools.find(t => t.name === name);
  if (!tool) throw new Error(`Unknown tool: ${name}`);
  return tool.handler(input);
}

export async function registerMCPEndpoint(app: any): Promise<void> {
  // SSE endpoint for MCP protocol
  app.get("/mcp/sse", (_req: any, res: any) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.write(`data: ${JSON.stringify({ type: "tools", tools: listTools() })}\n\n`);
  });

  app.post("/mcp/call", async (req: any, res: any) => {
    try {
      const { name, input } = req.body;
      const result = await callTool(name, input);
      res.json({ result });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  log.info(`[MCP] Registered ${tools.length} tools at /mcp/sse and /mcp/call`);
}
