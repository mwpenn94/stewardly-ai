/**
 * Task #45 — Infrastructure Documentation Service
 * Auto-generated architecture docs, API catalog, and deployment guides
 */

export interface APIEndpoint {
  path: string;
  method: string;
  description: string;
  auth: "public" | "protected" | "admin";
  inputSchema?: any;
  outputSchema?: any;
  rateLimit?: string;
}

export interface ArchitectureComponent {
  name: string;
  type: "frontend" | "backend" | "database" | "service" | "integration";
  description: string;
  dependencies: string[];
  healthEndpoint?: string;
}

export function getArchitectureOverview(): {
  components: ArchitectureComponent[];
  dataFlow: string[];
  securityLayers: string[];
} {
  return {
    components: [
      { name: "React Frontend", type: "frontend", description: "React 19 + Tailwind 4 SPA with tRPC client", dependencies: ["tRPC Server", "Manus OAuth"] },
      { name: "tRPC Server", type: "backend", description: "Express 4 + tRPC 11 API server with streaming support", dependencies: ["TiDB Database", "S3 Storage", "LLM Service"] },
      { name: "TiDB Database", type: "database", description: "MySQL-compatible distributed database (190+ tables)", dependencies: [] },
      { name: "S3 Storage", type: "service", description: "Object storage for documents, images, and exports", dependencies: [] },
      { name: "LLM Service", type: "service", description: "AI inference via Manus Forge API (GPT-4 class)", dependencies: [] },
      { name: "Manus OAuth", type: "integration", description: "Authentication via Manus OAuth 2.0 flow", dependencies: [] },
      { name: "Edge TTS", type: "service", description: "Text-to-speech via Microsoft Edge TTS", dependencies: [] },
      { name: "Knowledge Base", type: "service", description: "Article storage, search, and freshness scoring", dependencies: ["TiDB Database", "LLM Service"] },
      { name: "AI Tools Registry", type: "service", description: "Tool registration, discovery, and execution logging", dependencies: ["TiDB Database"] },
      { name: "Capability Modes", type: "service", description: "Dynamic mode switching with role-based access", dependencies: ["TiDB Database"] },
    ],
    dataFlow: [
      "User → React Frontend → tRPC Client → tRPC Server → Database/LLM/S3",
      "Auth: User → Manus OAuth → JWT Cookie → tRPC Context → Protected Procedures",
      "Chat: User Message → Context Assembly → LLM → Streaming Response → UI",
      "Knowledge: Query → Knowledge Base Search → Context Injection → LLM → Response",
      "Tools: LLM Tool Call → AI Tools Registry → tRPC Procedure → Result → LLM → Response",
    ],
    securityLayers: [
      "Layer 1: Manus OAuth 2.0 authentication with JWT session cookies",
      "Layer 2: Role-based access control (user/advisor/manager/admin)",
      "Layer 3: Organization-scoped data isolation",
      "Layer 4: PII stripping middleware on all AI interactions",
      "Layer 5: Audit trail logging for compliance-sensitive operations",
      "Layer 6: Dynamic permission boundaries with runtime evaluation",
      "Layer 7: AI boundary enforcement (topic/action/data/compliance/safety)",
      "Layer 8: Data retention policies with automated enforcement",
      "Layer 9: Key rotation with grace periods",
    ],
  };
}

export function getAPIEndpoints(): APIEndpoint[] {
  return [
    { path: "/api/trpc/auth.me", method: "GET", description: "Get current authenticated user", auth: "public" },
    { path: "/api/trpc/auth.logout", method: "POST", description: "Log out current user", auth: "protected" },
    { path: "/api/trpc/chat.send", method: "POST", description: "Send chat message with streaming response", auth: "protected", rateLimit: "30/min" },
    { path: "/api/trpc/chat.history", method: "GET", description: "Get conversation history", auth: "protected" },
    { path: "/api/trpc/knowledge.search", method: "GET", description: "Search knowledge base articles", auth: "public" },
    { path: "/api/trpc/knowledge.create", method: "POST", description: "Create knowledge article", auth: "admin" },
    { path: "/api/trpc/tools.discover", method: "GET", description: "Discover available AI tools", auth: "protected" },
    { path: "/api/trpc/tools.call", method: "POST", description: "Execute an AI tool", auth: "protected" },
    { path: "/api/trpc/calculators.*", method: "POST", description: "Execute financial calculators", auth: "protected" },
    { path: "/api/trpc/models.*", method: "POST", description: "Run financial models", auth: "protected" },
    { path: "/api/trpc/documents.*", method: "GET/POST", description: "Document management", auth: "protected" },
    { path: "/api/trpc/suitability.*", method: "GET/POST", description: "Suitability assessment", auth: "protected" },
    { path: "/api/trpc/products.*", method: "GET", description: "Product catalog", auth: "public" },
    { path: "/api/trpc/exports.*", method: "POST", description: "Data export", auth: "protected" },
  ];
}

export function getDeploymentGuide(): { steps: string[]; envVars: string[]; healthChecks: string[] } {
  return {
    steps: [
      "1. Clone repository and install dependencies: pnpm install",
      "2. Configure environment variables (see envVars list)",
      "3. Run database migrations: pnpm drizzle-kit generate && apply SQL",
      "4. Build frontend: pnpm build",
      "5. Start server: pnpm start",
      "6. Verify health checks pass",
    ],
    envVars: [
      "DATABASE_URL - TiDB/MySQL connection string",
      "JWT_SECRET - Session cookie signing secret",
      "VITE_APP_ID - Manus OAuth application ID",
      "OAUTH_SERVER_URL - Manus OAuth backend URL",
      "BUILT_IN_FORGE_API_URL - LLM API endpoint",
      "BUILT_IN_FORGE_API_KEY - LLM API key",
    ],
    healthChecks: [
      "GET /api/trpc/auth.me - Returns 200 (auth system)",
      "Database connection - Drizzle ORM connects successfully",
      "LLM endpoint - invokeLLM returns valid response",
      "S3 storage - storagePut/storageGet work correctly",
    ],
  };
}

export function getDatabaseStats(): { tableCount: number; estimatedRows: string; schemaVersion: string } {
  return {
    tableCount: 195,
    estimatedRows: "Varies by deployment",
    schemaVersion: "v15.0",
  };
}
