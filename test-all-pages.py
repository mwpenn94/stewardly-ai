"""Systematically navigate every major page and capture console errors."""
from playwright.sync_api import sync_playwright
import json, time

BASE = "http://localhost:3000"

PAGES = [
    ("/", "Home/Chat"),
    ("/calculators", "Wealth Engine"),
    ("/my-financial-twin", "Financial Twin"),
    ("/insights", "Insights"),
    ("/settings", "Settings"),
    ("/integrations", "Integrations"),
    ("/learning", "Learning Home"),
    ("/learning/study-buddy", "Study Buddy"),
    ("/learning/flashcard-study", "Flashcard Study"),
    ("/learning/exam-simulator", "Exam Simulator"),
    ("/marketing-assets", "Marketing Assets"),
    ("/data-pipelines", "Data Pipelines"),
    ("/outreach-automation", "Outreach Automation"),
    ("/documents", "Documents"),
    ("/admin/audit-trail", "Admin Audit Trail"),
]

errors = []

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    
    # Capture console errors
    page_errors = []
    def on_console(msg):
        if msg.type == "error":
            text = msg.text
            # Ignore known benign errors
            if "websocket" in text.lower() or "vite" in text.lower() or "hmr" in text.lower():
                return
            page_errors.append(text)
    
    def on_pageerror(error):
        page_errors.append(f"PAGE_ERROR: {error.message}")
    
    page.on("console", on_console)
    page.on("pageerror", on_pageerror)
    
    for path, name in PAGES:
        page_errors.clear()
        url = BASE + path
        print(f"\n{'='*60}")
        print(f"Testing: {name} ({url})")
        print(f"{'='*60}")
        
        try:
            page.goto(url, wait_until="networkidle", timeout=15000)
            time.sleep(2)  # Wait for React to render
            
            # Check for error boundary fallback text
            content = page.content()
            has_error_boundary = "Something went wrong" in content or "error-boundary" in content.lower()
            
            # Check for blank/empty main content
            body_text = page.inner_text("body")
            is_mostly_empty = len(body_text.strip()) < 50
            
            screenshot_path = f"/home/ubuntu/screenshots/page-{name.replace(' ', '-').replace('/', '-').lower()}.png"
            page.screenshot(path=screenshot_path)
            
            if page_errors:
                print(f"  ❌ ERRORS FOUND:")
                for e in page_errors:
                    print(f"     {e[:200]}")
                errors.append({"page": name, "path": path, "errors": list(page_errors), "type": "console_error"})
            elif has_error_boundary:
                print(f"  ❌ ERROR BOUNDARY TRIGGERED")
                errors.append({"page": name, "path": path, "errors": ["Error boundary fallback rendered"], "type": "error_boundary"})
            elif is_mostly_empty:
                print(f"  ⚠️  PAGE APPEARS EMPTY (body text < 50 chars)")
                errors.append({"page": name, "path": path, "errors": ["Page appears empty"], "type": "empty_page"})
            else:
                print(f"  ✅ OK")
                
        except Exception as ex:
            print(f"  ❌ NAVIGATION ERROR: {ex}")
            errors.append({"page": name, "path": path, "errors": [str(ex)], "type": "nav_error"})
    
    # Now test Wealth Engine panels specifically
    print(f"\n{'='*60}")
    print(f"Testing Wealth Engine Panels")
    print(f"{'='*60}")
    
    page.goto(BASE + "/calculators", wait_until="networkidle", timeout=15000)
    time.sleep(2)
    
    # Find all nav items in the sidebar
    nav_buttons = page.locator('[data-panel-id], [role="button"]').all()
    print(f"  Found {len(nav_buttons)} clickable elements")
    
    # Try clicking each sidebar nav item
    sidebar_items = page.locator('nav button, nav a, [class*="sidebar"] button').all()
    print(f"  Found {len(sidebar_items)} sidebar items")
    
    for i, item in enumerate(sidebar_items[:30]):  # Limit to first 30
        page_errors.clear()
        try:
            text = item.inner_text(timeout=2000)
            if not text.strip():
                continue
            item.click(timeout=3000)
            time.sleep(1)
            
            content = page.content()
            has_error = "Something went wrong" in content
            
            if page_errors or has_error:
                err_detail = page_errors if page_errors else ["Error boundary triggered"]
                print(f"  ❌ Panel '{text.strip()[:40]}': {err_detail[0][:100]}")
                errors.append({"page": f"Calculator Panel: {text.strip()[:40]}", "path": "/calculators", "errors": list(err_detail), "type": "panel_error"})
            else:
                print(f"  ✅ Panel '{text.strip()[:40]}' OK")
        except Exception as ex:
            pass  # Skip non-clickable elements
    
    browser.close()

print(f"\n{'='*60}")
print(f"SUMMARY")
print(f"{'='*60}")
print(f"Total errors found: {len(errors)}")
for e in errors:
    print(f"  ❌ {e['page']}: {e['errors'][0][:100]}")

# Write results to file
with open("/home/ubuntu/wealthbridge-ai/page-test-results.json", "w") as f:
    json.dump(errors, f, indent=2)

print(f"\nResults written to page-test-results.json")
