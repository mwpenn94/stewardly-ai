import { describe, it, expect } from "vitest";
import {
  AutomationTelemetryBus,
  getAutomationTelemetryBus,
  __resetAutomationTelemetryBus,
} from "./automationTelemetry";
import type { NavigationTelemetryEvent } from "./webNavigator";

const networkEvent: NavigationTelemetryEvent = {
  type: "request.network",
  url: "https://ex.com/",
  host: "ex.com",
  status: 200,
  bytes: 1024,
  fetchMs: 12,
  at: 1,
  revalidated: false,
};

const startEvent: NavigationTelemetryEvent = {
  type: "request.start",
  url: "https://ex.com/",
  host: "ex.com",
  at: 0,
};

describe("AutomationTelemetryBus", () => {
  it("delivers events to every subscriber", () => {
    const bus = new AutomationTelemetryBus();
    const seenA: string[] = [];
    const seenB: string[] = [];
    bus.subscribe((e) => seenA.push(e.type));
    bus.subscribe((e) => seenB.push(e.type));
    bus.publish(startEvent);
    bus.publish(networkEvent);
    expect(seenA).toEqual(["request.start", "request.network"]);
    expect(seenB).toEqual(["request.start", "request.network"]);
  });

  it("respects type filters", () => {
    const bus = new AutomationTelemetryBus();
    const seen: string[] = [];
    bus.subscribe((e) => seen.push(e.type), { types: ["request.network"] });
    bus.publish(startEvent);
    bus.publish(networkEvent);
    expect(seen).toEqual(["request.network"]);
  });

  it("unsubscribe stops further delivery", () => {
    const bus = new AutomationTelemetryBus();
    const seen: string[] = [];
    const sub = bus.subscribe((e) => seen.push(e.type));
    bus.publish(startEvent);
    sub.unsubscribe();
    bus.publish(networkEvent);
    expect(seen).toEqual(["request.start"]);
  });

  it("subscribeOnce auto-unsubscribes after the first event", () => {
    const bus = new AutomationTelemetryBus();
    const seen: string[] = [];
    bus.subscribeOnce((e) => seen.push(e.type));
    bus.publish(startEvent);
    bus.publish(networkEvent);
    expect(seen).toEqual(["request.start"]);
  });

  it("sink errors don't halt delivery or navigation", () => {
    const bus = new AutomationTelemetryBus();
    const seen: string[] = [];
    bus.subscribe(() => {
      throw new Error("bad sink");
    });
    bus.subscribe((e) => seen.push(e.type));
    bus.publish(startEvent);
    expect(seen).toEqual(["request.start"]);
    expect(bus.getStats().droppedSinkErrors).toBe(1);
  });

  it("async sink rejection counts as a dropped error", async () => {
    const bus = new AutomationTelemetryBus();
    bus.subscribe(async () => {
      throw new Error("async fail");
    });
    bus.publish(startEvent);
    await new Promise((r) => setTimeout(r, 0));
    expect(bus.getStats().droppedSinkErrors).toBe(1);
  });

  it("snapshot returns last N events in a ring buffer", () => {
    const bus = new AutomationTelemetryBus({ bufferSize: 3 });
    bus.publish(startEvent);
    bus.publish(networkEvent);
    bus.publish(startEvent);
    bus.publish(networkEvent);
    const all = bus.snapshot();
    expect(all).toHaveLength(3);
    expect(bus.snapshot(1)).toHaveLength(1);
    expect(bus.snapshot(2)).toHaveLength(2);
  });

  it("clear empties the buffer without dropping listeners", () => {
    const bus = new AutomationTelemetryBus();
    bus.subscribe(() => {});
    bus.publish(startEvent);
    bus.clear();
    expect(bus.snapshot()).toHaveLength(0);
    expect(bus.listenerCount()).toBe(1);
  });

  it("works as a NavigationTelemetrySink", () => {
    const bus = new AutomationTelemetryBus();
    const seen: string[] = [];
    bus.subscribe((e) => seen.push(e.type));
    // Use the NavigationTelemetrySink contract
    bus.onEvent(networkEvent);
    expect(seen).toEqual(["request.network"]);
  });

  it("global singleton is reusable across callers", () => {
    __resetAutomationTelemetryBus();
    const a = getAutomationTelemetryBus();
    const b = getAutomationTelemetryBus();
    expect(a).toBe(b);
    __resetAutomationTelemetryBus();
    const c = getAutomationTelemetryBus();
    expect(c).not.toBe(a);
  });
});
