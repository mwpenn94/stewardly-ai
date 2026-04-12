/**
 * Unit tests for the webhook signer + dispatch state machine.
 * Pass 12 of the hybrid build loop — PARITY-API-0002.
 */
import { describe, it, expect } from "vitest";
import {
  signWebhookBody,
  verifyWebhookSignature,
  parseSignatureHeader,
  buildSignatureHeader,
  backoffMs,
  initDispatchState,
  stepDispatchState,
  shouldRetry,
  isTerminal,
  isReadyNow,
  type WebhookEndpoint,
  type WebhookEvent,
} from "./webhooks";

const secret = "shhh-this-is-a-test-secret";
const body = `{"type":"rebalancing.drift.exceeded","data":{"sleeve":"VTI"}}`;
const ts = 1_755_960_000;

// ─── HMAC signing ────────────────────────────────────────────────────────

describe("api/v1/webhooks — signWebhookBody", () => {
  it("returns a deterministic hex signature", async () => {
    const s1 = await signWebhookBody(secret, body, ts);
    const s2 = await signWebhookBody(secret, body, ts);
    expect(s1).toBe(s2);
    expect(s1).toMatch(/^[0-9a-f]+$/);
  });

  it("differs when the body changes", async () => {
    const s1 = await signWebhookBody(secret, body, ts);
    const s2 = await signWebhookBody(secret, body + "x", ts);
    expect(s1).not.toBe(s2);
  });

  it("differs when the timestamp changes", async () => {
    const s1 = await signWebhookBody(secret, body, ts);
    const s2 = await signWebhookBody(secret, body, ts + 1);
    expect(s1).not.toBe(s2);
  });

  it("differs when the secret changes", async () => {
    const s1 = await signWebhookBody(secret, body, ts);
    const s2 = await signWebhookBody(secret + "x", body, ts);
    expect(s1).not.toBe(s2);
  });
});

// ─── Header parse + build ───────────────────────────────────────────────

describe("api/v1/webhooks — parseSignatureHeader", () => {
  it("parses a well-formed header", () => {
    const p = parseSignatureHeader("t=12345,v1=abc123");
    expect(p?.timestamp).toBe(12345);
    expect(p?.signature).toBe("abc123");
  });
  it("returns null for empty/malformed input", () => {
    expect(parseSignatureHeader("")).toBeNull();
    expect(parseSignatureHeader("garbage")).toBeNull();
    expect(parseSignatureHeader("t=,v1=")).toBeNull();
  });
  it("returns null for non-numeric timestamp", () => {
    expect(parseSignatureHeader("t=abc,v1=def")).toBeNull();
  });
});

describe("api/v1/webhooks — buildSignatureHeader", () => {
  it("formats as t=<n>,v1=<hex>", () => {
    expect(buildSignatureHeader("abc", 100)).toBe("t=100,v1=abc");
  });
});

// ─── verifyWebhookSignature ─────────────────────────────────────────────

describe("api/v1/webhooks — verifyWebhookSignature", () => {
  it("accepts a freshly-signed payload", async () => {
    const sig = await signWebhookBody(secret, body, ts);
    const header = buildSignatureHeader(sig, ts);
    const ok = await verifyWebhookSignature(secret, body, header, ts);
    expect(ok).toBe(true);
  });

  it("rejects a forged payload", async () => {
    const sig = await signWebhookBody(secret, body, ts);
    const header = buildSignatureHeader(sig, ts);
    const ok = await verifyWebhookSignature(secret, body + "!", header, ts);
    expect(ok).toBe(false);
  });

  it("rejects a signature older than maxSkewSec", async () => {
    const sig = await signWebhookBody(secret, body, ts);
    const header = buildSignatureHeader(sig, ts);
    // 10 minutes later with a 5 minute skew → reject
    const ok = await verifyWebhookSignature(secret, body, header, ts + 600, 300);
    expect(ok).toBe(false);
  });

  it("rejects a malformed signature header", async () => {
    const ok = await verifyWebhookSignature(secret, body, "garbage", ts);
    expect(ok).toBe(false);
  });

  it("rejects wrong secret", async () => {
    const sig = await signWebhookBody(secret, body, ts);
    const header = buildSignatureHeader(sig, ts);
    const ok = await verifyWebhookSignature(secret + "x", body, header, ts);
    expect(ok).toBe(false);
  });
});

// ─── backoffMs ──────────────────────────────────────────────────────────

describe("api/v1/webhooks — backoffMs", () => {
  it("returns 0 for attempt 0", () => {
    expect(backoffMs(0)).toBe(0);
  });

  it("grows exponentially on consecutive attempts", () => {
    const a1 = backoffMs(1, 0.5);
    const a2 = backoffMs(2, 0.5);
    const a3 = backoffMs(3, 0.5);
    expect(a2).toBeGreaterThan(a1);
    expect(a3).toBeGreaterThan(a2);
  });

  it("caps at 5 minutes", () => {
    for (let a = 1; a < 20; a++) {
      expect(backoffMs(a, 0.5)).toBeLessThanOrEqual(5 * 60 * 1000 + 100);
    }
  });

  it("applies ±10% deterministic jitter", () => {
    const low = backoffMs(3, 0.0);
    const high = backoffMs(3, 1.0);
    expect(low).not.toBe(high);
  });
});

// ─── shouldRetry ────────────────────────────────────────────────────────

describe("api/v1/webhooks — shouldRetry", () => {
  it("retries on transport error (no httpStatus)", () => {
    expect(shouldRetry(0, undefined)).toBe(true);
  });
  it("retries on 5xx", () => {
    expect(shouldRetry(2, 502)).toBe(true);
  });
  it("does NOT retry on 4xx", () => {
    expect(shouldRetry(0, 400)).toBe(false);
    expect(shouldRetry(0, 404)).toBe(false);
  });
  it("stops after MAX_ATTEMPTS", () => {
    expect(shouldRetry(5, 500)).toBe(false);
  });
});

