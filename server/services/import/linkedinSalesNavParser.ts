/**
 * LinkedIn Sales Navigator CSV Parser
 * NOTE: Sales Nav doesn't export emails — flag leads as needs_email
 */
import { parseCsv } from "./csvParser";
import { applyMapping } from "./fieldMapper";

const SALES_NAV_MAPPING: Record<string, string> = {
  "First Name": "firstName",
  "Last Name": "lastName",
  "Title": "title",
  "Company": "company",
  "Company Size": "companySize",
  "Location": "location",
  "LinkedIn Sales Nav URL": "linkedinUrl",
};

export function parseLinkedInSalesNavCsv(content: string): Record<string, string>[] {
  const { rows } = parseCsv(content);
  const mapped = applyMapping(rows, SALES_NAV_MAPPING);

  return mapped.map(row => {
    // Sales Nav doesn't export emails
    row.needsEmail = "true";

    // Parse location
    if (row.location) {
      const parts = row.location.split(",").map(s => s.trim());
      if (parts.length >= 2) {
        row.city = parts[0];
        row.state = parts[parts.length - 1];
      }
    }

    // Company size as propensity signal
    if (row.companySize) {
      const size = parseInt(row.companySize);
      if (size > 500) row.companySizeSignal = "enterprise";
      else if (size > 50) row.companySizeSignal = "mid_market";
      else row.companySizeSignal = "small_business";
    }

    return row;
  });
}
