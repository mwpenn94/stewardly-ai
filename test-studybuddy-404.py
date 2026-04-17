"""Capture the exact 404 resource on Study Buddy page."""
from playwright.sync_api import sync_playwright
import time

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    
    failed_requests = []
    def on_response(response):
        if response.status >= 400:
            print(f"  {response.status}: {response.url}")
            failed_requests.append({"status": response.status, "url": response.url})
    
    page.on("response", on_response)
    
    console_errors = []
    def on_console(msg):
        if msg.type == "error":
            console_errors.append(msg.text)
    page.on("console", on_console)
    
    def on_pageerror(error):
        console_errors.append(f"PAGE_ERROR: {error.message}")
    page.on("pageerror", on_pageerror)
    
    print("Navigating to Study Buddy...")
    page.goto("http://localhost:3000/learning/study-buddy", wait_until="networkidle", timeout=15000)
    time.sleep(3)
    
    print(f"\nFailed requests: {len(failed_requests)}")
    for r in failed_requests:
        print(f"  {r['status']}: {r['url']}")
    
    print(f"\nConsole errors: {len(console_errors)}")
    for e in console_errors:
        print(f"  {e[:200]}")
    
    page.screenshot(path="/home/ubuntu/screenshots/study-buddy-404.png")
    
    browser.close()
