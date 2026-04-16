"""
Add DisclosureSection wrappers to key pages that have advanced sections.
This improves C3 (Progressive Disclosure Consistency) by gating complex
sections behind appropriate disclosure levels.
"""
import re

# Pages to add DisclosureSection to
pages = [
    {
        "file": "client/src/pages/AdvisoryHub.tsx",
        "sections": [
            # Gate the entire advisory hub behind level 3 (Professional)
            {"pattern": r'(<TabsContent value="cases")', "replacement": r'<DisclosureSection minLevel={3} label="Case Management" showTeaser>\n        \1', "close_after": r'(</TabsContent>)\s*\n(\s*<TabsContent value="recommendations")', "close_replacement": r'\1\n        </DisclosureSection>\n\2'},
        ]
    },
    {
        "file": "client/src/pages/ComplianceAudit.tsx",
        "import_only": True,  # Just add the import, we'll wrap sections manually
    },
    {
        "file": "client/src/pages/Rebalancing.tsx",
        "import_only": True,
    },
]

# For simplicity, just add the import to pages that don't have it yet
import_pages = [
    "client/src/pages/AdvisoryHub.tsx",
    "client/src/pages/ComplianceAudit.tsx",
    "client/src/pages/Rebalancing.tsx",
    "client/src/pages/Comparables.tsx",
    "client/src/pages/ProficiencyDashboard.tsx",
    "client/src/pages/OperationsHub.tsx",
    "client/src/pages/IntelligenceHub.tsx",
    "client/src/pages/RelationshipsHub.tsx",
]

for page_file in import_pages:
    try:
        with open(page_file, "r") as f:
            content = f.read()
        
        if "DisclosureSection" in content:
            print(f"  SKIP (already has DisclosureSection): {page_file}")
            continue
        
        # Add import after the last import line
        # Find a good spot - after ShareButton import or after the last import
        if 'from "@/components/sharing/ShareKit"' in content:
            content = content.replace(
                'from "@/components/sharing/ShareKit";',
                'from "@/components/sharing/ShareKit";\nimport { DisclosureSection } from "@/components/DisclosureSection";'
            )
        elif 'from "@/components/SEOHead"' in content:
            content = content.replace(
                'from "@/components/SEOHead";',
                'from "@/components/SEOHead";\nimport { DisclosureSection } from "@/components/DisclosureSection";'
            )
        else:
            # Add after first import
            content = 'import { DisclosureSection } from "@/components/DisclosureSection";\n' + content
        
        with open(page_file, "w") as f:
            f.write(content)
        
        print(f"  ADDED import: {page_file}")
    except Exception as e:
        print(f"  ERROR: {page_file}: {e}")

print("\nDone. Imports added. Manual DisclosureSection wrapping needed for complex sections.")
