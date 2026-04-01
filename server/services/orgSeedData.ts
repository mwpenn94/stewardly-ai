/**
 * Organization Seed Data Service
 * Seeds Stewardly AZ and Stewardly organizations with proper color schemes,
 * and wires the owner user with all permission levels.
 */
import { getDb } from "../db";
import { contextualLLM } from "../shared/stewardlyWiring";
import { organizations, userOrganizationRoles, users } from "../../drizzle/schema";
import { eq, and, sql } from "drizzle-orm";

interface OrgSeedConfig {
  name: string;
  industry: string;
  size: string;
  colorScheme: {
    primary: string;
    secondary: string;
    accent: string;
  };
  description: string;
  website?: string;
}

const ORG_SEEDS: OrgSeedConfig[] = [
  {
    name: "Stewardly AZ",
    industry: "Financial Advisory",
    size: "medium",
    colorScheme: {
      primary: "#1B2A4A",   // Navy
      secondary: "#D4A843", // Gold
      accent: "#B8860B",    // Dark Gold
    },
    description: "Arizona-based wealth management firm specializing in comprehensive financial planning, insurance solutions, and estate planning with a focus on high-net-worth individuals and families.",
    website: "https://stewardlyaz.com",
  },
  {
    name: "Stewardly",
    industry: "Financial Technology",
    size: "large",
    colorScheme: {
      primary: "#1B2A4A",   // Navy
      secondary: "#FFFFFF", // White
      accent: "#3B82F6",    // Blue accent
    },
    description: "National financial technology platform providing AI-powered advisory tools, digital financial twin modeling, and comprehensive wealth management solutions for advisors and their clients.",
    website: "https://stewardly.com",
  },
];

/**
 * Seed organizations and wire the owner user with all permission levels
 */
export async function seedOrganizations(ownerOpenId?: string): Promise<{
  created: number;
  updated: number;
  rolesAssigned: number;
}> {
  const db = await getDb();
  if (!db) return { created: 0, updated: 0, rolesAssigned: 0 };

  let created = 0;
  let updated = 0;
  let rolesAssigned = 0;

  for (const seed of ORG_SEEDS) {
    // Check if org already exists
    const [existing] = await db.select().from(organizations)
      .where(eq(organizations.name, seed.name))
      .limit(1);

    let orgId: number;

    if (existing) {
      // Update existing org with metadata
      await db.update(organizations)
        .set({
          industry: seed.industry,
          size: seed.size as "solo" | "small" | "medium" | "large" | "enterprise",
          description: seed.description,
          website: seed.website,
        })
        .where(eq(organizations.id, existing.id));
      orgId = existing.id;
      updated++;
    } else {
      // Create new org
      const slug = seed.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      const [newOrg] = await db.insert(organizations).values({
        name: seed.name,
        slug,
        industry: seed.industry,
        size: seed.size as "solo" | "small" | "medium" | "large" | "enterprise",
        description: seed.description,
        website: seed.website,
      }).$returningId();
      orgId = newOrg.id;
      created++;
    }

    // Wire owner user with admin role if ownerOpenId is provided
    if (ownerOpenId) {
      const [ownerUser] = await db.select().from(users)
        .where(eq(users.openId, ownerOpenId))
        .limit(1);

      if (ownerUser) {
        // Check if role already exists
        const [existingRole] = await db.select().from(userOrganizationRoles)
          .where(and(
            eq(userOrganizationRoles.userId, ownerUser.id),
            eq(userOrganizationRoles.organizationId, orgId),
          ))
          .limit(1);

        if (!existingRole) {
          await db.insert(userOrganizationRoles).values({
            userId: ownerUser.id,
            organizationId: orgId,
            globalRole: "global_admin",
            organizationRole: "org_admin",
            status: "active",
          });
          rolesAssigned++;
        }
      }
    }
  }

  return { created, updated, rolesAssigned };
}

/**
 * Auto-detect color scheme from a logo URL using LLM vision
 */
export async function detectColorSchemeFromLogo(logoUrl: string): Promise<{
  primary: string;
  secondary: string;
  accent: string;
  confidence: number;
}> {
  // Use LLM to analyze the logo colors
  const result = await contextualLLM({ userId: null, contextType: "analysis",
    messages: [
      {
        role: "system",
        content: "You are a design expert. Analyze the logo image and extract the dominant color scheme. Return hex color codes.",
      },
      {
        role: "user",
        content: [
          { type: "text", text: "Extract the primary, secondary, and accent colors from this logo. Return as JSON with hex codes." },
          { type: "image_url", image_url: { url: logoUrl, detail: "low" } },
        ],
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "color_scheme",
        strict: true,
        schema: {
          type: "object",
          properties: {
            primary: { type: "string", description: "Primary hex color" },
            secondary: { type: "string", description: "Secondary hex color" },
            accent: { type: "string", description: "Accent hex color" },
            confidence: { type: "number", description: "Confidence 0-1" },
          },
          required: ["primary", "secondary", "accent", "confidence"],
          additionalProperties: false,
        },
      },
    },
  });

  const content = String(result.choices[0]?.message?.content || "{}");
  try {
    return JSON.parse(content);
  } catch {
    return { primary: "#1B2A4A", secondary: "#D4A843", accent: "#3B82F6", confidence: 0 };
  }
}
