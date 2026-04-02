export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
  linkedinClientId: process.env.LINKEDIN_CLIENT_ID ?? "",
  linkedinClientSecret: process.env.LINKEDIN_CLIENT_SECRET ?? "",
  snapTradeClientId: process.env.SNAPTRADE_CLIENT_ID ?? "",
  snapTradeConsumerKey: process.env.SNAPTRADE_CONSUMER_KEY ?? "",
};

const REQUIRED_IN_PRODUCTION = ["DATABASE_URL", "JWT_SECRET", "ALLOWED_ORIGINS"] as const;
const RECOMMENDED = ["OWNER_OPEN_ID", "OAUTH_SERVER_URL"] as const;

if (ENV.isProduction) {
  const missing = REQUIRED_IN_PRODUCTION.filter(
    (key) => !process.env[key]?.trim()
  );
  if (missing.length > 0) {
    throw new Error(
      `[ENV] Missing required environment variables in production: ${missing.join(", ")}`
    );
  }
}

for (const key of RECOMMENDED) {
  if (!process.env[key]?.trim()) {
    console.warn(`[ENV] Recommended variable ${key} is not set`);
  }
}
