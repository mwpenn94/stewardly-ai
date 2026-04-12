import { describe, it, expect } from "vitest";
import {
  detectBrowserFamily,
  computeSttCapabilities,
  canUseAnySstMode,
} from "./sttSupport";

/* Real-world UA strings pulled from Mozilla's UA list. */
const UA = {
  chromeDesktop:
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  chromeAndroid:
    "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
  firefoxDesktop:
    "Mozilla/5.0 (X11; Linux x86_64; rv:122.0) Gecko/20100101 Firefox/122.0",
  firefoxAndroid:
    "Mozilla/5.0 (Android 13; Mobile; rv:122.0) Gecko/122.0 Firefox/122.0",
  firefoxIOS:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/122.0 Mobile/15E148 Safari/605.1.15",
  safariDesktop:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
  safariIPhone:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1",
  safariIPad:
    // iPadOS 13+ masquerades as Macintosh; we rely on maxTouchPoints to disambiguate.
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
  edgeDesktop:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0",
  unknown: "SomeCrawler/1.0 (+https://example.com)",
};

describe("detectBrowserFamily", () => {
  it("recognises Chrome desktop", () => {
    expect(detectBrowserFamily({ userAgent: UA.chromeDesktop })).toBe("chrome");
  });

  it("recognises Chrome Android", () => {
    expect(detectBrowserFamily({ userAgent: UA.chromeAndroid })).toBe("chrome");
  });

  it("recognises Firefox desktop", () => {
    expect(detectBrowserFamily({ userAgent: UA.firefoxDesktop })).toBe("firefox");
  });

  it("recognises Firefox Android", () => {
    expect(detectBrowserFamily({ userAgent: UA.firefoxAndroid })).toBe("firefox");
  });

  it("recognises Firefox iOS as firefox (it's WebKit but still lacks SR)", () => {
    // FxiOS ships with webkit and no SpeechRecognition access in normal mode;
    // the string contains 'safari' AND 'fxios'. Our detector should pick
    // firefox first because it matches 'fxios'.
    expect(detectBrowserFamily({ userAgent: UA.firefoxIOS })).toBe("firefox");
  });

  it("recognises Safari desktop", () => {
    expect(detectBrowserFamily({ userAgent: UA.safariDesktop, maxTouchPoints: 0 })).toBe(
      "safari_desktop",
    );
  });

  it("recognises iPhone Safari", () => {
    expect(detectBrowserFamily({ userAgent: UA.safariIPhone })).toBe("safari_ios");
  });

  it("recognises iPadOS Safari via maxTouchPoints disambiguation", () => {
    expect(
      detectBrowserFamily({ userAgent: UA.safariIPad, maxTouchPoints: 5 }),
    ).toBe("safari_ios");
  });

  it("recognises desktop mac safari WITHOUT touch", () => {
    expect(
      detectBrowserFamily({ userAgent: UA.safariIPad, maxTouchPoints: 0 }),
    ).toBe("safari_desktop");
  });

  it("recognises Edge", () => {
    expect(detectBrowserFamily({ userAgent: UA.edgeDesktop })).toBe("edge");
  });

  it("returns unknown for an unrecognised UA", () => {
    expect(detectBrowserFamily({ userAgent: UA.unknown })).toBe("unknown");
  });

  it("returns unknown for an empty UA", () => {
    expect(detectBrowserFamily({})).toBe("unknown");
  });
});

