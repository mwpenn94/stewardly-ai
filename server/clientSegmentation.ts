import { getDb } from "./db";
import { clientSegments } from "../drizzle/schema";
import { eq, desc } from "drizzle-orm";

// ─── Types ─────────────────────────────────────────────────────
export interface SegmentationInput {
  clientId: number;
  professionalId: number;
  // Value metrics
  aum: number;
  annualRevenue: number;
  referralsGenerated: number;
  // Growth metrics
  netNewAssets12m: number;
  aumGrowthRate: number;
  productPenetration: number; // 0-100
  // Engagement metrics
  meetingsAttended12m: number;
  responseTimeAvgHours: number;
  portalLoginFrequency: number; // monthly
  // Relationship metrics
  tenureYears: number;
  satisfactionScore: number; // 0-100
  advocacyScore: number; // 0-100 (NPS-like)
}

export interface SegmentationResult {
  valueScore: number;
  growthScore: number;
  engagementScore: number;
  relationshipScore: number;
  totalScore: number;
  tier: "platinum" | "gold" | "silver" | "bronze";
  serviceModel: ServiceModel;
}

export interface ServiceModel {
  tier: string;
  meetingFrequency: string;
  reviewType: string;
  communicationCadence: string;
  proactiveOutreach: boolean;
  dedicatedTeam: boolean;
  prioritySupport: boolean;
  customReporting: boolean;
}

// ─── Scoring ───────────────────────────────────────────────────
export function scoreValue(aum: number, revenue: number, referrals: number): number {
  let score = 0;
  // AUM tiers (0-40)
  if (aum >= 5_000_000) score += 40;
  else if (aum >= 1_000_000) score += 30;
  else if (aum >= 500_000) score += 20;
  else if (aum >= 250_000) score += 10;
  else score += 5;

  // Revenue (0-35)
  if (revenue >= 50_000) score += 35;
  else if (revenue >= 20_000) score += 25;
  else if (revenue >= 10_000) score += 15;
  else score += 5;

  // Referrals (0-25)
  score += Math.min(25, referrals * 8);

  return Math.min(100, score);
}

export function scoreGrowth(netNew: number, growthRate: number, penetration: number): number {
  let score = 0;
  // Net new assets (0-40)
  if (netNew >= 500_000) score += 40;
  else if (netNew >= 100_000) score += 30;
  else if (netNew >= 50_000) score += 20;
  else if (netNew > 0) score += 10;

  // Growth rate (0-30)
  if (growthRate >= 0.2) score += 30;
  else if (growthRate >= 0.1) score += 20;
  else if (growthRate >= 0.05) score += 10;

  // Product penetration (0-30)
  score += Math.round(penetration * 0.3);

  return Math.min(100, score);
}

export function scoreEngagement(meetings: number, responseTime: number, logins: number): number {
  let score = 0;
  // Meetings (0-35)
  if (meetings >= 4) score += 35;
  else if (meetings >= 2) score += 25;
  else if (meetings >= 1) score += 15;

  // Response time (0-30)
  if (responseTime <= 4) score += 30;
  else if (responseTime <= 12) score += 20;
  else if (responseTime <= 24) score += 10;

  // Portal logins (0-35)
  if (logins >= 8) score += 35;
  else if (logins >= 4) score += 25;
  else if (logins >= 1) score += 15;

  return Math.min(100, score);
}

export function scoreRelationship(tenure: number, satisfaction: number, advocacy: number): number {
  let score = 0;
  // Tenure (0-30)
  if (tenure >= 10) score += 30;
  else if (tenure >= 5) score += 20;
  else if (tenure >= 2) score += 10;
  else score += 5;

  // Satisfaction (0-35)
  score += Math.round(satisfaction * 0.35);

  // Advocacy (0-35)
  score += Math.round(advocacy * 0.35);

  return Math.min(100, score);
}

export function determineTier(totalScore: number): "platinum" | "gold" | "silver" | "bronze" {
  if (totalScore >= 80) return "platinum";
  if (totalScore >= 60) return "gold";
  if (totalScore >= 40) return "silver";
  return "bronze";
}

export function buildServiceModel(tier: "platinum" | "gold" | "silver" | "bronze"): ServiceModel {
  const models: Record<string, ServiceModel> = {
    platinum: {
      tier: "Platinum",
      meetingFrequency: "Quarterly + on-demand",
      reviewType: "Comprehensive annual + semi-annual check-in",
      communicationCadence: "Monthly personalized update",
      proactiveOutreach: true,
      dedicatedTeam: true,
      prioritySupport: true,
      customReporting: true,
    },
    gold: {
      tier: "Gold",
      meetingFrequency: "Semi-annual + on-demand",
      reviewType: "Annual comprehensive review",
      communicationCadence: "Quarterly update",
      proactiveOutreach: true,
      dedicatedTeam: false,
      prioritySupport: true,
      customReporting: false,
    },
    silver: {
      tier: "Silver",
      meetingFrequency: "Annual",
      reviewType: "Annual review",
      communicationCadence: "Quarterly newsletter",
      proactiveOutreach: false,
      dedicatedTeam: false,
      prioritySupport: false,
      customReporting: false,
    },
    bronze: {
      tier: "Bronze",
      meetingFrequency: "Annual (group or virtual)",
      reviewType: "Streamlined annual review",
      communicationCadence: "Quarterly newsletter",
      proactiveOutreach: false,
      dedicatedTeam: false,
      prioritySupport: false,
      customReporting: false,
    },
  };
  return models[tier];
}

// ─── Main Classification ───────────────────────────────────────
export function classifyClient(input: SegmentationInput): SegmentationResult {
  const value = scoreValue(input.aum, input.annualRevenue, input.referralsGenerated);
  const growth = scoreGrowth(input.netNewAssets12m, input.aumGrowthRate, input.productPenetration);
  const engagement = scoreEngagement(input.meetingsAttended12m, input.responseTimeAvgHours, input.portalLoginFrequency);
  const relationship = scoreRelationship(input.tenureYears, input.satisfactionScore, input.advocacyScore);

  // Weighted total: Value 35%, Growth 25%, Engagement 20%, Relationship 20%
  const totalScore = Math.round(value * 0.35 + growth * 0.25 + engagement * 0.20 + relationship * 0.20);
  const tier = determineTier(totalScore);
  const serviceModel = buildServiceModel(tier);

  return { valueScore: value, growthScore: growth, engagementScore: engagement, relationshipScore: relationship, totalScore, tier, serviceModel };
}

// ─── DB Helpers ────────────────────────────────────────────────
export async function saveSegmentation(input: SegmentationInput, result: SegmentationResult) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(clientSegments).values({
    clientId: input.clientId,
    professionalId: input.professionalId,
    valueScore: result.valueScore,
    growthScore: result.growthScore,
    engagementScore: result.engagementScore,
    relationshipScore: result.relationshipScore,
    totalScore: result.totalScore,
    tier: result.tier,
    serviceModelJson: JSON.stringify(result.serviceModel),
    lastClassified: new Date(),
  });
}

export async function getClientSegment(clientId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(clientSegments)
    .where(eq(clientSegments.clientId, clientId))
    .orderBy(desc(clientSegments.createdAt))
    .limit(1);
  return rows[0] || null;
}

export async function getSegmentsByProfessional(professionalId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(clientSegments)
    .where(eq(clientSegments.professionalId, professionalId))
    .orderBy(desc(clientSegments.totalScore));
}
