/**
 * DataBank Enrichment Service
 * 
 * Uses the built-in Manus Data API (callDataApi) to fetch World Bank
 * Development Indicators. This supplements the direct World Bank API
 * pipeline with richer indicator metadata and search capabilities.
 * 
 * Pass 57: Added as a supplementary data source for the AI context.
 */
import { callDataApi } from "../_core/dataApi";
import { logger } from "../_core/logger";

// ─── Types ──────────────────────────────────────────────────────────────

export interface DataBankIndicator {
  id: string;
  name: string;
  source?: string;
  sourceNote?: string;
  sourceOrganization?: string;
  topics?: Array<{ id: string; value: string }>;
}

export interface DataBankIndicatorDetail {
  indicatorCode: string;
  indicatorName: string;
  topic?: string;
  shortDescription?: string;
  longDescription?: string;
}

// ─── Key Financial Indicators ───────────────────────────────────────────

export const KEY_FINANCIAL_INDICATORS = [
  { code: "NY.GDP.MKTP.CD", name: "GDP (current US$)", category: "economic" },
  { code: "NY.GDP.MKTP.KD.ZG", name: "GDP Growth Rate", category: "economic" },
  { code: "FP.CPI.TOTL.ZG", name: "Inflation Rate (CPI)", category: "economic" },
  { code: "SL.UEM.TOTL.ZS", name: "Unemployment Rate", category: "labor" },
  { code: "NY.GDP.PCAP.CD", name: "GDP per Capita", category: "economic" },
  { code: "BX.KLT.DINV.CD.WD", name: "Foreign Direct Investment", category: "trade" },
  { code: "NE.EXP.GNFS.ZS", name: "Exports (% of GDP)", category: "trade" },
  { code: "GC.DOD.TOTL.GD.ZS", name: "Government Debt (% of GDP)", category: "fiscal" },
  { code: "FR.INR.RINR", name: "Real Interest Rate", category: "monetary" },
  { code: "CM.MKT.LCAP.GD.ZS", name: "Market Capitalization (% of GDP)", category: "markets" },
  { code: "FS.AST.DOMS.GD.ZS", name: "Domestic Credit (% of GDP)", category: "financial" },
  { code: "SP.POP.TOTL", name: "Population Total", category: "demographics" },
];

// ─── API Functions ──────────────────────────────────────────────────────

/**
 * Search for World Bank indicators by keyword.
 */
export async function searchIndicators(query: string, pageSize = 10): Promise<DataBankIndicator[]> {
  try {
    const result: any = await callDataApi("DataBank/indicator_list", {
      query: { q: query, page: 1, pageSize },
    });
    return (result?.data ?? []).map((item: any) => ({
      id: item.id,
      name: item.name,
      source: item.source?.value,
      sourceNote: item.sourceNote,
      sourceOrganization: item.sourceOrganization,
      topics: item.topics,
    }));
  } catch (err: any) {
    logger.warn({ operation: "databank-search", error: err.message }, "DataBank search failed");
    return [];
  }
}

/**
 * Get detailed information about a specific indicator.
 */
export async function getIndicatorDetail(indicatorCode: string): Promise<DataBankIndicatorDetail | null> {
  try {
    const result: any = await callDataApi("DataBank/indicator_detail", {
      query: {},
      pathParams: { indicatorCode },
    });
    if (!result) return null;
    return {
      indicatorCode: result.indicatorCode ?? indicatorCode,
      indicatorName: result.indicatorName ?? "",
      topic: result.topic,
      shortDescription: result.shortDescription,
      longDescription: result.longDescription,
    };
  } catch (err: any) {
    logger.warn({ operation: "databank-detail", error: err.message }, `DataBank detail failed for ${indicatorCode}`);
    return null;
  }
}

/**
 * Build an AI-friendly context string with indicator descriptions
 * for use in financial planning and advisory conversations.
 */
export async function getFinancialIndicatorContext(): Promise<string> {
  const sections: string[] = [];
  sections.push("### World Bank Development Indicators (DataBank)");
  sections.push("Available indicators for financial analysis and global economic context:\n");

  for (const ind of KEY_FINANCIAL_INDICATORS) {
    sections.push(`- **${ind.name}** (${ind.code}) — Category: ${ind.category}`);
  }

  sections.push("\nUse these indicators to provide context on global economic conditions, compare country-level metrics, and support financial planning decisions.");
  return sections.join("\n");
}

/**
 * Fetch indicator metadata for a batch of codes.
 * Returns a map of code -> detail for efficient lookup.
 */
export async function batchGetIndicatorDetails(
  codes: string[]
): Promise<Map<string, DataBankIndicatorDetail>> {
  const results = new Map<string, DataBankIndicatorDetail>();
  
  // Fetch in parallel with a concurrency limit of 3
  const chunks: string[][] = [];
  for (let i = 0; i < codes.length; i += 3) {
    chunks.push(codes.slice(i, i + 3));
  }

  for (const chunk of chunks) {
    const promises = chunk.map(async (code) => {
      const detail = await getIndicatorDetail(code);
      if (detail) results.set(code, detail);
    });
    await Promise.allSettled(promises);
  }

  return results;
}