describe("computeSttCapabilities", () => {
  it("reports unsupported when SpeechRecognition constructor is missing", () => {
    const caps = computeSttCapabilities({}, { userAgent: UA.firefoxDesktop });
    expect(caps.mode).toBe("unsupported");
    expect(caps.hasConstructor).toBe(false);
    expect(caps.supportsContinuous).toBe(false);
    expect(caps.supportsInterim).toBe(false);
    expect(caps.userMessage).toMatch(/Firefox/);
    expect(caps.recoveryHint).toMatch(/Chrome|Edge|Safari/);
  });

  it("reports unsupported for Firefox even if constructor exists (would never happen in reality, but defensive)", () => {
    const caps = computeSttCapabilities({}, { userAgent: UA.firefoxAndroid });
    expect(caps.mode).toBe("unsupported");
  });

  it("reports generic unsupported message for non-Firefox missing constructor", () => {
    const caps = computeSttCapabilities({}, { userAgent: UA.unknown });
    expect(caps.mode).toBe("unsupported");
    expect(caps.userMessage).toMatch(/doesn't support/);
    expect(caps.userMessage).not.toMatch(/Firefox/);
  });

  it("reports ptt_only for Safari iOS with webkit constructor", () => {
    const caps = computeSttCapabilities(
      { webkitSpeechRecognition: function FakeSR() {} },
      { userAgent: UA.safariIPhone },
    );
    expect(caps.mode).toBe("ptt_only");
    expect(caps.browserFamily).toBe("safari_ios");
    expect(caps.supportsContinuous).toBe(false);
    expect(caps.userMessage).toMatch(/iOS Safari/i);
    expect(caps.recoveryHint).toMatch(/Hold the mic/i);
  });

  it("reports ptt_only for Safari desktop (conservative — ≤17.4 is flaky)", () => {
    const caps = computeSttCapabilities(
      { webkitSpeechRecognition: function FakeSR() {} },
      { userAgent: UA.safariDesktop, maxTouchPoints: 0 },
    );
    expect(caps.mode).toBe("ptt_only");
    expect(caps.browserFamily).toBe("safari_desktop");
    expect(caps.supportsContinuous).toBe(false);
    // Desktop Safari ≥17 does surface interim via the prefixed API:
    expect(caps.supportsInterim).toBe(true);
  });

  it("reports full support for Chrome with the prefixed constructor", () => {
    const caps = computeSttCapabilities(
      { webkitSpeechRecognition: function FakeSR() {} },
      { userAgent: UA.chromeDesktop },
    );
    expect(caps.mode).toBe("full");
    expect(caps.supportsContinuous).toBe(true);
    expect(caps.supportsInterim).toBe(true);
    expect(caps.userMessage).toMatch(/Hands-free/i);
  });

  it("reports full support for Edge", () => {
    const caps = computeSttCapabilities(
      { webkitSpeechRecognition: function FakeSR() {} },
      { userAgent: UA.edgeDesktop },
    );
    expect(caps.mode).toBe("full");
    expect(caps.browserFamily).toBe("edge");
  });

  it("prefers SpeechRecognition over webkitSpeechRecognition when both exist", () => {
    const caps = computeSttCapabilities(
      {
        SpeechRecognition: function FakeSR() {},
        webkitSpeechRecognition: function FakeSR() {},
      },
      { userAgent: UA.chromeDesktop },
    );
    expect(caps.mode).toBe("full");
    expect(caps.hasConstructor).toBe(true);
  });

  it("defaults unknown browsers with a constructor to ptt_only (conservative)", () => {
    const caps = computeSttCapabilities(
      { SpeechRecognition: function FakeSR() {} },
      { userAgent: UA.unknown },
    );
    expect(caps.mode).toBe("ptt_only");
    expect(caps.browserFamily).toBe("unknown");
    expect(caps.recoveryHint).toMatch(/isn't confirmed|not confirmed/i);
  });
});

describe("canUseAnySstMode", () => {
  it("returns false only for unsupported mode", () => {
    expect(
      canUseAnySstMode({
        mode: "unsupported",
        hasConstructor: false,
        supportsContinuous: false,
        supportsInterim: false,
        browserFamily: "firefox",
        userMessage: "",
        recoveryHint: "",
      }),
    ).toBe(false);

    expect(
      canUseAnySstMode({
        mode: "ptt_only",
        hasConstructor: true,
        supportsContinuous: false,
        supportsInterim: false,
        browserFamily: "safari_ios",
        userMessage: "",
        recoveryHint: "",
      }),
    ).toBe(true);

    expect(
      canUseAnySstMode({
        mode: "full",
        hasConstructor: true,
        supportsContinuous: true,
        supportsInterim: true,
        browserFamily: "chrome",
        userMessage: "",
        recoveryHint: "",
      }),
    ).toBe(true);
  });
});
