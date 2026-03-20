import { getDb } from "../../db";
import { integrationConnections } from "../../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { decrypt } from "../encryption";

export interface ApolloPersonResult {
  name: string;
  firstName: string;
  lastName: string;
  title: string;
  headline: string;
  email: string;
  emailStatus: string;
  phoneNumbers: Array<{ rawNumber: string; sanitizedNumber: string; type: string }>;
  linkedinUrl: string;
  twitterUrl: string;
  photoUrl: string;
  city: string;
  state: string;
  country: string;
  organization: {
    name: string;
    websiteUrl: string;
    industry: string;
    estimatedNumEmployees: number;
    annualRevenue: number;
    annualRevenuePrinted: string;
    foundedYear: number;
    shortDescription: string;
  };
  employmentHistory: Array<{
    organizationName: string;
    title: string;
    startDate: string;
    endDate: string;
    current: boolean;
  }>;
  education: Array<{
    schoolName: string;
    degree: string;
    fieldOfStudy: string;
    startDate: string;
    endDate: string;
  }>;
  seniority: string;
  departments: string[];
}

export interface ApolloCompanyResult {
  name: string;
  websiteUrl: string;
  industry: string;
  estimatedNumEmployees: number;
  annualRevenue: number;
  foundedYear: number;
  shortDescription: string;
  linkedinUrl: string;
  techStack: string[];
}

export class ApolloService {
  /**
   * Test Apollo API connection
   */
  async testConnection(apiKey: string): Promise<boolean> {
    try {
      const response = await fetch(
        `https://api.apollo.io/api/v1/auth/health?api_key=${apiKey}`
      );
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Enrich a person by email, name, or LinkedIn URL
   */
  async enrichPerson(
    apiKey: string,
    params: {
      email?: string;
      firstName?: string;
      lastName?: string;
      linkedinUrl?: string;
      domain?: string;
    }
  ): Promise<ApolloPersonResult | null> {
    try {
      const response = await fetch("https://api.apollo.io/api/v1/people/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: apiKey,
          email: params.email,
          first_name: params.firstName,
          last_name: params.lastName,
          linkedin_url: params.linkedinUrl,
          organization_name: params.domain,
        }),
      });

      if (!response.ok) return null;

      const data = await response.json();
      const person = data.person;
      if (!person) return null;

      return {
        name: person.name || "",
        firstName: person.first_name || "",
        lastName: person.last_name || "",
        title: person.title || "",
        headline: person.headline || "",
        email: person.email || "",
        emailStatus: person.email_status || "",
        phoneNumbers: (person.phone_numbers || []).map((p: any) => ({
          rawNumber: p.raw_number,
          sanitizedNumber: p.sanitized_number,
          type: p.type,
        })),
        linkedinUrl: person.linkedin_url || "",
        twitterUrl: person.twitter_url || "",
        photoUrl: person.photo_url || "",
        city: person.city || "",
        state: person.state || "",
        country: person.country || "",
        organization: {
          name: person.organization?.name || "",
          websiteUrl: person.organization?.website_url || "",
          industry: person.organization?.industry || "",
          estimatedNumEmployees: person.organization?.estimated_num_employees || 0,
          annualRevenue: person.organization?.annual_revenue || 0,
          annualRevenuePrinted: person.organization?.annual_revenue_printed || "",
          foundedYear: person.organization?.founded_year || 0,
          shortDescription: person.organization?.short_description || "",
        },
        employmentHistory: (person.employment_history || []).map((e: any) => ({
          organizationName: e.organization_name || "",
          title: e.title || "",
          startDate: e.start_date || "",
          endDate: e.end_date || "",
          current: !!e.current,
        })),
        education: (person.education || []).map((e: any) => ({
          schoolName: e.school_name || "",
          degree: e.degree || "",
          fieldOfStudy: e.field_of_study || "",
          startDate: e.start_date || "",
          endDate: e.end_date || "",
        })),
        seniority: person.seniority || "",
        departments: person.departments || [],
      };
    } catch {
      return null;
    }
  }

  /**
   * Enrich a company by domain
   */
  async enrichCompany(apiKey: string, domain: string): Promise<ApolloCompanyResult | null> {
    try {
      const response = await fetch("https://api.apollo.io/api/v1/organizations/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: apiKey, domain }),
      });

      if (!response.ok) return null;

      const data = await response.json();
      const org = data.organization;
      if (!org) return null;

      return {
        name: org.name || "",
        websiteUrl: org.website_url || "",
        industry: org.industry || "",
        estimatedNumEmployees: org.estimated_num_employees || 0,
        annualRevenue: org.annual_revenue || 0,
        foundedYear: org.founded_year || 0,
        shortDescription: org.short_description || "",
        linkedinUrl: org.linkedin_url || "",
        techStack: org.current_technologies?.map((t: any) => t.name) || [],
      };
    } catch {
      return null;
    }
  }

  /**
   * Find email by name and domain
   */
  async findEmail(
    apiKey: string,
    params: { firstName: string; lastName: string; domain: string }
  ): Promise<{ email: string; emailStatus: string } | null> {
    try {
      const response = await fetch("https://api.apollo.io/api/v1/people/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: apiKey,
          first_name: params.firstName,
          last_name: params.lastName,
          organization_name: params.domain,
        }),
      });

      if (!response.ok) return null;

      const data = await response.json();
      if (!data.person?.email) return null;

      return {
        email: data.person.email,
        emailStatus: data.person.email_status || "unknown",
      };
    } catch {
      return null;
    }
  }
}

export const apolloService = new ApolloService();
