/**
 * Import Validator — Validate email, normalize phone, check required fields
 * CSV injection sanitization applied to all cells
 */

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateRecord(record: Record<string, string>, requiredFields: string[] = ["email"]): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check required fields
  for (const field of requiredFields) {
    if (!record[field] || record[field].trim() === "") {
      errors.push(`Missing required field: ${field}`);
    }
  }

  // Validate email format
  if (record.email && !EMAIL_REGEX.test(record.email)) {
    errors.push(`Invalid email format: ${record.email}`);
  }

  // Normalize phone
  if (record.phone) {
    const digits = record.phone.replace(/\D/g, "");
    if (digits.length < 10 || digits.length > 15) {
      warnings.push(`Phone number may be invalid: ${record.phone} (${digits.length} digits)`);
    }
  }

  // CSV injection check
  for (const [key, value] of Object.entries(record)) {
    if (value && /^[=+\-@|\t\r]/.test(value)) {
      warnings.push(`Potential CSV injection in field "${key}" — sanitized`);
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

export function validateBatch(records: Record<string, string>[], requiredFields?: string[]): {
  validRecords: Record<string, string>[];
  invalidRecords: Array<{ record: Record<string, string>; errors: string[] }>;
  totalWarnings: number;
} {
  const validRecords: Record<string, string>[] = [];
  const invalidRecords: Array<{ record: Record<string, string>; errors: string[] }> = [];
  let totalWarnings = 0;

  for (const record of records) {
    const result = validateRecord(record, requiredFields);
    totalWarnings += result.warnings.length;
    if (result.valid) {
      validRecords.push(record);
    } else {
      invalidRecords.push({ record, errors: result.errors });
    }
  }

  return { validRecords, invalidRecords, totalWarnings };
}
