import { describe, expect, it } from "vitest";

/**
 * Tests for UI fix behaviors:
 * 1. GuestBanner should hide on /chat pages
 * 2. Tour wizard should handle missing targets gracefully
 * 3. Mobile welcome screen should hide guest CTA
 */

// Simulate the GuestBanner visibility logic
function shouldShowGuestBanner(authTier: string | null, dismissed: boolean, location: string): boolean {
  if (!authTier || authTier !== "anonymous" || dismissed) return false;
  if (location.startsWith("/chat")) return false;
  return true;
}

// Simulate the tour step filtering logic
interface TourStep {
  target: string;
  optional?: boolean;
}

function filterEffectiveSteps(steps: TourStep[], existingTargets: Set<string>): TourStep[] {
  return steps.filter(step => {
    return existingTargets.has(step.target) || !step.optional;
  });
}

// Simulate the welcome screen guest CTA visibility (hidden on mobile via CSS class)
function getGuestCTAClasses(isGuest: boolean, greetingDone: boolean): string {
  if (!isGuest || !greetingDone) return "hidden";
  return "hidden sm:block"; // Hidden on mobile, visible on sm+
}

// Simulate the onboarding checklist visibility
function shouldShowChecklist(hasConversations: boolean, isGuest: boolean): boolean {
  return !hasConversations && !isGuest;
}

describe("GuestBanner Visibility", () => {
  it("hides for non-anonymous users", () => {
    expect(shouldShowGuestBanner("authenticated", false, "/")).toBe(false);
  });

  it("hides when dismissed", () => {
    expect(shouldShowGuestBanner("anonymous", true, "/")).toBe(false);
  });

  it("hides on /chat pages", () => {
    expect(shouldShowGuestBanner("anonymous", false, "/chat")).toBe(false);
    expect(shouldShowGuestBanner("anonymous", false, "/chat/123")).toBe(false);
  });

  it("shows on non-chat pages for anonymous users", () => {
    expect(shouldShowGuestBanner("anonymous", false, "/")).toBe(true);
    expect(shouldShowGuestBanner("anonymous", false, "/settings")).toBe(true);
    expect(shouldShowGuestBanner("anonymous", false, "/help")).toBe(true);
  });

  it("hides when no user", () => {
    expect(shouldShowGuestBanner(null, false, "/")).toBe(false);
  });
});

describe("Tour Step Filtering", () => {
  const allSteps: TourStep[] = [
    { target: "[data-tour='chat-input']" },
    { target: "[data-tour='focus-mode']" },
    { target: "[data-tour='voice-toggle']" },
    { target: "[data-tour='suggested-prompts']", optional: true },
    { target: "[data-tour='sidebar-nav']", optional: true },
  ];

  it("includes all steps when all targets exist", () => {
    const existing = new Set(allSteps.map(s => s.target));
    const result = filterEffectiveSteps(allSteps, existing);
    expect(result).toHaveLength(5);
  });

  it("skips optional steps when targets are missing", () => {
    const existing = new Set([
      "[data-tour='chat-input']",
      "[data-tour='focus-mode']",
      "[data-tour='voice-toggle']",
    ]);
    const result = filterEffectiveSteps(allSteps, existing);
    expect(result).toHaveLength(3);
    expect(result.every(s => !s.optional)).toBe(true);
  });

  it("keeps required steps even when targets are missing", () => {
    const existing = new Set<string>(); // No targets exist
    const result = filterEffectiveSteps(allSteps, existing);
    expect(result).toHaveLength(3); // 3 required steps
    expect(result.every(s => !s.optional)).toBe(true);
  });

  it("keeps optional steps when their targets exist", () => {
    const existing = new Set([
      "[data-tour='chat-input']",
      "[data-tour='focus-mode']",
      "[data-tour='voice-toggle']",
      "[data-tour='suggested-prompts']",
    ]);
    const result = filterEffectiveSteps(allSteps, existing);
    expect(result).toHaveLength(4);
  });
});

describe("Mobile Welcome Screen Guest CTA", () => {
  it("returns hidden sm:block for guest users when greeting is done", () => {
    expect(getGuestCTAClasses(true, true)).toBe("hidden sm:block");
  });

  it("returns hidden for non-guest users", () => {
    expect(getGuestCTAClasses(false, true)).toBe("hidden");
  });

  it("returns hidden when greeting is not done", () => {
    expect(getGuestCTAClasses(true, false)).toBe("hidden");
  });
});

describe("Onboarding Checklist Visibility", () => {
  it("shows for authenticated users with no conversations", () => {
    expect(shouldShowChecklist(false, false)).toBe(true);
  });

  it("hides for users with existing conversations", () => {
    expect(shouldShowChecklist(true, false)).toBe(false);
  });

  it("hides for guest users", () => {
    expect(shouldShowChecklist(false, true)).toBe(false);
  });

  it("hides for guest users with conversations", () => {
    expect(shouldShowChecklist(true, true)).toBe(false);
  });
});
