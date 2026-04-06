/**
 * Stewardly Extension — Background Service Worker
 * Manages auth token relay and API communication with stewardly.manus.space
 */

const BASE_URL = "https://stewardly.manus.space";

// Open side panel on extension icon click
chrome.sidePanel?.setPanelBehavior?.({ openPanelOnActionClick: true });

// Relay API calls from content scripts to Stewardly backend
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "API_CALL") {
    fetch(`${BASE_URL}/api/trpc/${message.endpoint}`, {
      method: message.method || "GET",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: message.body ? JSON.stringify(message.body) : undefined,
    })
      .then(res => res.json())
      .then(data => sendResponse({ success: true, data }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true; // Keep channel open for async response
  }
});
