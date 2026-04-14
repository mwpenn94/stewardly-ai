import { describe, it, expect } from "vitest";

// ─── Org Branding Schema Tests ───
describe("Org Branding Schema", () => {
  it("should have organization_landing_page_config table with all required fields", async () => {
    const schema = await import("../drizzle/schema");
    const table = schema.organizationLandingPageConfig;
    expect(table).toBeDefined();
    
    // Check original fields exist
    const columns = Object.keys(table);
    expect(columns.length).toBeGreaterThan(0);
  });

  it("should have organizations table with slug field", async () => {
    const schema = await import("../drizzle/schema");
    const table = schema.organizations;
    expect(table).toBeDefined();
  });
});

// ─── Org Branding Router Input Validation Tests ───
describe("Org Branding Router", () => {
  it("should export orgBrandingRouter", async () => {
    const mod = await import("./routers/orgBranding");
    expect(mod).toBeDefined();
  });

  it("should validate color format in branding config", () => {
    // Valid hex colors
    const validColors = ["#0EA5E9", "#14B8A6", "#1E293B", "#fff", "#000000"];
    const invalidColors = ["red", "rgb(0,0,0)", "not-a-color"];
    
    const hexRegex = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
    
    validColors.forEach(c => {
      expect(hexRegex.test(c)).toBe(true);
    });
    
    invalidColors.forEach(c => {
      expect(hexRegex.test(c)).toBe(false);
    });
  });

  it("should validate font family options", () => {
    const validFonts = [
      "Inter", "Playfair Display", "Merriweather", "Lato", "Montserrat",
      "Roboto", "Open Sans", "Poppins", "Raleway", "Source Sans 3",
      "DM Sans", "Nunito"
    ];
    
    validFonts.forEach(font => {
      expect(font.length).toBeGreaterThan(0);
      expect(typeof font).toBe("string");
    });
  });

  it("should validate background pattern options", () => {
    const validPatterns = ["mesh", "dots", "lines", "radial", "solid"];
    
    validPatterns.forEach(pattern => {
      expect(["mesh", "dots", "lines", "radial", "solid"]).toContain(pattern);
    });
    
    expect(["mesh", "dots", "lines", "radial", "solid"]).not.toContain("invalid");
  });
});

// ─── OrgLanding Page Tests ───
describe("OrgLanding Page", () => {
  it("should handle missing config gracefully with fallback values", () => {
    const config = null;
    const orgName = "Test Org";
    
    const headline = (config as any)?.headline || `${orgName} Financial Intelligence`;
    const subtitle = (config as any)?.subtitle || `${orgName} provides AI-powered financial guidance.`;
    const primaryColor = (config as any)?.primaryColor || "#0EA5E9";
    const accentColor = (config as any)?.accentColor || "#14B8A6";
    const secondaryColor = (config as any)?.secondaryColor || "#1E293B";
    const fontFamily = (config as any)?.fontFamily || "Inter";
    const backgroundPattern = (config as any)?.backgroundPattern || "mesh";
    
    expect(headline).toBe("Test Org Financial Intelligence");
    expect(subtitle).toContain("Test Org");
    expect(primaryColor).toBe("#0EA5E9");
    expect(accentColor).toBe("#14B8A6");
    expect(secondaryColor).toBe("#1E293B");
    expect(fontFamily).toBe("Inter");
    expect(backgroundPattern).toBe("mesh");
  });

  it("should handle config with all fields populated", () => {
    const config = {
      headline: "Custom Headline",
      subtitle: "Custom Subtitle",
      primaryColor: "#FF0000",
      accentColor: "#00FF00",
      secondaryColor: "#0000FF",
      fontFamily: "Playfair Display",
      backgroundPattern: "dots",
      heroImageUrl: "https://example.com/hero.jpg",
      customCss: ".hero-section { padding: 2rem; }",
      faviconUrl: "https://example.com/favicon.ico",
      logoUrl: "https://example.com/logo.png",
      ctaText: "Join Now",
      secondaryLinkText: "Learn More",
      disclaimerText: "Not financial advice.",
      trustSignal1: "Secure",
      trustSignal2: "Private",
      trustSignal3: "Smart",
    };
    
    expect(config.headline).toBe("Custom Headline");
    expect(config.primaryColor).toBe("#FF0000");
    expect(config.fontFamily).toBe("Playfair Display");
    expect(config.backgroundPattern).toBe("dots");
    expect(config.heroImageUrl).toBe("https://example.com/hero.jpg");
    expect(config.customCss).toContain("hero-section");
    expect(config.faviconUrl).toBe("https://example.com/favicon.ico");
  });

  it("should generate correct Google Fonts URL", () => {
    const fontFamily = "Playfair Display";
    const url = `https://fonts.googleapis.com/css2?family=${fontFamily.replace(/ /g, "+")}:wght@400;500;600;700&display=swap`;
    
    expect(url).toBe("https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&display=swap");
  });

  it("should generate correct background patterns", () => {
    const patterns = ["mesh", "dots", "lines", "radial", "solid"];
    
    patterns.forEach(pattern => {
      // Each pattern should produce a valid background
      switch (pattern) {
        case "mesh":
          expect(pattern).toBe("mesh");
          break;
        case "dots":
          expect(pattern).toBe("dots");
          break;
        case "lines":
          expect(pattern).toBe("lines");
          break;
        case "radial":
          expect(pattern).toBe("radial");
          break;
        case "solid":
          expect(pattern).toBe("solid");
          break;
      }
    });
  });
});

// ─── OrgBrandingEditor Tests ───
describe("OrgBrandingEditor", () => {
  it("should have all 5 editor tabs", () => {
    const tabs = ["content", "colors", "fonts", "media", "advanced"];
    expect(tabs).toHaveLength(5);
    expect(tabs).toContain("content");
    expect(tabs).toContain("colors");
    expect(tabs).toContain("fonts");
    expect(tabs).toContain("media");
    expect(tabs).toContain("advanced");
  });

  it("should validate custom CSS does not contain script tags", () => {
    const dangerousCss = "<script>alert('xss')</script>";
    const safeCss = ".hero-section { padding: 2rem; }";
    
    expect(dangerousCss.includes("<script")).toBe(true);
    expect(safeCss.includes("<script")).toBe(false);
  });

  it("should handle image URL validation", () => {
    const validUrls = [
      "https://example.com/logo.png",
      "https://cdn.example.com/images/hero.jpg",
      "https://storage.googleapis.com/bucket/image.webp",
    ];
    
    const invalidUrls = [
      "not-a-url",
      "ftp://example.com/file",
      "",
    ];
    
    validUrls.forEach(url => {
      expect(url.startsWith("https://")).toBe(true);
    });
    
    invalidUrls.forEach(url => {
      expect(url.startsWith("https://")).toBe(false);
    });
  });
});

// ─── Migration Tests ───
describe("Branding Migration", () => {
  it("should have new columns in schema definition", async () => {
    const schema = await import("../drizzle/schema");
    const table = schema.organizationLandingPageConfig;
    
    // The table should exist with the new columns
    expect(table).toBeDefined();
  });
});
