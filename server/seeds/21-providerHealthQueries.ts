export const HEALTH_QUERIES = [
  { provider: "sec_edgar", query: "Berkshire Hathaway", expectedPattern: "BERKSHIRE" },
  { provider: "finra_brokercheck", query: "7691", expectedPattern: "CRD" },
  { provider: "fred_api", query: "GDP", expectedPattern: "series_id" },
  { provider: "cfp_board", query: "Vanguard", expectedPattern: "CFP" },
  { provider: "bls_api", query: "CES0000000001", expectedPattern: "data" },
];
export async function seed() {
  console.log(`[seed:21] Provider health queries: ${HEALTH_QUERIES.length} known-good queries defined`);
}
if (import.meta.url === `file://${process.argv[1]}`) seed();
