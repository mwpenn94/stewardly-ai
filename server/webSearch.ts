/**
 * Web Search & Financial Product Research
 * 
 * Uses the LLM's tool-calling capability combined with available Data APIs
 * (Yahoo Finance) to provide real-time financial product information.
 * 
 * The AI can:
 * 1. Look up stock/ETF data via Yahoo Finance API
 * 2. Research financial products using its training knowledge + structured prompts
 * 3. Compare carriers, products, and rates
 */

import { rawInvokeLLM as invokeLLM } from "./shared/stewardlyWiring";
import type { Tool, Message } from "./_core/llm";
import { callDataApi } from "./_core/dataApi";

// ─── Tool Definitions ────────────────────────────────────────────

export const SEARCH_TOOLS: Tool[] = [
  {
    type: "function",
    function: {
      name: "lookup_stock_data",
      description: "Look up real-time stock, ETF, or mutual fund data including price, performance, and key metrics. Use for any ticker symbol query.",
      parameters: {
        type: "object",
        properties: {
          symbol: {
            type: "string",
            description: "The ticker symbol (e.g., AAPL, SPY, VFIAX)"
          },
          range: {
            type: "string",
            enum: ["1d", "5d", "1mo", "3mo", "6mo", "1y", "5y"],
            description: "Time range for historical data"
          }
        },
        required: ["symbol"],
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "research_financial_product",
      description: "Research a specific financial product, insurance carrier, investment vehicle, or financial service. Returns detailed analysis including features, pros/cons, fees, and suitability. Use when users ask about specific products like IUL policies, annuities, 529 plans, specific carrier offerings, etc.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "The financial product or topic to research (e.g., 'Pacific Life IUL products', 'best Roth IRA providers 2025', 'term vs whole life insurance comparison')"
          },
          category: {
            type: "string",
            enum: ["insurance", "investment", "retirement", "banking", "tax", "estate", "general"],
            description: "Category of the financial product"
          }
        },
        required: ["query", "category"],
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "compare_products",
      description: "Compare multiple financial products, carriers, or investment options side by side. Returns a structured comparison with key differentiators.",
      parameters: {
        type: "object",
        properties: {
          products: {
            type: "array",
            items: { type: "string" },
            description: "List of products or carriers to compare (2-5 items)"
          },
          criteria: {
            type: "array",
            items: { type: "string" },
            description: "Specific criteria to compare on (e.g., 'fees', 'returns', 'flexibility', 'tax advantages')"
          }
        },
        required: ["products"],
        additionalProperties: false
      }
    }
  }
];

// ─── Tool Execution ──────────────────────────────────────────────

export async function executeSearchTool(
  toolName: string,
  args: Record<string, any>
): Promise<string> {
  switch (toolName) {
    case "lookup_stock_data":
      return await lookupStockData(args.symbol, args.range || "1mo");
    case "research_financial_product":
      return await researchProduct(args.query, args.category);
    case "compare_products":
      return await compareProducts(args.products, args.criteria);
    default:
      return JSON.stringify({ error: `Unknown tool: ${toolName}` });
  }
}

async function lookupStockData(symbol: string, range: string): Promise<string> {
  try {
    const data: any = await callDataApi("YahooFinance/get_stock_chart", {
      query: { symbol, interval: "1d", range }
    });

    const meta = data?.chart?.result?.[0]?.meta;
    const quotes = data?.chart?.result?.[0]?.indicators?.quote?.[0];

    if (!meta) {
      return JSON.stringify({ error: `No data found for symbol: ${symbol}` });
    }

    const lastClose = quotes?.close?.filter((v: any) => v != null).pop();
    const firstClose = quotes?.close?.filter((v: any) => v != null)?.[0];
    const change = lastClose && firstClose ? ((lastClose - firstClose) / firstClose * 100).toFixed(2) : null;

    return JSON.stringify({
      symbol: meta.symbol,
      name: meta.shortName || meta.longName || symbol,
      currency: meta.currency,
      currentPrice: meta.regularMarketPrice,
      previousClose: meta.previousClose,
      fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh,
      fiftyTwoWeekLow: meta.fiftyTwoWeekLow,
      periodChange: change ? `${change}%` : "N/A",
      range,
      exchangeName: meta.exchangeName,
      instrumentType: meta.instrumentType
    });
  } catch (err: any) {
    return JSON.stringify({ error: `Failed to fetch stock data: ${err.message}` });
  }
}

