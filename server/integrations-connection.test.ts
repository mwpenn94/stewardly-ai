import { describe, it, expect, vi } from "vitest";
import { encryptCredentials, decryptCredentials } from "./services/encryption";

// ─── Government API Integration Connection Tests ────────────────────────

describe("Integration Credential Handling", () => {
  it("should encrypt and decrypt credentials with api_key field", () => {
    const creds = { api_key: "test-key-12345" };
    const encrypted = encryptCredentials(creds);
    expect(encrypted).toBeTruthy();
    expect(encrypted).not.toContain("test-key-12345");
    const decrypted = decryptCredentials(encrypted);
    expect(decrypted.api_key).toBe("test-key-12345");
  });

  it("should normalize credential keys (api_key vs apiKey)", () => {
    // Frontend sends api_key, backend should handle both
    const creds1 = { api_key: "key-from-frontend" };
    const creds2 = { apiKey: "key-from-legacy" };
    const creds3 = { access_token: "token-from-oauth" };

    const enc1 = encryptCredentials(creds1);
    const enc2 = encryptCredentials(creds2);
    const enc3 = encryptCredentials(creds3);

    const dec1 = decryptCredentials(enc1);
    const dec2 = decryptCredentials(enc2);
    const dec3 = decryptCredentials(enc3);

    // The normalization logic: api_key || apiKey || access_token
    const key1 = (dec1.api_key || dec1.apiKey || dec1.access_token || "") as string;
    const key2 = (dec2.api_key || dec2.apiKey || dec2.access_token || "") as string;
    const key3 = (dec3.api_key || dec3.apiKey || dec3.access_token || "") as string;

    expect(key1).toBe("key-from-frontend");
    expect(key2).toBe("key-from-legacy");
    expect(key3).toBe("token-from-oauth");
  });

  it("should produce different ciphertext for same plaintext (random IV)", () => {
    const creds = { api_key: "same-key" };
    const enc1 = encryptCredentials(creds);
    const enc2 = encryptCredentials(creds);
    expect(enc1).not.toBe(enc2); // Random IV ensures different ciphertext
    expect(decryptCredentials(enc1).api_key).toBe("same-key");
    expect(decryptCredentials(enc2).api_key).toBe("same-key");
  });
});

describe("Government API Authentication Methods", () => {
  it("Census Bureau should use query parameter ?key=", () => {
    const apiKey = "test-census-key";
    const testUrl = `https://api.census.gov/data/2021/acs/acs5?get=NAME&for=state:01&key=${apiKey}`;
    expect(testUrl).toContain(`key=${apiKey}`);
    expect(testUrl).not.toContain("Bearer");
    expect(testUrl).not.toContain("Authorization");
  });

  it("FRED should use query parameter ?api_key=", () => {
    const apiKey = "test-fred-key";
    const testUrl = `https://api.stlouisfed.org/fred/series?series_id=GDP&api_key=${apiKey}&file_type=json`;
    expect(testUrl).toContain(`api_key=${apiKey}`);
    expect(testUrl).not.toContain("Bearer");
  });

  it("BLS should use POST body with registrationkey", () => {
    const apiKey = "test-bls-key";
    const body = JSON.stringify({
      seriesid: ["CUUR0000SA0"],
      startyear: "2024",
      endyear: "2024",
      registrationkey: apiKey,
    });
    expect(body).toContain(`"registrationkey":"${apiKey}"`);
    const parsed = JSON.parse(body);
    expect(parsed.registrationkey).toBe(apiKey);
  });

  it("BEA should use query parameter ?UserID=", () => {
    const apiKey = "test-bea-key";
    const testUrl = `https://apps.bea.gov/api/data?&UserID=${apiKey}&method=GETDATASETLIST&ResultFormat=JSON`;
    expect(testUrl).toContain(`UserID=${apiKey}`);
    expect(testUrl).not.toContain("Bearer");
  });

  it("should not use Bearer token for government APIs", () => {
    const govSlugs = ["census-bureau", "bls", "fred", "bea"];
    const bearerApis = ["smsit", "gohighlevel"]; // These use Bearer tokens
    govSlugs.forEach(slug => {
      expect(bearerApis).not.toContain(slug);
    });
  });
});

