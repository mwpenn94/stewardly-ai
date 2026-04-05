export const CHANNELS = [
  { channel: "LinkedIn Organic", monthlySpend: 0, estLeads: 8, conversionRate: 0.12, cpl: 0, cac: 0, notes: "Free — professional networking" },
  { channel: "LinkedIn Paid", monthlySpend: 300, estLeads: 12, conversionRate: 0.08, cpl: 25, cac: 312, notes: "Targeted ads to professionals" },
  { channel: "Dripify Automation", monthlySpend: 59, estLeads: 15, conversionRate: 0.06, cpl: 4, cac: 66, notes: "LinkedIn outreach automation" },
  { channel: "Google Ads", monthlySpend: 400, estLeads: 20, conversionRate: 0.05, cpl: 20, cac: 400, notes: "Search intent targeting" },
  { channel: "Content/SEO", monthlySpend: 200, estLeads: 10, conversionRate: 0.10, cpl: 20, cac: 200, notes: "Pillar pages + calculator SEO" },
  { channel: "Seminars/Events", monthlySpend: 300, estLeads: 8, conversionRate: 0.15, cpl: 38, cac: 250, notes: "Local financial education events" },
  { channel: "Referral Program", monthlySpend: 66, estLeads: 5, conversionRate: 0.25, cpl: 13, cac: 53, notes: "Client + COI referrals" },
  { channel: "Calculator Widget", monthlySpend: 100, estLeads: 15, conversionRate: 0.12, cpl: 7, cac: 56, notes: "Embedded on partner sites" },
];
export async function seed() {
  const totalSpend = CHANNELS.reduce((s, c) => s + c.monthlySpend, 0);
  const totalLeads = CHANNELS.reduce((s, c) => s + c.estLeads, 0);
  console.log(`[seed:32] AZ Region 1 pilot: ${CHANNELS.length} channels, $${totalSpend}/mo, ~${totalLeads} leads/mo`);
}
if (import.meta.url === `file://${process.argv[1]}`) seed();
