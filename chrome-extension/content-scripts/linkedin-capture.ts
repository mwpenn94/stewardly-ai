/**
 * LinkedIn Capture — Add "Add to Stewardly" button on LinkedIn profile pages
 * Captures: name, title, company, location, LinkedIn URL
 */

function injectCaptureButton() {
  // Only run on profile pages
  if (!window.location.pathname.startsWith("/in/")) return;

  // Don't inject twice
  if (document.getElementById("stewardly-capture-btn")) return;

  const nameEl = document.querySelector("h1.text-heading-xlarge");
  if (!nameEl) return;

  const btn = document.createElement("button");
  btn.id = "stewardly-capture-btn";
  btn.textContent = "+ Add to Stewardly";
  btn.style.cssText = "margin-left:8px;padding:4px 12px;background:#60a5fa;color:#000;border:none;border-radius:16px;font-size:12px;font-weight:500;cursor:pointer;";

  btn.addEventListener("click", () => {
    const name = nameEl.textContent?.trim() || "";
    const titleEl = document.querySelector(".text-body-medium");
    const title = titleEl?.textContent?.trim() || "";
    const locationEl = document.querySelector(".text-body-small.inline");
    const location = locationEl?.textContent?.trim() || "";
    const url = window.location.href;

    // Parse name
    const parts = name.split(" ");
    const firstName = parts[0] || "";
    const lastName = parts.slice(1).join(" ") || "";

    chrome.runtime.sendMessage({
      type: "API_CALL",
      endpoint: "leadPipeline.ingest",
      method: "POST",
      body: { firstName, lastName, title, linkedinUrl: url, city: location, source: "chrome_extension_linkedin" },
    }, (res) => {
      btn.textContent = res?.success ? "Added!" : "Error";
      btn.style.background = res?.success ? "#34d399" : "#f87171";
      setTimeout(() => { btn.textContent = "+ Add to Stewardly"; btn.style.background = "#60a5fa"; }, 2000);
    });
  });

  nameEl.parentElement?.appendChild(btn);
}

// Run on page load and navigation
injectCaptureButton();
const observer = new MutationObserver(() => injectCaptureButton());
observer.observe(document.body, { childList: true, subtree: true });
