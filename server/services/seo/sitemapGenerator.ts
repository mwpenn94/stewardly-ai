/**
 * SEO Sitemap Generator — Dynamic XML sitemap at /sitemap.xml
 */

export function generateSitemap(baseUrl: string): string {
  const routes = [
    { path: "/", priority: "1.0", changefreq: "daily" },
    { path: "/financial-protection-score", priority: "0.9", changefreq: "weekly" },
    { path: "/learn/glossary", priority: "0.8", changefreq: "weekly" },
    { path: "/calculators", priority: "0.8", changefreq: "weekly" },
    { path: "/calculators/retirement", priority: "0.7", changefreq: "monthly" },
    { path: "/calculators/tax", priority: "0.7", changefreq: "monthly" },
    { path: "/calculators/estate", priority: "0.7", changefreq: "monthly" },
    { path: "/calculators/insurance", priority: "0.7", changefreq: "monthly" },
    { path: "/calculators/education", priority: "0.7", changefreq: "monthly" },
    { path: "/calculators/premium-finance", priority: "0.7", changefreq: "monthly" },
    { path: "/about", priority: "0.5", changefreq: "monthly" },
    { path: "/privacy", priority: "0.3", changefreq: "yearly" },
    { path: "/terms", priority: "0.3", changefreq: "yearly" },
  ];

  const urls = routes.map(r => `  <url>
    <loc>${baseUrl}${r.path}</loc>
    <priority>${r.priority}</priority>
    <changefreq>${r.changefreq}</changefreq>
    <lastmod>${new Date().toISOString().split("T")[0]}</lastmod>
  </url>`).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;
}
