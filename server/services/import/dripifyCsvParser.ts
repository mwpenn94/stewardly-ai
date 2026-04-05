/**
 * Dripify CSV Parser — System mapping for Dripify LinkedIn automation exports
 */
import { parseCsv } from "./csvParser";
import { applyMapping } from "./fieldMapper";

const DRIPIFY_MAPPING: Record<string, string> = {
  "First Name": "firstName",
  "Last Name": "lastName",
  "Email": "email",
  "Headline": "title",
  "Company Name": "company",
  "Location": "location",
  "LinkedIn URL": "linkedinUrl",
  "Campaign Name": "campaignName",
  "Tags": "tags",
  "Status": "status",
};

export function parseDripifyCsv(content: string): Record<string, string>[] {
  const { rows } = parseCsv(content);

  const mapped = applyMapping(rows, DRIPIFY_MAPPING);

  // Parse location into city + state
  return mapped.map(row => {
    if (row.location) {
      const parts = row.location.split(",").map(s => s.trim());
      if (parts.length >= 2) {
        row.city = parts[0];
        row.state = parts[parts.length - 1];
      }
    }
    return row;
  });
}
