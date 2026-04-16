"""
Add ShareButton to high-value pages that are missing it.
Each page gets a ShareButton in its header area.
"""
import re

# Pages to add ShareButton to, with their content type and ID
pages = [
    {
        "file": "client/src/pages/WealthEngine.tsx",
        "contentType": "wealth-engine",
        "contentId": "wealth-analysis",
        "title": "Wealth Analysis",
    },
    {
        "file": "client/src/pages/AdvisoryHub.tsx",
        "contentType": "advisory",
        "contentId": "advisory-hub",
        "title": "Advisory Report",
    },
    {
        "file": "client/src/pages/OperationsHub.tsx",
        "contentType": "operations",
        "contentId": "operations-report",
        "title": "Operations Report",
    },
    {
        "file": "client/src/pages/IntelligenceHub.tsx",
        "contentType": "intelligence",
        "contentId": "intelligence-report",
        "title": "Intelligence Report",
    },
    {
        "file": "client/src/pages/ComplianceAudit.tsx",
        "contentType": "compliance",
        "contentId": "compliance-audit",
        "title": "Compliance Audit",
    },
    {
        "file": "client/src/pages/Rebalancing.tsx",
        "contentType": "rebalancing",
        "contentId": "rebalancing-plan",
        "title": "Rebalancing Plan",
    },
    {
        "file": "client/src/pages/Comparables.tsx",
        "contentType": "comparables",
        "contentId": "comparables-analysis",
        "title": "Comparables Analysis",
    },
    {
        "file": "client/src/pages/ProficiencyDashboard.tsx",
        "contentType": "proficiency",
        "contentId": "proficiency-report",
        "title": "Proficiency Report",
    },
    {
        "file": "client/src/pages/RelationshipsHub.tsx",
        "contentType": "relationships",
        "contentId": "relationships-report",
        "title": "Relationships Report",
    },
]

for page in pages:
    try:
        with open(page["file"], "r") as f:
            content = f.read()
        
        # Skip if already has ShareButton
        if "ShareButton" in content:
            print(f"  SKIP (already has ShareButton): {page['file']}")
            continue
        
        # Add import for ShareButton after the last import line
        # Find the last import statement
        lines = content.split("\n")
        last_import_idx = 0
        for i, line in enumerate(lines):
            if line.startswith("import ") or (line.startswith("  ") and "from " in line):
                last_import_idx = i
            elif line.strip().startswith("} from "):
                last_import_idx = i
        
        # Insert the import
        import_line = 'import { ShareButton } from "@/components/sharing/ShareKit";'
        lines.insert(last_import_idx + 1, import_line)
        
        # Now find a good place to add the ShareButton - look for the first header area
        # Common patterns: after <AppShell title=...> or after the first <h1>/<h2>
        # We'll add it as a small icon button in the header
        
        # Look for patterns like: <Button variant="ghost" or <ArrowLeft or the first </div> after a header
        # Strategy: find "AppShell" and add ShareButton after the SEOHead
        content_new = "\n".join(lines)
        
        # Find the pattern: <SEOHead ... /> and add ShareButton after the next closing tag
        seo_match = re.search(r'<SEOHead[^/]*/>', content_new)
        if seo_match:
            insert_pos = seo_match.end()
            share_jsx = f'\n      <div className="flex justify-end px-4 pt-2"><ShareButton contentType="{page["contentType"]}" contentId="{page["contentId"]}" contentTitle="{page["title"]}" variant="ghost" size="sm" /></div>'
            content_new = content_new[:insert_pos] + share_jsx + content_new[insert_pos:]
        else:
            # Fallback: add after the first opening div inside return
            print(f"  WARN: No SEOHead found in {page['file']}, skipping ShareButton placement")
            # Still write the import
            content_new = "\n".join(lines)
        
        with open(page["file"], "w") as f:
            f.write(content_new)
        
        print(f"  ADDED: {page['file']}")
    except Exception as e:
        print(f"  ERROR: {page['file']}: {e}")