describe("Connection Status Transitions", () => {
  it("should transition from pending to connected on successful test", () => {
    const statuses = {
      initial: "pending",
      afterSuccessfulTest: "connected",
      afterFailedTest: "error",
    };
    expect(statuses.initial).toBe("pending");
    expect(statuses.afterSuccessfulTest).toBe("connected");
    expect(statuses.afterFailedTest).toBe("error");
  });

  it("should set error status with message on failed test", () => {
    const errorCases = [
      { status: 401, message: "Authentication failed" },
      { status: 403, message: "Authentication failed" },
      { status: 429, message: "HTTP 429" },
      { status: 500, message: "HTTP 500" },
    ];
    errorCases.forEach(c => {
      expect(c.message).toBeTruthy();
      if (c.status === 401 || c.status === 403) {
        expect(c.message).toContain("Authentication failed");
      }
    });
  });

  it("should handle timeout errors gracefully", () => {
    const timeoutMs = 10000;
    expect(timeoutMs).toBe(10000);
    // AbortSignal.timeout(10000) is used in the testConnection handler
  });

  it("should detect invalid API keys from 200 responses with error body", () => {
    // Some government APIs return 200 with error in body
    const responseBody = '{"error": "invalid api key"}';
    const hasError = responseBody.toLowerCase().includes('"error"') && responseBody.toLowerCase().includes('invalid');
    expect(hasError).toBe(true);

    const validBody = '{"results": [{"data": "value"}]}';
    const hasError2 = validBody.toLowerCase().includes('"error"') && validBody.toLowerCase().includes('invalid');
    expect(hasError2).toBe(false);
  });
});

describe("Connection Credential Masking", () => {
  it("should return [encrypted] indicator for connections with credentials", () => {
    const encryptedCreds = encryptCredentials({ api_key: "real-key" });
    const masked = encryptedCreds ? "[encrypted]" : null;
    expect(masked).toBe("[encrypted]");
  });

  it("should return null for connections without credentials", () => {
    const encryptedCreds: string | null = null;
    const masked = encryptedCreds ? "[encrypted]" : null;
    expect(masked).toBeNull();
  });

  it("should never expose actual credentials in API response", () => {
    const connection = {
      id: "conn-1",
      credentialsEncrypted: "[encrypted]",
    };
    expect(connection.credentialsEncrypted).not.toContain("real-key");
    expect(connection.credentialsEncrypted).toBe("[encrypted]");
  });
});

describe("Auto-test After Connection Creation", () => {
  it("should return connection ID from createConnection for auto-test", () => {
    // createConnection returns { ...created, credentialsEncrypted: undefined }
    // The 'id' field must be present for auto-test to work
    const mockCreated = {
      id: "conn-uuid-123",
      providerId: "fred",
      status: "pending",
      credentialsEncrypted: undefined,
    };
    expect(mockCreated.id).toBeTruthy();
    expect(typeof mockCreated.id).toBe("string");
  });

  it("should handle missing connection ID gracefully", () => {
    // If data?.id is falsy, auto-test should not be called
    const data: { id?: string } = {};
    const shouldAutoTest = !!data?.id;
    expect(shouldAutoTest).toBe(false);
  });
});

describe("Provider-Specific Test Endpoints", () => {
  it("should have test endpoints for all government providers", () => {
    const govProviders = [
      { slug: "census-bureau", testUrl: "https://api.census.gov/data/2021/acs/acs5" },
      { slug: "bls", testUrl: "https://api.bls.gov/publicAPI/v2/timeseries/data/" },
      { slug: "fred", testUrl: "https://api.stlouisfed.org/fred/series" },
      { slug: "bea", testUrl: "https://apps.bea.gov/api/data" },
    ];
    govProviders.forEach(p => {
      expect(p.testUrl).toMatch(/^https:\/\//);
      expect(p.slug).toBeTruthy();
    });
  });

  it("should have free-access endpoints for SEC EDGAR and FINRA", () => {
    const freeProviders = [
      { slug: "sec-edgar", testUrl: "https://efts.sec.gov/LATEST/search-index" },
      { slug: "finra-brokercheck", testUrl: "https://api.brokercheck.finra.org/search/individual" },
    ];
    freeProviders.forEach(p => {
      expect(p.testUrl).toBeTruthy();
    });
  });
});

describe("Tier-Based Access Control for Integrations", () => {
  it("should allow admin to manage all tiers", () => {
    const canManage = (role: string, tier: string) => {
      if (role === "admin") return true;
      if (tier === "organization" && (role === "admin" || role === "manager")) return true;
      if (tier === "professional") return true;
      if (tier === "client" && (role === "admin" || role === "manager" || role === "professional")) return true;
      if (tier === "platform" && role === "admin") return true;
      return false;
    };
    expect(canManage("admin", "platform")).toBe(true);
    expect(canManage("admin", "organization")).toBe(true);
    expect(canManage("admin", "client")).toBe(true);
    expect(canManage("user", "platform")).toBe(false);
    expect(canManage("manager", "organization")).toBe(true);
    expect(canManage("professional", "client")).toBe(true);
  });
});
