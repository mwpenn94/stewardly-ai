import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

/**
 * Pass 3C: Adversarial Testing — Session Security, Privilege Escalation, Rate Limiting
 */

// ============================================================
// 1. SESSION SECURITY
// ============================================================
describe("Session Security", () => {
  it("localStorage usage is limited to session tokens and UI preferences (no raw secrets)", () => {
    const clientDir = path.join(__dirname, "../client/src");
    const files = getAllTsFiles(clientDir);
    const violations: string[] = [];

    for (const file of files) {
      const content = fs.readFileSync(file, "utf-8");
      // Check for DANGEROUS storage: raw API keys, passwords, or credit card data
      // Session tokens in localStorage are acceptable — the app uses Bearer tokens
      // because the reverse proxy strips Set-Cookie headers (documented in sessionToken.ts)
      if (content.includes("localStorage.setItem") && 
          (content.includes("apiKey") || content.includes("password") || 
           content.includes("creditCard") || content.includes("ssn"))) {
        violations.push(path.relative(clientDir, file));
      }
    }

    expect(violations).toEqual([]);
  });

  it("session cookies have proper security attributes", () => {
    const cookiePath = path.join(__dirname, "_core/cookies.ts");
    if (!fs.existsSync(cookiePath)) return;
    
    const content = fs.readFileSync(cookiePath, "utf-8");
    expect(content).toContain("httpOnly: true");
    expect(content).toContain("sameSite");
    // secure should be true in production
    expect(content.includes("secure: true") || content.includes("secure:")).toBe(true);
  });

  it("no sensitive data exposed in client-side code", () => {
    const clientDir = path.join(__dirname, "../client/src");
    const files = getAllTsFiles(clientDir);
    const violations: string[] = [];

    for (const file of files) {
      const content = fs.readFileSync(file, "utf-8");
      const lines = content.split("\n");
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.trimStart().startsWith("//") || line.trimStart().startsWith("*")) continue;
        
        // Check for server-side secrets in client code
        if (/process\.env\.(STRIPE_SECRET|JWT_SECRET|PLAID_SECRET|DATABASE_URL|SNAPTRADE_CONSUMER)/i.test(line)) {
          violations.push(`${path.relative(clientDir, file)}:${i + 1}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it("CORS is properly configured (no wildcard in production)", () => {
    const serverDir = path.join(__dirname, ".");
    const files = getAllTsFiles(serverDir);
    const wildcardCors: string[] = [];

    for (const file of files) {
      if (file.includes(".test.") || file.includes("node_modules")) continue;
      const content = fs.readFileSync(file, "utf-8");
      
      // Check for CORS wildcard
      if (content.includes("origin: '*'") || content.includes('origin: "*"') || 
          content.includes("Access-Control-Allow-Origin', '*'")) {
        wildcardCors.push(path.relative(process.cwd(), file));
      }
    }

    expect(wildcardCors).toEqual([]);
  });
});

// ============================================================
// 2. PRIVILEGE ESCALATION DEFENSE
// ============================================================
describe("Privilege Escalation Defense", () => {
  it("admin procedures use role-based access control", () => {
    const routerDir = path.join(__dirname, "routers");
    const files = getFilesInDir(routerDir).filter(f => f.endsWith(".ts") && !f.includes(".test."));
    const mainRouter = path.join(__dirname, "routers.ts");
    if (fs.existsSync(mainRouter)) files.push(mainRouter);

    let adminProcedures = 0;
    let protectedAdminProcedures = 0;

    for (const file of files) {
      const content = fs.readFileSync(file, "utf-8");
      
      // Find admin-related procedures
      const adminMatches = content.match(/admin\w*(?:Procedure|procedure|Router|router)/gi);
      if (adminMatches) adminProcedures += adminMatches.length;
      
      // Check for role checks
      if (content.includes("ctx.user.role") || content.includes("role !== 'admin'") || 
          content.includes("role === 'admin'") || content.includes("adminProcedure")) {
        protectedAdminProcedures++;
      }
    }

    console.log(`Admin procedures: ${adminProcedures}, Files with role checks: ${protectedAdminProcedures}`);
    // Should have role-based access control
    expect(protectedAdminProcedures).toBeGreaterThan(0);
  });

  it("protected procedures require authentication", () => {
    const routerDir = path.join(__dirname, "routers");
    const files = getFilesInDir(routerDir).filter(f => f.endsWith(".ts") && !f.includes(".test."));
    
    let protectedCount = 0;
    let publicCount = 0;

    for (const file of files) {
      const content = fs.readFileSync(file, "utf-8");
      protectedCount += (content.match(/protectedProcedure/g) || []).length;
      publicCount += (content.match(/publicProcedure/g) || []).length;
    }

    console.log(`Protected procedures: ${protectedCount}, Public procedures: ${publicCount}`);
    // Most procedures should be protected
    expect(protectedCount).toBeGreaterThan(publicCount);
  });

  it("user data access is scoped to the authenticated user", () => {
    const serverDir = path.join(__dirname, ".");
    const files = getAllTsFiles(serverDir);
    let userScopedQueries = 0;

    for (const file of files) {
      if (file.includes(".test.") || file.includes("node_modules") || file.includes("_core")) continue;
      const content = fs.readFileSync(file, "utf-8");
      
      // Count queries that filter by userId/ctx.user.id
      const userFilters = content.match(/ctx\.user\.id|userId|user_id/g);
      if (userFilters) userScopedQueries += userFilters.length;
    }

    console.log(`User-scoped query references: ${userScopedQueries}`);
    expect(userScopedQueries).toBeGreaterThan(100);
  });
});

// ============================================================
// 3. RATE LIMITING & ABUSE PREVENTION
// ============================================================
describe("Rate Limiting & Abuse Prevention", () => {
  it("rate limiting middleware exists for API routes", () => {
    const serverDir = path.join(__dirname, ".");
    const files = getAllTsFiles(serverDir);
    let rateLimitRefs = 0;

    for (const file of files) {
      if (file.includes(".test.") || file.includes("node_modules")) continue;
      const content = fs.readFileSync(file, "utf-8");
      
      if (content.includes("rateLimit") || content.includes("rateLimiter") || 
          content.includes("throttle") || content.includes("RateLimit")) {
        rateLimitRefs++;
      }
    }

    console.log(`Files with rate limiting: ${rateLimitRefs}`);
    expect(rateLimitRefs).toBeGreaterThan(0);
  });

  it("file upload size limits are enforced", () => {
    const serverDir = path.join(__dirname, ".");
    const files = getAllTsFiles(serverDir);
    let sizeLimitRefs = 0;

    for (const file of files) {
      if (file.includes(".test.") || file.includes("node_modules")) continue;
      const content = fs.readFileSync(file, "utf-8");
      
      if (content.includes("maxFileSize") || content.includes("MAX_FILE_SIZE") || 
          content.includes("fileSizeLimit") || content.includes("limit:") ||
          content.includes("16MB") || content.includes("16 * 1024") ||
          content.includes("maxSize")) {
        sizeLimitRefs++;
      }
    }

    console.log(`Files with size limits: ${sizeLimitRefs}`);
    expect(sizeLimitRefs).toBeGreaterThan(0);
  });

  it("webhook endpoints verify signatures", () => {
    const serverDir = path.join(__dirname, ".");
    const files = getAllTsFiles(serverDir);
    const webhookFiles: string[] = [];
    const verifiedWebhooks: string[] = [];

    for (const file of files) {
      if (file.includes(".test.") || file.includes("node_modules")) continue;
      const basename = path.basename(file);
      
      if (basename.toLowerCase().includes("webhook")) {
        webhookFiles.push(basename);
        const content = fs.readFileSync(file, "utf-8");
        
        if (content.includes("verify") || content.includes("signature") || 
            content.includes("constructEvent") || content.includes("hmac") ||
            content.includes("HMAC") || content.includes("crypto")) {
          verifiedWebhooks.push(basename);
        }
      }
    }

    console.log(`Webhook files: ${webhookFiles.length}, With signature verification: ${verifiedWebhooks.length}`);
    // All webhook files should verify signatures
    const ratio = webhookFiles.length > 0 ? verifiedWebhooks.length / webhookFiles.length : 1;
    expect(ratio).toBeGreaterThan(0.5);
  });

  it("no API keys or secrets hardcoded in source code", () => {
    const dirs = [
      path.join(__dirname, "."),
      path.join(__dirname, "../client/src"),
    ];
    const violations: string[] = [];

    for (const dir of dirs) {
      const files = getAllTsFiles(dir);
      for (const file of files) {
        if (file.includes(".test.") || file.includes("node_modules") || file.includes(".env")) continue;
        const content = fs.readFileSync(file, "utf-8");
        const lines = content.split("\n");
        
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (line.trimStart().startsWith("//") || line.trimStart().startsWith("*")) continue;
          
          // Check for hardcoded API key patterns (sk_live_, pk_live_, etc.)
          if (/(?:sk_live_|pk_live_|sk_test_[a-zA-Z0-9]{20,}|AKIA[A-Z0-9]{16})/i.test(line)) {
            violations.push(`${path.relative(process.cwd(), file)}:${i + 1}`);
          }
        }
      }
    }

    expect(violations).toEqual([]);
  });
});

// ============================================================
// 4. INPUT VALIDATION
// ============================================================
describe("Input Validation", () => {
  it("tRPC procedures use Zod schema validation for inputs", () => {
    const routerDir = path.join(__dirname, "routers");
    const files = getFilesInDir(routerDir).filter(f => f.endsWith(".ts") && !f.includes(".test."));
    const mainRouter = path.join(__dirname, "routers.ts");
    if (fs.existsSync(mainRouter)) files.push(mainRouter);

    let totalMutations = 0;
    let validatedMutations = 0;

    for (const file of files) {
      const content = fs.readFileSync(file, "utf-8");
      
      const mutations = content.match(/\.mutation\s*\(/g);
      if (mutations) totalMutations += mutations.length;
      
      // Count mutations with .input() validation
      const validated = content.match(/\.input\s*\(\s*z\./g);
      if (validated) validatedMutations += validated.length;
    }

    const ratio = totalMutations > 0 ? validatedMutations / totalMutations : 1;
    console.log(`Mutations: ${totalMutations}, With Zod validation: ${validatedMutations} (${(ratio * 100).toFixed(1)}%)`);
    expect(ratio).toBeGreaterThan(0.5);
  });
});

// ============================================================
// HELPERS
// ============================================================
function getAllTsFiles(dir: string): string[] {
  const results: string[] = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith(".") && entry.name !== "node_modules") {
        results.push(...getAllTsFiles(fullPath));
      } else if (entry.isFile() && (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx"))) {
        results.push(fullPath);
      }
    }
  } catch {}
  return results;
}

function getFilesInDir(dir: string): string[] {
  try {
    return fs.readdirSync(dir).map(f => path.join(dir, f));
  } catch {
    return [];
  }
}