// ─── Dispatch state machine ─────────────────────────────────────────────

const endpoint: WebhookEndpoint = {
  url: "https://example.com/hook",
  secret: "s",
};
const event: WebhookEvent = {
  id: "evt_1",
  type: "test.event",
  createdAt: "2026-04-12T00:00:00Z",
  data: { hello: "world" },
};

describe("api/v1/webhooks — state machine", () => {
  it("initDispatchState starts in pending", () => {
    const s = initDispatchState(event, endpoint);
    expect(s.status).toBe("pending");
    expect(s.attempts).toBe(0);
    expect(isTerminal(s)).toBe(false);
  });

  it("begin → in_flight and bumps attempts", () => {
    const s0 = initDispatchState(event, endpoint);
    const s1 = stepDispatchState(s0, { kind: "begin", nowMs: 1000 });
    expect(s1.status).toBe("in_flight");
    expect(s1.attempts).toBe(1);
  });

  it("http_success → delivered (terminal)", () => {
    const s0 = initDispatchState(event, endpoint);
    const s1 = stepDispatchState(s0, { kind: "begin", nowMs: 1000 });
    const s2 = stepDispatchState(s1, {
      kind: "http_success",
      nowMs: 2000,
      httpStatus: 200,
    });
    expect(s2.status).toBe("delivered");
    expect(s2.history[0].status).toBe("success");
    expect(isTerminal(s2)).toBe(true);
  });

  it("non-2xx success reroutes through http_error", () => {
    const s0 = initDispatchState(event, endpoint);
    const s1 = stepDispatchState(s0, { kind: "begin", nowMs: 1000 });
    const s2 = stepDispatchState(s1, {
      kind: "http_success",
      nowMs: 2000,
      httpStatus: 503,
    });
    expect(s2.status).toBe("failed_retry");
  });

  it("4xx http_error → abandoned (no retry)", () => {
    const s0 = initDispatchState(event, endpoint);
    const s1 = stepDispatchState(s0, { kind: "begin", nowMs: 1000 });
    const s2 = stepDispatchState(s1, {
      kind: "http_error",
      nowMs: 2000,
      httpStatus: 400,
    });
    expect(s2.status).toBe("abandoned");
    expect(isTerminal(s2)).toBe(true);
  });

  it("5xx http_error → failed_retry with nextAttemptAt set", () => {
    const s0 = initDispatchState(event, endpoint);
    const s1 = stepDispatchState(s0, { kind: "begin", nowMs: 1000 });
    const s2 = stepDispatchState(s1, {
      kind: "http_error",
      nowMs: 2000,
      httpStatus: 503,
    });
    expect(s2.status).toBe("failed_retry");
    expect(s2.nextAttemptAt).not.toBeNull();
  });

  it("transport_error → failed_retry", () => {
    const s0 = initDispatchState(event, endpoint);
    const s1 = stepDispatchState(s0, { kind: "begin", nowMs: 1000 });
    const s2 = stepDispatchState(s1, {
      kind: "transport_error",
      nowMs: 2000,
      errorMessage: "ECONNREFUSED",
    });
    expect(s2.status).toBe("failed_retry");
    expect(s2.lastError).toContain("ECONNREFUSED");
  });

  it("retries bail out after MAX_ATTEMPTS (5) consecutive failures", () => {
    let s = initDispatchState(event, endpoint);
    for (let i = 0; i < 5; i++) {
      s = stepDispatchState(s, { kind: "begin", nowMs: 1000 + i * 10000 });
      s = stepDispatchState(s, {
        kind: "http_error",
        nowMs: 2000 + i * 10000,
        httpStatus: 502,
      });
    }
    expect(s.status).toBe("abandoned");
    expect(s.attempts).toBe(5);
  });

  it("history cap of 10 entries", () => {
    let s = initDispatchState(event, endpoint);
    for (let i = 0; i < 15; i++) {
      s = stepDispatchState(s, { kind: "begin", nowMs: i * 1000 });
      s = stepDispatchState(s, {
        kind: "http_error",
        nowMs: i * 1000 + 500,
        httpStatus: 502,
      });
    }
    expect(s.history.length).toBeLessThanOrEqual(10);
  });

  it("isReadyNow: pending is always ready", () => {
    const s = initDispatchState(event, endpoint);
    expect(isReadyNow(s, 1000)).toBe(true);
  });

  it("isReadyNow: failed_retry ready only after nextAttemptAt", () => {
    const s0 = initDispatchState(event, endpoint);
    const s1 = stepDispatchState(s0, { kind: "begin", nowMs: 1000 });
    const s2 = stepDispatchState(s1, {
      kind: "http_error",
      nowMs: 2000,
      httpStatus: 502,
    });
    expect(isReadyNow(s2, 2000)).toBe(false); // still in backoff
    expect(isReadyNow(s2, 2000 + 24 * 60 * 60 * 1000)).toBe(true); // far in the future
  });

  it("ignores begin from a terminal state", () => {
    const s0 = initDispatchState(event, endpoint);
    const s1 = stepDispatchState(s0, { kind: "begin", nowMs: 1000 });
    const s2 = stepDispatchState(s1, {
      kind: "http_success",
      nowMs: 2000,
      httpStatus: 200,
    });
    const s3 = stepDispatchState(s2, { kind: "begin", nowMs: 3000 });
    expect(s3).toBe(s2); // unchanged
  });
});
