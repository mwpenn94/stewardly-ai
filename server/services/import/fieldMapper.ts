/**
 * Field Mapper — Apply column mappings to parsed rows
 */

export interface FieldMapping {
  [sourceColumn: string]: string; // source → target field name
}

export function applyMapping(
  rows: Record<string, string>[],
  mapping: FieldMapping,
  defaults?: Record<string, string>,
): Record<string, string>[] {
  return rows.map(row => {
    const mapped: Record<string, string> = {};

    // Apply defaults first
    if (defaults) {
      for (const [key, value] of Object.entries(defaults)) {
        mapped[key] = value;
      }
    }

    // Apply mapping
    for (const [source, target] of Object.entries(mapping)) {
      if (row[source] != null && row[source] !== "") {
        mapped[target] = row[source];
      }
    }

    return mapped;
  });
}

export function autoDetectMapping(headers: string[]): FieldMapping {
  const mapping: FieldMapping = {};
  const patterns: Record<string, RegExp> = {
    firstName: /^(first.?name|fname|given.?name)$/i,
    lastName: /^(last.?name|lname|surname|family.?name)$/i,
    email: /^(e.?mail|email.?address)$/i,
    phone: /^(phone|telephone|mobile|cell)$/i,
    company: /^(company|organization|org|employer|company.?name)$/i,
    title: /^(title|job.?title|position|headline)$/i,
    city: /^(city|town)$/i,
    state: /^(state|province|region)$/i,
    zip: /^(zip|zip.?code|postal|postal.?code)$/i,
    linkedinUrl: /^(linkedin|linkedin.?url|linkedin.?profile)$/i,
  };

  for (const header of headers) {
    for (const [target, pattern] of Object.entries(patterns)) {
      if (pattern.test(header)) {
        mapping[header] = target;
        break;
      }
    }
  }

  return mapping;
}
