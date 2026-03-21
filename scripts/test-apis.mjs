/**
 * Direct API test script — tests each government API endpoint
 * to diagnose why pipelines return 0 records in production.
 */
import 'dotenv/config';
import crypto from 'crypto';

// Get DB connection to retrieve API keys
import { createConnection } from 'mysql2/promise';

const DATABASE_URL = process.env.DATABASE_URL;
const ENCRYPTION_KEY = process.env.INTEGRATION_ENCRYPTION_KEY || process.env.JWT_SECRET;

function decryptSimple(encrypted) {
  try {
    const parts = encrypted.split(':');
    if (parts.length < 3) return null;
    const [ivHex, authTagHex, cipherHex] = parts;
    const key = crypto.createHash('sha256').update(ENCRYPTION_KEY).digest();
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
    let decrypted = decipher.update(cipherHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return JSON.parse(decrypted);
  } catch (e) {
    // Try with JWT_SECRET fallback
    try {
      const parts = encrypted.split(':');
      const [ivHex, authTagHex, cipherHex] = parts;
      const key = crypto.createHash('sha256').update(process.env.JWT_SECRET).digest();
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
      decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
      let decrypted = decipher.update(cipherHex, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return JSON.parse(decrypted);
    } catch (e2) {
      return null;
    }
  }
}

async function getApiKeys() {
  const conn = await createConnection(DATABASE_URL);
  const [rows] = await conn.execute(`
    SELECT p.slug, c.credentials_encrypted 
    FROM integration_connections c 
    JOIN integration_providers p ON c.provider_id = p.id 
    WHERE c.status = 'connected' AND c.credentials_encrypted IS NOT NULL
  `);
  await conn.end();
  
  const keys = {};
  for (const row of rows) {
    const creds = decryptSimple(row.credentials_encrypted);
    if (creds) {
      keys[row.slug] = creds.api_key || creds.apiKey || creds.access_token || '';
    }
  }
  return keys;
}

async function testBLS(apiKey) {
  console.log('\n=== Testing BLS API ===');
  console.log(`API Key: ${apiKey ? apiKey.substring(0, 8) + '...' : 'MISSING'}`);
  
  const currentYear = new Date().getFullYear();
  const body = {
    seriesid: ["CUUR0000SA0", "LNS14000000"],
    startyear: String(currentYear - 1),
    endyear: String(currentYear),
    registrationkey: apiKey,
    calculations: true,
  };
  
  console.log('Request body:', JSON.stringify(body, null, 2));
  
  try {
    const resp = await fetch("https://api.bls.gov/publicAPI/v2/timeseries/data/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    });
    
    console.log(`Response status: ${resp.status}`);
    const data = await resp.json();
    console.log(`BLS status: ${data.status}`);
    console.log(`BLS message: ${JSON.stringify(data.message)}`);
    console.log(`Series count: ${data.Results?.series?.length || 0}`);
    
    if (data.Results?.series?.[0]?.data?.[0]) {
      const latest = data.Results.series[0].data[0];
      console.log(`Latest data point: ${JSON.stringify(latest)}`);
    }
    
    return data;
  } catch (e) {
    console.error(`BLS Error: ${e.message}`);
    return null;
  }
}

async function testFRED(apiKey) {
  console.log('\n=== Testing FRED API ===');
  console.log(`API Key: ${apiKey ? apiKey.substring(0, 8) + '...' : 'MISSING'}`);
  
  try {
    const resp = await fetch(
      `https://api.stlouisfed.org/fred/series/observations?series_id=FEDFUNDS&api_key=${apiKey}&file_type=json&sort_order=desc&limit=1`,
      { signal: AbortSignal.timeout(15000) }
    );
    
    console.log(`Response status: ${resp.status}`);
    const data = await resp.json();
    console.log(`Observations: ${data.observations?.length || 0}`);
    if (data.observations?.[0]) {
      console.log(`Latest: ${JSON.stringify(data.observations[0])}`);
    }
    if (data.error_message) {
      console.log(`Error: ${data.error_message}`);
    }
    return data;
  } catch (e) {
    console.error(`FRED Error: ${e.message}`);
    return null;
  }
}

async function testBEA(apiKey) {
  console.log('\n=== Testing BEA API ===');
  console.log(`API Key: ${apiKey ? apiKey.substring(0, 8) + '...' : 'MISSING'}`);
  
  // Test GDP data
  const url = `https://apps.bea.gov/api/data?&UserID=${apiKey}&method=GetData&DatasetName=NIPA&Frequency=Q&TableName=T10101&Year=LAST5&ResultFormat=JSON`;
  console.log(`URL: ${url.replace(apiKey, 'REDACTED')}`);
  
  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(20000) });
    console.log(`Response status: ${resp.status}`);
    const text = await resp.text();
    console.log(`Response length: ${text.length}`);
    console.log(`First 500 chars: ${text.substring(0, 500)}`);
    
    try {
      const data = JSON.parse(text);
      const results = data?.BEAAPI?.Results?.Data;
      console.log(`Data array? ${Array.isArray(results)}, length: ${results?.length || 0}`);
      if (results?.[0]) {
        console.log(`First row: ${JSON.stringify(results[0])}`);
      }
      if (data?.BEAAPI?.Results?.Error) {
        console.log(`BEA Error: ${JSON.stringify(data.BEAAPI.Results.Error)}`);
      }
    } catch (e) {
      console.log(`JSON parse failed: ${e.message}`);
    }
  } catch (e) {
    console.error(`BEA Error: ${e.message}`);
  }
}

async function testCensus(apiKey) {
  console.log('\n=== Testing Census API ===');
  console.log(`API Key: ${apiKey ? apiKey.substring(0, 8) + '...' : 'MISSING'}`);
  
  // Test ACS 5-Year
  const url = `https://api.census.gov/data/2022/acs/acs5?get=B19013_001E,B17001_002E,B15003_022E,B01003_001E&for=us:*&key=${apiKey}`;
  console.log(`URL: ${url.replace(apiKey, 'REDACTED')}`);
  
  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(20000) });
    console.log(`Response status: ${resp.status}`);
    const text = await resp.text();
    console.log(`Response length: ${text.length}`);
    console.log(`Response: ${text.substring(0, 500)}`);
    
    try {
      const data = JSON.parse(text);
      console.log(`Rows: ${data.length}`);
      if (data[0]) console.log(`Headers: ${JSON.stringify(data[0])}`);
      if (data[1]) console.log(`Data: ${JSON.stringify(data[1])}`);
    } catch (e) {
      console.log(`JSON parse failed: ${e.message}`);
    }
  } catch (e) {
    console.error(`Census Error: ${e.message}`);
  }
}

async function main() {
  console.log('Retrieving API keys from database...');
  const keys = await getApiKeys();
  console.log(`Found keys for: ${Object.keys(keys).join(', ')}`);
  
  await testBLS(keys['bls']);
  await testFRED(keys['fred']);
  await testBEA(keys['bea']);
  await testCensus(keys['census-bureau']);
}

main().catch(console.error);
