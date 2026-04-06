/**
 * Gmail Compliance — Screen draft text for compliance issues
 * Shows green checkmark (clean) or amber warning with specific issues
 */

function injectComplianceChecker() {
  // Only run in Gmail compose
  const composeWindows = document.querySelectorAll("[role='dialog'] [contenteditable='true']");
  if (composeWindows.length === 0) return;

  composeWindows.forEach((editor) => {
    if ((editor as HTMLElement).dataset.stewardlyWired) return;
    (editor as HTMLElement).dataset.stewardlyWired = "true";

    // Add compliance indicator
    const indicator = document.createElement("div");
    indicator.id = "stewardly-compliance-indicator";
    indicator.style.cssText = "position:absolute;top:4px;right:4px;padding:2px 8px;border-radius:12px;font-size:10px;z-index:9999;";
    indicator.textContent = "Checking...";
    indicator.style.background = "#1e3a5f";
    indicator.style.color = "#60a5fa";
    editor.parentElement?.style.setProperty("position", "relative");
    editor.parentElement?.appendChild(indicator);

    // Debounced compliance check
    let timeout: ReturnType<typeof setTimeout>;
    editor.addEventListener("input", () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        const text = (editor as HTMLElement).innerText || "";
        if (text.length < 20) { indicator.textContent = ""; return; }

        chrome.runtime.sendMessage({
          type: "API_CALL",
          endpoint: "compliance.screenDraft",
          method: "POST",
          body: { text },
        }, (res) => {
          if (res?.success && res.data?.passed) {
            indicator.textContent = "Compliant";
            indicator.style.background = "#064e3b";
            indicator.style.color = "#34d399";
          } else {
            const issues = res?.data?.issues || ["Review needed"];
            indicator.textContent = `Warning: ${issues[0]}`;
            indicator.style.background = "#78350f";
            indicator.style.color = "#fbbf24";
          }
        });
      }, 1000);
    });
  });
}

// Poll for new compose windows
setInterval(injectComplianceChecker, 2000);
