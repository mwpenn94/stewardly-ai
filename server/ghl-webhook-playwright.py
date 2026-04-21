"""
GHL Webhook Registration via Playwright browser automation.

This script attempts to:
1. Navigate to GHL app
2. Check if we can access the settings/webhooks page
3. Register the webhook if possible

If login is required, it will report that and exit with instructions.
"""
import asyncio
import os
import sys
from playwright.async_api import async_playwright

GHL_LOCATION_ID = os.environ.get("GHL_LOCATION_ID", "")
WEBHOOK_URL = "https://stewardly.manus.space/api/webhooks/ghl"
EVENTS = [
    "ContactCreate", "ContactUpdate", "ContactDelete",
    "OpportunityCreate", "OpportunityStatusUpdate",
]

async def main():
    print("=== GHL Webhook Registration (Playwright) ===")
    print(f"Location ID: {GHL_LOCATION_ID}")
    print(f"Webhook URL: {WEBHOOK_URL}")

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            viewport={"width": 1280, "height": 800},
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        )
        page = await context.new_page()

        # Try to navigate to GHL settings webhooks page
        settings_url = f"https://app.gohighlevel.com/v2/location/{GHL_LOCATION_ID}/settings/webhooks"
        print(f"\nNavigating to: {settings_url}")

        try:
            response = await page.goto(settings_url, wait_until="networkidle", timeout=30000)
            print(f"Response status: {response.status if response else 'None'}")
        except Exception as e:
            print(f"Navigation error: {e}")

        # Wait for page to settle
        await asyncio.sleep(3)

        # Take screenshot for debugging
        screenshot_path = "/home/ubuntu/wealthbridge-ai/ghl-webhook-screenshot.png"
        await page.screenshot(path=screenshot_path, full_page=False)
        print(f"Screenshot saved: {screenshot_path}")

        # Check current URL to see if we were redirected to login
        current_url = page.url
        print(f"Current URL: {current_url}")

        if "login" in current_url.lower() or "auth" in current_url.lower():
            print("\n⚠️  Login required. The GHL app requires authentication.")
            print("The user needs to:")
            print("1. Log into GHL at https://app.gohighlevel.com")
            print("2. Navigate to Settings → Webhooks")
            print(f"3. Add webhook URL: {WEBHOOK_URL}")
            print(f"4. Select events: {', '.join(EVENTS)}")
            await browser.close()
            return False

        # Check if we landed on the webhooks page
        page_content = await page.content()
        page_text = await page.inner_text("body") if await page.query_selector("body") else ""

        if "webhook" in page_text.lower():
            print("\n✅ Reached webhooks settings page!")

            # Look for "Add Webhook" or similar button
            add_btn = await page.query_selector('button:has-text("Add"), button:has-text("Create"), button:has-text("New")')
            if add_btn:
                print("Found 'Add' button, clicking...")
                await add_btn.click()
                await asyncio.sleep(2)

                # Look for URL input field
                url_input = await page.query_selector('input[placeholder*="url" i], input[placeholder*="webhook" i], input[type="url"]')
                if url_input:
                    await url_input.fill(WEBHOOK_URL)
                    print(f"Filled webhook URL: {WEBHOOK_URL}")

                    # Take another screenshot
                    await page.screenshot(path=screenshot_path.replace(".png", "-filled.png"))

                    # Look for save button
                    save_btn = await page.query_selector('button:has-text("Save"), button:has-text("Create"), button:has-text("Submit")')
                    if save_btn:
                        print("Found Save button — NOT clicking (requires user confirmation)")
                        print("The form is filled and ready for the user to review and submit.")
                else:
                    print("Could not find URL input field")
            else:
                print("Could not find 'Add Webhook' button")
                # Check if webhook already exists
                if WEBHOOK_URL in page_text or "stewardly" in page_text.lower():
                    print("✅ Webhook may already be registered!")
        else:
            print(f"\nPage content preview: {page_text[:500]}")
            print("\n⚠️  Could not reach webhooks settings page.")

        await page.screenshot(path=screenshot_path.replace(".png", "-final.png"))
        await browser.close()

        # If we couldn't register via UI, provide manual instructions
        print("\n" + "=" * 60)
        print("MANUAL REGISTRATION INSTRUCTIONS:")
        print("=" * 60)
        print(f"1. Log into GHL: https://app.gohighlevel.com")
        print(f"2. Go to Settings → Webhooks")
        print(f"   Direct URL: {settings_url}")
        print(f"3. Click 'Add Webhook'")
        print(f"4. Webhook URL: {WEBHOOK_URL}")
        print(f"5. Events: {', '.join(EVENTS)}")
        print(f"6. Click Save")
        return False

asyncio.run(main())