async function researchProduct(query: string, category: string): Promise<string> {
  // Use a dedicated LLM call with a research-focused system prompt
  // This leverages the model's training data which includes extensive financial product knowledge
  try {
    const result = await contextualLLM({ userId: null, contextType: "chat",
      messages: [
        {
          role: "system",
          content: `You are a financial product research analyst. Provide detailed, accurate information about financial products, carriers, and services. Include:
- Product features and benefits
- Fees and costs
- Pros and cons
- Suitability (who is this best for?)
- Key differentiators from competitors
- Any regulatory considerations
- Recent changes or updates you're aware of

Be specific with numbers, rates, and features. If you're not certain about current rates, note that rates change and recommend verifying with the carrier directly. Format your response as structured data.`
        },
        {
          role: "user",
          content: `Research this ${category} product/topic: ${query}\n\nProvide a comprehensive analysis.`
        }
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "product_research",
          strict: true,
          schema: {
            type: "object",
            properties: {
              productName: { type: "string", description: "Name of the product or topic" },
              category: { type: "string", description: "Product category" },
              overview: { type: "string", description: "Brief overview (2-3 sentences)" },
              keyFeatures: {
                type: "array",
                items: { type: "string" },
                description: "Key features and benefits"
              },
              fees: { type: "string", description: "Fee structure and costs" },
              pros: {
                type: "array",
                items: { type: "string" },
                description: "Advantages"
              },
              cons: {
                type: "array",
                items: { type: "string" },
                description: "Disadvantages or limitations"
              },
              bestFor: { type: "string", description: "Who this product is best suited for" },
              competitors: {
                type: "array",
                items: { type: "string" },
                description: "Main competitors or alternatives"
              },
              importantNotes: { type: "string", description: "Regulatory notes, disclaimers, or important caveats" }
            },
            required: ["productName", "category", "overview", "keyFeatures", "fees", "pros", "cons", "bestFor", "competitors", "importantNotes"],
            additionalProperties: false
          }
        }
      }
    });

    const content = result.choices[0]?.message?.content;
    return typeof content === "string" ? content : JSON.stringify(content);
  } catch (err: any) {
    return JSON.stringify({ error: `Research failed: ${err.message}` });
  }
}

async function compareProducts(products: string[], criteria?: string[]): Promise<string> {
  try {
    const criteriaStr = criteria?.length
      ? `Focus on these criteria: ${criteria.join(", ")}`
      : "Compare on fees, features, performance, suitability, and overall value";

    const result = await contextualLLM({ userId: null, contextType: "chat",
      messages: [
        {
          role: "system",
          content: `You are a financial product comparison analyst. Create detailed side-by-side comparisons of financial products. Be objective and specific with numbers where possible. ${criteriaStr}`
        },
        {
          role: "user",
          content: `Compare these products/options: ${products.join(" vs ")}\n\nProvide a structured comparison.`
        }
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "product_comparison",
          strict: true,
          schema: {
            type: "object",
            properties: {
              products: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    summary: { type: "string" },
                    strengths: { type: "array", items: { type: "string" } },
                    weaknesses: { type: "array", items: { type: "string" } }
                  },
                  required: ["name", "summary", "strengths", "weaknesses"],
                  additionalProperties: false
                }
              },
              recommendation: { type: "string", description: "Overall recommendation based on the comparison" },
              disclaimer: { type: "string", description: "Important caveats about the comparison" }
            },
            required: ["products", "recommendation", "disclaimer"],
            additionalProperties: false
          }
        }
      }
    });

    const content = result.choices[0]?.message?.content;
    return typeof content === "string" ? content : JSON.stringify(content);
  } catch (err: any) {
    return JSON.stringify({ error: `Comparison failed: ${err.message}` });
  }
}
