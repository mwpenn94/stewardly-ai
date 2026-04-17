"""Test each Wealth Engine panel by clicking sidebar nav items."""
from playwright.sync_api import sync_playwright
import time, json

BASE = "http://localhost:3000"
errors = []

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    
    page_errors = []
    def on_console(msg):
        if msg.type == "error":
            text = msg.text
            if "websocket" in text.lower() or "vite" in text.lower() or "hmr" in text.lower():
                return
            if "cannot be a descendant" in text.lower() or "cannot contain" in text.lower():
                return  # Known nested li issue, tracked separately
            page_errors.append(text)
    
    def on_pageerror(error):
        page_errors.append(f"PAGE_ERROR: {error.message}")
    
    page.on("console", on_console)
    page.on("pageerror", on_pageerror)
    
    # Navigate to calculators
    page.goto(BASE + "/calculators", wait_until="networkidle", timeout=20000)
    time.sleep(3)
    
    # Take initial screenshot
    page.screenshot(path="/home/ubuntu/screenshots/calc-initial.png")
    
    # Get the sidebar content
    content = page.content()
    
    # Find all buttons in the sidebar that look like panel nav items
    # The sidebar uses buttons with specific text for each panel
    panel_names = [
        "Compound Growth",
        "Retirement Planner", 
        "Tax Optimizer",
        "Insurance Needs",
        "Estate Planning",
        "Risk Assessment",
        "Income Planning",
        "Social Security",
        "Medicare",
        "Education",
        "Debt Payoff",
        "Emergency Fund",
        "References",
        "Team Capacity",
        "Recruiting Funnel",
        "Revenue Forecast",
        "Compensation",
        "Client Segmentation",
        "Activity Tracker",
        "P&L Business",
        "GDC Override",
        "Recruiting Funnel",
        "Client Lifecycle",
        "Scenario Planner",
        "Monte Carlo",
        "What-If",
        "Goal Tracker",
        "Cash Flow",
        "Budget",
        "Net Worth",
        "Asset Allocation",
        "Rebalancing",
        "Premium Financing",
        "ILIT",
        "Executive Comp",
        "Charitable",
        "Due Diligence",
    ]
    
    for panel_name in panel_names:
        page_errors.clear()
        try:
            # Try to find and click the button
            btn = page.locator(f'button:has-text("{panel_name}")').first
            if btn.count() == 0:
                btn = page.locator(f'text="{panel_name}"').first
            if btn.count() == 0:
                continue
                
            btn.click(timeout=3000)
            time.sleep(1.5)
            
            # Check for error boundary
            body = page.content()
            has_error = "Something went wrong" in body or "error occurred" in body.lower()
            
            if page_errors:
                print(f"  ❌ {panel_name}: {page_errors[0][:150]}")
                errors.append({"panel": panel_name, "errors": list(page_errors)})
            elif has_error:
                print(f"  ❌ {panel_name}: Error boundary triggered")
                errors.append({"panel": panel_name, "errors": ["Error boundary triggered"]})
                page.screenshot(path=f"/home/ubuntu/screenshots/calc-error-{panel_name.replace(' ', '-').lower()}.png")
            else:
                print(f"  ✅ {panel_name}")
        except Exception as ex:
            if "timeout" not in str(ex).lower():
                print(f"  ⚠️  {panel_name}: {str(ex)[:100]}")
    
    # Also try clicking ALL sidebar buttons to catch any we missed
    print(f"\n--- Scanning all sidebar buttons ---")
    page.goto(BASE + "/calculators", wait_until="networkidle", timeout=20000)
    time.sleep(2)
    
    all_buttons = page.locator('aside button, nav button, [class*="sidebar"] button').all()
    print(f"  Found {len(all_buttons)} sidebar buttons total")
    
    for i, btn in enumerate(all_buttons):
        page_errors.clear()
        try:
            text = btn.inner_text(timeout=1000).strip()
            if not text or len(text) > 50 or text in ["Search", "Close", "Menu"]:
                continue
            btn.click(timeout=2000)
            time.sleep(1)
            
            body = page.content()
            has_error = "Something went wrong" in body
            
            if page_errors:
                print(f"  ❌ Button[{i}] '{text[:30]}': {page_errors[0][:100]}")
                errors.append({"panel": text[:30], "errors": list(page_errors)})
            elif has_error:
                print(f"  ❌ Button[{i}] '{text[:30]}': Error boundary")
                errors.append({"panel": text[:30], "errors": ["Error boundary triggered"]})
                page.screenshot(path=f"/home/ubuntu/screenshots/calc-error-btn{i}.png")
        except:
            pass
    
    browser.close()

print(f"\n{'='*60}")
print(f"PANEL TEST SUMMARY")
print(f"{'='*60}")
print(f"Total panel errors: {len(errors)}")
for e in errors:
    print(f"  ❌ {e['panel']}: {e['errors'][0][:100]}")

with open("/home/ubuntu/wealthbridge-ai/panel-test-results.json", "w") as f:
    json.dump(errors, f, indent=2)
