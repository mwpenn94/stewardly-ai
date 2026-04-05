/**
 * Propensity Expert Weights — 14 models with per-feature weights
 * Phase 1 scoring: educated priors, calibrated post-launch
 */

export interface WeightModel {
  segment: string;
  features: Record<string, number>;
}

export const EXPERT_MODELS: WeightModel[] = [
  { segment: "client_retirement", features: { age_over_50: 0.20, income_over_100k: 0.15, has_401k: 0.15, no_advisor: 0.12, calculator_usage: 0.18, engagement_score: 0.10, zip_wealth: 0.10 } },
  { segment: "client_protection", features: { has_dependents: 0.20, no_life_insurance: 0.18, income_over_75k: 0.12, homeowner: 0.10, calculator_usage: 0.15, age_25_55: 0.15, engagement_score: 0.10 } },
  { segment: "client_estate", features: { net_worth_over_1m: 0.22, age_over_55: 0.15, business_owner: 0.15, has_real_estate: 0.12, calculator_usage: 0.16, no_estate_plan: 0.10, engagement_score: 0.10 } },
  { segment: "client_tax", features: { income_over_200k: 0.20, self_employed: 0.15, investment_income: 0.12, no_tax_advisor: 0.10, calculator_usage: 0.18, state_high_tax: 0.15, engagement_score: 0.10 } },
  { segment: "client_education", features: { has_children: 0.22, income_over_100k: 0.12, no_529: 0.15, child_under_10: 0.18, calculator_usage: 0.15, engagement_score: 0.08, zip_school_quality: 0.10 } },
  { segment: "new_associate", features: { licensed: 0.15, age_25_35: 0.10, career_change: 0.12, entrepreneurial: 0.15, network_size: 0.12, education_level: 0.08, warm_market_size: 0.18, engagement_score: 0.10 } },
  { segment: "experienced_professional", features: { years_licensed: 0.15, current_gdc: 0.18, client_count: 0.12, product_mix_breadth: 0.10, technology_adoption: 0.10, growth_trajectory: 0.15, engagement_score: 0.10, platform_interest: 0.10 } },
  { segment: "managing_director", features: { team_size: 0.18, team_gdc: 0.15, recruiting_history: 0.15, leadership_experience: 0.10, training_capability: 0.12, retention_rate: 0.10, engagement_score: 0.10, override_potential: 0.10 } },
  { segment: "rvp", features: { region_size: 0.15, team_count: 0.15, gdc_managed: 0.15, recruiting_pipeline: 0.12, retention_rate: 0.13, growth_rate: 0.10, engagement_score: 0.10, platform_adoption: 0.10 } },
  { segment: "affiliate_a", features: { existing_book: 0.18, aum: 0.15, client_count: 0.12, product_fit: 0.12, technology_readiness: 0.10, referral_potential: 0.13, engagement_score: 0.10, geographic_fit: 0.10 } },
  { segment: "affiliate_b", features: { existing_book: 0.15, specialization: 0.15, referral_network: 0.15, client_overlap: 0.12, cross_sell_potential: 0.13, engagement_score: 0.10, platform_interest: 0.10, geographic_fit: 0.10 } },
  { segment: "affiliate_c", features: { niche_expertise: 0.18, client_segment_fit: 0.15, referral_potential: 0.15, partnership_history: 0.12, engagement_score: 0.10, geographic_fit: 0.10, growth_potential: 0.10, brand_alignment: 0.10 } },
  { segment: "affiliate_d", features: { strategic_value: 0.20, distribution_reach: 0.15, brand_strength: 0.12, technology_integration: 0.13, volume_potential: 0.12, engagement_score: 0.08, partnership_terms: 0.10, market_position: 0.10 } },
  { segment: "strategic_partner", features: { market_access: 0.18, complementary_products: 0.15, distribution_channel: 0.15, brand_synergy: 0.12, technology_compatibility: 0.10, revenue_potential: 0.12, engagement_score: 0.08, strategic_alignment: 0.10 } },
];

export function getModelForSegment(segment: string): WeightModel | undefined {
  return EXPERT_MODELS.find(m => m.segment === segment);
}

export function scoreWithWeights(features: Record<string, number>, weights: Record<string, number>): number {
  let score = 0;
  for (const [key, weight] of Object.entries(weights)) {
    score += (features[key] || 0) * weight;
  }
  return Math.min(1, Math.max(0, score));
}
