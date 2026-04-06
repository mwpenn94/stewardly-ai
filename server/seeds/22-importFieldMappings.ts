export const MAPPINGS = [
  { name: "Dripify Export", source: "dripify_csv", columns: { "First Name": "firstName", "Last Name": "lastName", "Email": "email", "Headline": "title", "Company Name": "company", "Location": "location", "LinkedIn URL": "linkedinUrl" } },
  { name: "Sales Navigator", source: "linkedin_sales_nav", columns: { "First Name": "firstName", "Last Name": "lastName", "Title": "title", "Company": "company", "Company Size": "companySize", "Location": "location", "LinkedIn Sales Nav URL": "linkedinUrl" } },
  { name: "SMS-iT Contacts", source: "smsit_csv", columns: { "first_name": "firstName", "last_name": "lastName", "phone": "phone", "email": "email", "tags": "tags" } },
  { name: "GoHighLevel Export", source: "ghl_sync", columns: { "firstName": "firstName", "lastName": "lastName", "email": "email", "phone": "phone", "tags": "tags", "customFields": "enrichmentData" } },
  { name: "Carrier Roster", source: "manual_csv", columns: { "Agent Name": "firstName", "Email": "email", "Phone": "phone", "License #": "licenseNumber", "State": "state" } },
  { name: "Conference Attendee List", source: "manual_csv", columns: { "Name": "firstName", "Company": "company", "Email": "email", "Title": "title", "City": "city", "State": "state" } },
  { name: "NAIFA/MDRT Member List", source: "manual_csv", columns: { "Member Name": "firstName", "Designation": "title", "City": "city", "State": "state", "Email": "email" } },
  { name: "Referral Partner List", source: "manual_csv", columns: { "Name": "firstName", "Firm": "company", "Specialty": "title", "Email": "email", "Phone": "phone", "City": "city", "State": "state" } },
  { name: "Generic CSV", source: "manual_csv", columns: {} },
  { name: "vCard Import", source: "manual_vcf", columns: { "FN": "firstName", "N": "lastName", "EMAIL": "email", "TEL": "phone", "ORG": "company", "TITLE": "title" } },
];
export async function seed() {
  console.log(`[seed:22] Import field mappings: ${MAPPINGS.length} system mappings defined`);
}
if (import.meta.url === `file://${process.argv[1]}`) seed();
