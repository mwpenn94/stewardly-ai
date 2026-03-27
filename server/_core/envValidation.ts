/**
 * Environment Variable Validation
 * Validates required environment variables at startup.
 * In production, fails fast if critical vars are missing.
 */

const REQUIRED_IN_PRODUCTION = [
  "JWT_SECRET",
  "DATABASE_URL",
  "VITE_APP_ID",
] as const;

const RECOMMENDED_IN_PRODUCTION = [
  "INTEGRATION_ENCRYPTION_KEY",
  "ALLOWED_ORIGINS",
  "OAUTH_SERVER_URL",
] as const;

export function validateRequiredEnvVars(): void {
  const isProduction = process.env.NODE_ENV === "production";
  const missing: string[] = [];
  const warnings: string[] = [];

  for (const key of REQUIRED_IN_PRODUCTION) {
    if (!process.env[key]) {
      if (isProduction) {
        missing.push(key);
      } else {
        warnings.push(key);
      }
    }
  }

  for (const key of RECOMMENDED_IN_PRODUCTION) {
    if (!process.env[key] && isProduction) {
      warnings.push(key);
    }
  }

  if (warnings.length > 0) {
    console.warn(
      `[EnvValidation] Missing recommended env vars: ${warnings.join(", ")}`
    );
  }

  if (missing.length > 0) {
    throw new Error(
      `[EnvValidation] FATAL: Missing required environment variables in production: ${missing.join(", ")}. ` +
      `Server cannot start without these configured.`
    );
  }
}
