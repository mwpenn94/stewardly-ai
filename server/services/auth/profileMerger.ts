import { getDb } from "../../db";
import { users, authEnrichmentLog } from "../../../drizzle/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";

/**
 * Confidence hierarchy per field type.
 * Higher confidence = more authoritative source.
 */
const CONFIDENCE_HIERARCHY: Record<string, Record<string, number>> = {
  name: {
    linkedin: 0.95, google: 0.95, apollo: 0.80, pdl: 0.70, email_domain: 0.10,
  },
  email: {
    google_verified: 0.98, linkedin_verified: 0.95, apollo_verified: 0.90,
    pdl: 0.70, self_reported: 0.60,
  },
  phone: {
    google: 0.90, apollo_verified: 0.85, pdl: 0.60, self_reported: 0.50,
  },
  employer: {
    brokercheck: 0.95, linkedin: 0.90, google_org: 0.85,
    apollo: 0.80, pdl: 0.70, bls: 0.35,
  },
  job_title: {
    brokercheck: 0.95, linkedin: 0.90, google_org: 0.85,
    apollo: 0.80, pdl: 0.70,
  },
  birthday: {
    google: 0.95, self_reported: 0.80, graduation_inferred: 0.40,
  },
  address: {
    google: 0.85, apollo: 0.75, pdl: 0.65, census_zip: 0.20,
  },
  income: {
    tax_return: 0.95, plaid: 0.88, pdl_range: 0.50,
    apollo_inferred: 0.40, bls_median: 0.35, census_zip: 0.20,
  },
};

export interface ProviderData {
  source: string;
  fields: Record<string, {
    value: any;
    confidence: number;
    sourceDetail?: string;
  }>;
}

export interface MergeResult {
  fieldsAccepted: string[];
  fieldsRejected: string[];
  fieldsConflicted: string[];
  newCompleteness: number;
}

export class ProfileMerger {
  /**
   * Get the confidence for a field from a specific source
   */
  getConfidence(fieldType: string, source: string): number {
    return CONFIDENCE_HIERARCHY[fieldType]?.[source] || 0.50;
  }

  /**
   * Merge new provider data into an existing user's profile
   * Rules:
   * 1. NEVER overwrite higher-confidence data with lower-confidence data
   * 2. For same-confidence, prefer most recent
   * 3. For conflicting data (different values, similar confidence): flag for review
   */
  async mergeProviderData(userId: number, newData: ProviderData): Promise<MergeResult> {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const userRows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (userRows.length === 0) throw new Error("User not found");
    const user = userRows[0];

    // Parse existing sign-in data to get current field confidences
    const existingData: Record<string, { value: any; confidence: number; source: string }> =
      (user.signInDataJson as any) || {};

    const fieldsAccepted: string[] = [];
    const fieldsRejected: string[] = [];
    const fieldsConflicted: string[] = [];

    const updateSet: Record<string, any> = {};
    const updatedSignInData = { ...existingData };

    for (const [field, newField] of Object.entries(newData.fields)) {
      const existing = existingData[field];

      if (!existing || existing.value === null || existing.value === undefined) {
        // Field is empty — always accept
        fieldsAccepted.push(field);
        updatedSignInData[field] = {
          value: newField.value,
          confidence: newField.confidence,
          source: newData.source,
        };
        this.applyFieldToUser(field, newField.value, updateSet);
      } else if (newField.confidence > existing.confidence) {
        // New data has higher confidence — update
        fieldsAccepted.push(field);
        updatedSignInData[field] = {
          value: newField.value,
          confidence: newField.confidence,
          source: newData.source,
        };
        this.applyFieldToUser(field, newField.value, updateSet);
      } else if (
        Math.abs(newField.confidence - existing.confidence) < 0.05 &&
        JSON.stringify(newField.value) !== JSON.stringify(existing.value)
      ) {
        // Similar confidence but different values — conflict
        fieldsConflicted.push(field);
        // Store both, don't update primary
        updatedSignInData[`${field}_conflict_${newData.source}`] = {
          value: newField.value,
          confidence: newField.confidence,
          source: newData.source,
        };
      } else {
        // Lower confidence — reject
        fieldsRejected.push(field);
      }
    }

    // Update user record
    updateSet.signInDataJson = updatedSignInData;
    updateSet.profileEnrichedAt = new Date();
    updateSet.profileEnrichmentSource = newData.source;

    await db.update(users).set(updateSet).where(eq(users.id, userId));

    // Calculate completeness
    const completeness = this.calculateCompleteness(updatedSignInData);

    // Log the merge
    const responseHash = crypto
      .createHash("sha256")
      .update(JSON.stringify(newData))
      .digest("hex");

    await db.insert(authEnrichmentLog).values({
      id: crypto.randomUUID(),
      userId,
      provider: newData.source as any,
      eventType: "manual_enrich",
      fieldsCaptured: Object.keys(newData.fields),
      fieldsNew: fieldsAccepted,
      fieldsUpdated: fieldsAccepted.filter((f) => existingData[f]),
      rawResponseHash: responseHash,
      suitabilityDimensionsUpdated: ["identity_demographics"],
    });

    return {
      fieldsAccepted,
      fieldsRejected,
      fieldsConflicted,
      newCompleteness: completeness,
    };
  }

  /**
   * Apply a field value to the user update set
   */
  private applyFieldToUser(field: string, value: any, updateSet: Record<string, any>): void {
    const fieldMap: Record<string, string> = {
      name: "name",
      email: "email",
      phone: "googlePhone",
      employer: "employerName",
      job_title: "jobTitle",
      birthday: "googleBirthday",
      gender: "googleGender",
      address: "googleAddressJson",
      photo: "avatarUrl",
      linkedin_headline: "linkedinHeadline",
      linkedin_profile_url: "linkedinProfileUrl",
      linkedin_industry: "linkedinIndustry",
      linkedin_location: "linkedinLocation",
    };

    const dbField = fieldMap[field];
    if (dbField) {
      updateSet[dbField] = value;
    }
  }

  /**
   * Calculate profile completeness percentage
   */
  calculateCompleteness(signInData: Record<string, any>): number {
    const importantFields = [
      "name", "email", "phone", "employer", "job_title",
      "birthday", "gender", "address", "income",
      "photo", "linkedin_headline", "education",
    ];

    let filled = 0;
    for (const field of importantFields) {
      if (signInData[field]?.value) filled++;
    }

    return Math.round((filled / importantFields.length) * 100);
  }
}

export const profileMerger = new ProfileMerger();
