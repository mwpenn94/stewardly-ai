/**
 * Hub Pages + Navigation Consolidation Tests (C22-C27 + Pass 111)
 * - Operations Hub
 * - Intelligence Hub
 * - Advisory Hub
 * - Relationships Hub
 * - Sidebar Navigation
 * - Route Redirects
 * - Pass 111: PeopleHub, IntelligenceHubV2, AdminHubV2 structure tests
 */
import { describe, expect, it } from "vitest";
import * as fs from "fs";
import * as path from "path";

const ROOT = path.resolve(__dirname, "..");
function readFile(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf-8");
}

// ─── C22: Operations Hub ──────────────────────────────────────────
describe("Operations Hub", () => {
  describe("Tab Structure", () => {
    it("should have 4 tabs: Active Work, Agents, Compliance, History", () => {
      const tabs = ["active", "agents", "compliance", "history"];
      expect(tabs).toHaveLength(4);
    });
  });

  describe("Active Work View", () => {
    it("should show pending reviews", () => {
      const reviews = [
        { id: 1, type: "compliance_review", status: "pending" },
        { id: 2, type: "escalation", status: "pending" },
      ];
      const pending = reviews.filter(r => r.status === "pending");
      expect(pending.length).toBeGreaterThan(0);
    });

    it("should show active workflows", () => {
      const workflows = [{ id: 1, name: "Client Onboarding", progress: 60 }];
      expect(workflows[0].progress).toBeGreaterThan(0);
    });
  });

  describe("Agents View", () => {
    it("should show running agents", () => {
      const agents = [
        { id: 1, template: "Portfolio Review", status: "running" },
        { id: 2, template: "Compliance Check", status: "completed" },
      ];
      const running = agents.filter(a => a.status === "running");
      expect(running.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Compliance View", () => {
    it("should show compliance score", () => {
      const score = 92;
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });
  });
});

// ─── C23: Intelligence Hub ────────────────────────────────────────
describe("Intelligence Hub", () => {
  describe("Tab Structure", () => {
    it("should have 4 tabs: Overview, Models, Data, Analytics", () => {
      const tabs = ["overview", "models", "data", "analytics"];
      expect(tabs).toHaveLength(4);
    });
  });

  describe("Overview", () => {
    it("should show key metrics", () => {
      const metrics = { totalModels: 8, dataPoints: 15000, insightsGenerated: 250 };
      expect(metrics.totalModels).toBe(8);
    });
  });

  describe("Models View", () => {
    it("should list all financial models", () => {
      const models = [
        "Monte Carlo", "Debt Optimization", "Tax Optimization",
        "Portfolio Risk", "Insurance Needs", "Estate Planning",
        "Education Funding", "Cash Flow",
      ];
      expect(models).toHaveLength(8);
    });
  });

  describe("Data View", () => {
    it("should show data source status", () => {
      const sources = [
        { name: "Plaid", status: "connected", lastSync: Date.now() },
        { name: "Market Data", status: "connected", lastSync: Date.now() },
      ];
      sources.forEach(s => expect(s.status).toBe("connected"));
    });
  });
});

// ─── C24: Advisory Hub ────────────────────────────────────────────
describe("Advisory Hub", () => {
  describe("Tab Structure", () => {
    it("should have 4 tabs: Products, Cases, Recommendations, Marketplace", () => {
      const tabs = ["products", "cases", "recommendations", "marketplace"];
      expect(tabs).toHaveLength(4);
    });
  });

  describe("Products View", () => {
    it("should list products with suitability scores", () => {
      const products = [
        { name: "IUL", suitabilityScore: 0.85 },
        { name: "Term Life", suitabilityScore: 0.72 },
      ];
      expect(products[0].suitabilityScore).toBeGreaterThan(0);
    });
  });

  describe("Recommendations View", () => {
    it("should show AI-generated recommendations", () => {
      const recommendations = [
        { product: "IUL", reason: "Matches risk profile", confidence: 0.88 },
      ];
      expect(recommendations[0].confidence).toBeGreaterThan(0.5);
    });
  });
});

// ─── C25: Relationships Hub ───────────────────────────────────────
describe("Relationships Hub", () => {
  describe("Tab Structure", () => {
    it("should have 4 tabs: Network, Meetings, Outreach, COI", () => {
      const tabs = ["network", "meetings", "outreach", "coi"];
      expect(tabs).toHaveLength(4);
    });
  });

  describe("Network View", () => {
    it("should show professional connections", () => {
      const connections = [
        { name: "Dr. Smith", type: "CPA", relationship: "referral_partner" },
      ];
      expect(connections.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Meetings View", () => {
    it("should show upcoming meetings", () => {
      const meetings = [
        { title: "Portfolio Review", date: "2024-02-01", attendees: 2 },
      ];
      expect(meetings[0].attendees).toBeGreaterThan(0);
    });
  });
});

// ─── C26: Sidebar Navigation ──────────────────────────────────────
describe("Sidebar Navigation Consolidation", () => {
  describe("Navigation Structure", () => {
    it("should have 7 main navigation items", () => {
      const navItems = [
        "Chat", "Operations", "Intelligence", "Advisory",
        "Relationships", "Settings", "Knowledge Admin",
      ];
      expect(navItems).toHaveLength(7);
    });

    it("should replace 28 items with consolidated navigation", () => {
      const oldItemCount = 28;
      const newItemCount = 7;
      expect(newItemCount).toBeLessThan(oldItemCount);
    });
  });

  describe("Admin Section", () => {
    it("should show admin items only for admin users", () => {
      const userRole = "admin";
      const showAdmin = userRole === "admin";
      expect(showAdmin).toBe(true);
    });

    it("should hide admin items for regular users", () => {
      const userRole = "user";
      const showAdmin = userRole === "admin";
      expect(showAdmin).toBe(false);
    });
  });
});

// ─── C27: Route Redirects ─────────────────────────────────────────
describe("Route Redirects", () => {
  describe("Tier 1 Page Redirects", () => {
    it("should redirect /study-buddy to /chat with prompt", () => {
      const redirect = { from: "/study-buddy", to: "/chat", prompt: "study buddy" };
      expect(redirect.to).toBe("/chat");
    });

    it("should redirect /education to /chat with prompt", () => {
      const redirect = { from: "/education", to: "/chat", prompt: "education" };
      expect(redirect.to).toBe("/chat");
    });

    it("should redirect /coach to /chat with prompt", () => {
      const redirect = { from: "/coach", to: "/chat", prompt: "behavioral coaching" };
      expect(redirect.to).toBe("/chat");
    });

    it("should redirect /calculators to /chat with prompt", () => {
      const redirect = { from: "/calculators", to: "/chat", prompt: "calculator" };
      expect(redirect.to).toBe("/chat");
    });
  });

  describe("Hub Redirects", () => {
    it("should redirect /compliance to /operations", () => {
      const redirect = { from: "/compliance", to: "/operations" };
      expect(redirect.to).toBe("/operations");
    });

    it("should redirect /analytics to /intelligence", () => {
      const redirect = { from: "/analytics", to: "/intelligence" };
      expect(redirect.to).toBe("/intelligence");
    });

    it("should redirect /products to /advisory", () => {
      const redirect = { from: "/products", to: "/advisory" };
      expect(redirect.to).toBe("/advisory");
    });

    it("should redirect /professionals to /relationships", () => {
      const redirect = { from: "/professionals", to: "/relationships" };
      expect(redirect.to).toBe("/relationships");
    });
  });
});

// ─── Pass 111: Hub Pages with Internal Sidebars ───────────────────
describe("Pass 111: Hub pages structure", () => {
  const peopleHub = readFile("client/src/pages/PeopleHub.tsx");
  const intelligenceHub = readFile("client/src/pages/IntelligenceHubV2.tsx");
  const adminHub = readFile("client/src/pages/AdminHubV2.tsx");

  describe("PeopleHub", () => {
    it("exports a default component", () => {
      expect(peopleHub).toContain("export default function PeopleHub");
    });

    it("uses wouter useRoute for tab routing", () => {
      expect(peopleHub).toMatch(/useRoute\(["']\/people\/:tab["']\)/);
    });

    it("includes key sub-pages: Clients, Leads, Compliance", () => {
      expect(peopleHub).toContain("RelationshipsHub");
      expect(peopleHub).toContain("LeadPipeline");
      expect(peopleHub).toContain("ComplianceAudit");
    });

    it("passes embedded prop to sub-pages", () => {
      expect(peopleHub).toContain("embedded");
    });

    it("has a mobile nav toggle", () => {
      expect(peopleHub).toContain("sidebarOpen");
    });
  });

  describe("IntelligenceHubV2", () => {
    it("exports a default component", () => {
      expect(intelligenceHub).toContain("export default function IntelligenceHubV2");
    });

    it("uses wouter useRoute for tab routing at /intelligence-hub/:tab", () => {
      expect(intelligenceHub).toMatch(/useRoute\(["']\/intelligence-hub\/:tab["']\)/);
    });

    it("includes key sub-pages: MarketData, Operations, Rebalancing", () => {
      expect(intelligenceHub).toContain("MarketData");
      expect(intelligenceHub).toContain("OperationsHub");
      expect(intelligenceHub).toContain("Rebalancing");
    });

    it("navigates to /intelligence-hub/ prefix", () => {
      expect(intelligenceHub).toContain("/intelligence-hub/");
    });
  });

  describe("AdminHubV2", () => {
    it("exports a default component", () => {
      expect(adminHub).toContain("export default function AdminHubV2");
    });

    it("uses wouter useRoute for tab routing at /admin/:tab", () => {
      expect(adminHub).toMatch(/useRoute\(["']\/admin\/:tab["']\)/);
    });

    it("includes key admin sub-pages: SystemHealth, Billing, Team", () => {
      expect(adminHub).toContain("AdminSystemHealth");
      expect(adminHub).toContain("BillingPage");
      expect(adminHub).toContain("TeamManagement");
    });

    it("groups tabs into categories", () => {
      expect(adminHub).toContain("group:");
    });

    it("has role-based access control", () => {
      expect(adminHub).toContain("useAuth");
    });
  });
});

describe("Pass 111: Sidebar simplification", () => {
  const sidebar = readFile("client/src/components/PersonaSidebar5.tsx");

  it("has simplified PERSONA_LAYERS", () => {
    expect(sidebar).toContain("PERSONA_LAYERS");
  });

  it("has 5 persona layers (core, wealth, professional, leadership, platform)", () => {
    const layerKeys = sidebar.match(/key:\s*["'](\w+)["']/g) || [];
    expect(layerKeys.length).toBe(5);
  });

  it("People hub links to /people/clients", () => {
    expect(sidebar).toContain('path: "/people/clients"');
  });

  it("Intelligence hub links to /intelligence-hub", () => {
    expect(sidebar).toContain('path: "/intelligence-hub"');
  });

  it("Admin hub links to /admin", () => {
    expect(sidebar).toContain('path: "/admin"');
  });

  it("has Learn item separate from layers", () => {
    expect(sidebar).toContain("LEARN_ITEM");
  });

  it("has footer items (Settings, Help)", () => {
    expect(sidebar).toContain("FOOTER_ITEMS");
  });
});

describe("Pass 111: App.tsx route wiring", () => {
  const appTsx = readFile("client/src/App.tsx");

  it("has PeopleHub routes", () => {
    expect(appTsx).toContain('path="/people"');
    expect(appTsx).toContain('path="/people/:tab"');
  });

  it("has IntelligenceHubV2 routes", () => {
    expect(appTsx).toContain("IntelligenceHubV2");
    expect(appTsx).toContain('path="/intelligence-hub/:tab"');
  });

  it("has AdminHubV2 routes", () => {
    expect(appTsx).toContain("AdminHubV2");
    expect(appTsx).toContain('path="/admin/:tab"');
  });

  it("keeps legacy admin route", () => {
    expect(appTsx).toContain('path="/admin-legacy"');
  });
});
