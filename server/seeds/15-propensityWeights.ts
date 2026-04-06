// Expert weights for 14 segment models — re-exports from service
export async function seed() {
  const { EXPERT_MODELS } = await import("../services/propensity/expertWeights");
  console.log(`[seed:15] Propensity weights: ${EXPERT_MODELS.length} segment models loaded`);
  EXPERT_MODELS.forEach(m => console.log(`  - ${m.segment}: ${Object.keys(m.features).length} features`));
}
if (import.meta.url === `file://${process.argv[1]}`) seed();
