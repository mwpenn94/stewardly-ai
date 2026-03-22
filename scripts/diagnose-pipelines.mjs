import 'dotenv/config';
import crypto from 'crypto';

// Replicate the decrypt logic
function decrypt(encryptedData) {
  const key = process.env.INTEGRATION_ENCRYPTION_KEY || process.env.JWT_SECRET || 'fallback';
  const keys = [key];
  if (process.env.INTEGRATION_ENCRYPTION_KEY && process.env.JWT_SECRET) {
    keys.push(process.env.JWT_SECRET);
  }
  
  for (const k of keys) {
    try {
      const parts = encryptedData.split(':');
      if (parts.length !== 3) throw new Error('Invalid format');
      const [ivHex, authTagHex, encrypted] = parts;
      const derivedKey = crypto.scryptSync(k, 'salt', 32);
      const decipher = crypto.createDecipheriv('aes-256-gcm', derivedKey, Buffer.from(ivHex, 'hex'));
      decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch(e) {
      continue;
    }
  }
  throw new Error('Decryption failed with all keys');
}

// Test each API directly
async function testBLS(apiKey) {
  console.log('\n=== BLS ===');
  try {
    const resp = await fetch('https://api.bls.gov/publicAPI/v2/timeseries/data/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        seriesid: ['CUUR0000SA0'],
        startyear: '2024',
        endyear: '2025',
        registrationkey: apiKey
      })
    });
    const data = await resp.json();
    console.log('Status:', data.status);
    console.log('Message:', data.message?.join('; '));
    if (data.Results?.series?.[0]?.data) {
      console.log('Records:', data.Results.series[0].data.length);
      console.log('Sample:', data.Results.series[0].data[0]);
    } else {
      console.log('No data returned');
      console.log('Full response:', JSON.stringify(data).substring(0, 500));
    }
  } catch(e) {
    console.log('ERROR:', e.message);
  }
}

async function testFRED(apiKey) {
  console.log('\n=== FRED ===');
  try {
    const resp = await fetch(`https://api.stlouisfed.org/fred/series/observations?series_id=GDP&api_key=${apiKey}&file_type=json&sort_order=desc&limit=5`);
    const data = await resp.json();
    if (data.error_message) {
      console.log('ERROR:', data.error_message);
    } else {
      console.log('Records:', data.observations?.length);
      console.log('Sample:', data.observations?.[0]);
    }
  } catch(e) {
    console.log('ERROR:', e.message);
  }
}

async function testBEA(apiKey) {
  console.log('\n=== BEA ===');
  try {
    const resp = await fetch(`https://apps.bea.gov/api/data/?method=getdata&datasetname=NIPA&TableName=T10101&Frequency=Q&Year=2024&ResultFormat=JSON&UserID=${apiKey}`);
    const text = await resp.text();
    try {
      const data = JSON.parse(text);
      if (data.BEAAPI?.Results?.Error) {
        console.log('API Error:', JSON.stringify(data.BEAAPI.Results.Error));
      } else if (data.BEAAPI?.Results?.Data) {
        console.log('Records:', data.BEAAPI.Results.Data.length);
        console.log('Sample:', data.BEAAPI.Results.Data[0]);
      } else {
        console.log('Unexpected response:', text.substring(0, 500));
      }
    } catch(e) {
      console.log('Non-JSON response:', text.substring(0, 500));
    }
  } catch(e) {
    console.log('ERROR:', e.message);
  }
}

async function testEDGAR() {
  console.log('\n=== SEC EDGAR ===');
  try {
    const resp = await fetch('https://data.sec.gov/api/xbrl/companyfacts/CIK0000320193.json', {
      headers: {
        'User-Agent': 'WealthBridgeAI/1.0 (support@wealthbridge.ai)',
        'Accept': 'application/json'
      }
    });
    console.log('HTTP Status:', resp.status);
    if (resp.ok) {
      const data = await resp.json();
      const facts = data.facts?.['us-gaap'];
      if (facts) {
        const keys = Object.keys(facts);
        console.log('Total fact types:', keys.length);
        console.log('Has Revenue:', !!facts['Revenues'] || !!facts['RevenueFromContractWithCustomerExcludingAssessedTax']);
      } else {
        console.log('No us-gaap facts found');
      }
    } else {
      const text = await resp.text();
      console.log('Error response:', text.substring(0, 500));
    }
  } catch(e) {
    console.log('ERROR:', e.message);
  }
}

async function testFINRA() {
  console.log('\n=== FINRA BrokerCheck ===');
  try {
    const resp = await fetch('https://api.brokercheck.finra.org/search/firm?query=Goldman%20Sachs&start=0&rows=1');
    console.log('HTTP Status:', resp.status);
    if (resp.ok) {
      const data = await resp.json();
      console.log('Total hits:', data.hits?.total);
      if (data.hits?.hits?.[0]) {
        const src = data.hits.hits[0]._source;
        console.log('Firm:', src?.bc_firm_name);
        console.log('CRD:', src?.bc_source_id);
      }
    } else {
      const text = await resp.text();
      console.log('Error response:', text.substring(0, 500));
    }
  } catch(e) {
    console.log('ERROR:', e.message);
  }
}

// Main
console.log('=== DIAGNOSING PIPELINE FAILURES ===');
console.log('INTEGRATION_ENCRYPTION_KEY set:', !!process.env.INTEGRATION_ENCRYPTION_KEY);
console.log('JWT_SECRET set:', !!process.env.JWT_SECRET);

// Try to get API keys from database via direct MySQL query
import mysql from 'mysql2/promise';

const dbUrl = process.env.DATABASE_URL;
console.log('DATABASE_URL set:', !!dbUrl);

try {
  const conn = await mysql.createConnection(dbUrl);
  
  const [rows] = await conn.execute(`
    SELECT p.slug, p.name, c.status, c.credentials_encrypted, c.records_synced, c.last_sync_error, c.last_sync_at
    FROM integration_connections c
    JOIN integration_providers p ON c.provider_id = p.id
  `);
  
  console.log('\n=== CONNECTION STATUS ===');
  const keys = {};
  for (const row of rows) {
    let apiKey = null;
    if (row.credentials_encrypted) {
      try {
        const decrypted = decrypt(row.credentials_encrypted);
        const parsed = JSON.parse(decrypted);
        apiKey = parsed.api_key || parsed.apiKey || parsed.access_token;
        console.log(`${row.slug}: status=${row.status}, records=${row.records_synced}, key=${apiKey ? apiKey.substring(0,8)+'...' : 'none'}, lastSync=${row.last_sync_at}, error=${row.last_sync_error || 'none'}`);
      } catch(e) {
        console.log(`${row.slug}: status=${row.status}, records=${row.records_synced}, DECRYPT_FAILED: ${e.message}`);
      }
    } else {
      console.log(`${row.slug}: status=${row.status}, records=${row.records_synced}, no credentials (keyless API)`);
    }
    keys[row.slug] = apiKey;
  }
  
  // Test each API
  if (keys['bls']) await testBLS(keys['bls']);
  if (keys['fred']) await testFRED(keys['fred']);
  if (keys['bea']) await testBEA(keys['bea']);
  await testEDGAR();
  await testFINRA();
  
  await conn.end();
} catch(e) {
  console.log('DB Error:', e.message);
}

process.exit(0);
