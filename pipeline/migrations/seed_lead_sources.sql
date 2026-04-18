-- Seed lead_sources with WealthBridge pipeline connectors
-- Run against stewardly-ai's TiDB database
-- Column names from Drizzle schema: source_name, source_type, segment, provider, cost_model, avg_cost, est_volume_monthly, enabled

INSERT INTO lead_sources (source_name, source_type, segment, provider, cost_model, avg_cost, est_volume_monthly, enabled) VALUES
-- T0 Free Sources
('Pima County Assessor', 'directory', 'residential_client', 'AZ County Assessor', 'free', 0.00, 5000, true),
('Mohave County Assessor', 'directory', 'residential_client', 'AZ County Assessor', 'free', 0.00, 2000, true),
('Santa Cruz County Assessor', 'directory', 'residential_client', 'AZ County Assessor', 'free', 0.00, 1000, true),
('AZ Corporation Commission', 'directory', 'commercial_client', 'AZ ACC', 'free', 0.00, 3000, true),
('NM Secretary of State', 'directory', 'commercial_client', 'NM SOS', 'free', 0.00, 2000, true),
('WA Dept of Revenue', 'directory', 'commercial_client', 'WA DOR Socrata API', 'free', 0.00, 5000, true),
('FINRA BrokerCheck', 'directory', 'experienced_pro', 'FINRA', 'free', 0.00, 2000, true),
('SEC EDGAR Form 4', 'directory', 'residential_client', 'SEC', 'free', 0.00, 500, true),
('FAA Aircraft Registry', 'directory', 'residential_client', 'FAA', 'free', 0.00, 300, true),
('IRS BMF', 'directory', 'nonprofit_leader', 'IRS', 'free', 0.00, 1000, true),
('Census ACS', 'directory', NULL, 'US Census Bureau', 'free', 0.00, NULL, true),
('NPI Registry', 'directory', 'residential_client', 'CMS NPPES', 'free', 0.00, 5000, true),
('Google Places', 'directory', NULL, 'Google', 'free', 0.00, 2000, false),
('AZ State Bar', 'directory', 'cpa_attorney_partner', 'AZ State Bar', 'free', 0.00, 500, true),
('AZ DOI Producer Search', 'directory', 'affiliate', 'AZ Dept of Insurance', 'free', 0.00, 1000, true),
('AZ ADRE Licensee Search', 'directory', 'affiliate', 'AZ Dept of Real Estate', 'free', 0.00, 800, true),
('CSV File Upload', 'organic', NULL, 'Manual', 'free', 0.00, NULL, true),
-- T2 Paid Sources
('Hunter.io', 'paid', NULL, 'Hunter.io', 'per_lead', 0.02, NULL, false),
('BatchSkipTracing', 'paid', NULL, 'BatchData', 'per_lead', 0.10, NULL, false),
-- T3 Premium Sources
('Apollo.io', 'paid', NULL, 'Apollo.io', 'per_lead', 1.00, NULL, false),
-- CRM
('GoHighLevel', 'partnership', NULL, 'GHL', 'free', 0.00, NULL, false),
('Dripify', 'partnership', NULL, 'Dripify', 'subscription', 0.00, NULL, false)
ON DUPLICATE KEY UPDATE source_name = VALUES(source_name);
