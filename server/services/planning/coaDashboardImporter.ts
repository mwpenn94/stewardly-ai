/**
 * COA Dashboard Importer — Chart of Accounts data for business planning dashboards
 * Provides standard COA entries for financial advisory firms.
 * Data is served in-memory; DB persistence uses coaCampaigns/coaActuals tables.
 */
import { logger } from "../../_core/logger";

const log = logger.child({ module: "coaDashboardImporter" });

export interface CoaEntry {
  code: string;
  name: string;
  category: "revenue" | "expense" | "asset" | "liability" | "equity";
  subcategory: string;
  isActive: boolean;
}

const STANDARD_COA: CoaEntry[] = [
  // Revenue
  { code: "4000", name: "Advisory Fees", category: "revenue", subcategory: "Fee Income", isActive: true },
  { code: "4010", name: "Trail Commissions", category: "revenue", subcategory: "Commission Income", isActive: true },
  { code: "4020", name: "Planning Fees", category: "revenue", subcategory: "Fee Income", isActive: true },
  { code: "4030", name: "Insurance Commissions", category: "revenue", subcategory: "Commission Income", isActive: true },
  { code: "4040", name: "Referral Fees", category: "revenue", subcategory: "Fee Income", isActive: true },
  // Expenses
  { code: "5000", name: "Compensation", category: "expense", subcategory: "Personnel", isActive: true },
  { code: "5010", name: "Benefits", category: "expense", subcategory: "Personnel", isActive: true },
  { code: "5020", name: "Office Rent", category: "expense", subcategory: "Occupancy", isActive: true },
  { code: "5030", name: "Technology", category: "expense", subcategory: "Operations", isActive: true },
  { code: "5040", name: "Marketing", category: "expense", subcategory: "Growth", isActive: true },
  { code: "5050", name: "Compliance", category: "expense", subcategory: "Operations", isActive: true },
  { code: "5060", name: "E&O Insurance", category: "expense", subcategory: "Insurance", isActive: true },
  { code: "5070", name: "Continuing Education", category: "expense", subcategory: "Professional Development", isActive: true },
  { code: "5080", name: "Travel & Entertainment", category: "expense", subcategory: "Operations", isActive: true },
  { code: "5090", name: "Professional Services", category: "expense", subcategory: "Operations", isActive: true },
];

export function getStandardCoa(): CoaEntry[] {
  return STANDARD_COA;
}

export function getCoaByCategory(category: CoaEntry["category"]): CoaEntry[] {
  return STANDARD_COA.filter((e) => e.category === category);
}

export function getCoaByCode(code: string): CoaEntry | undefined {
  return STANDARD_COA.find((e) => e.code === code);
}

export function getRevenueAccounts(): CoaEntry[] {
  return getCoaByCategory("revenue");
}

export function getExpenseAccounts(): CoaEntry[] {
  return getCoaByCategory("expense");
}
