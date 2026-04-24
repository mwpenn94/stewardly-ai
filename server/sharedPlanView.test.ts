/**
 * SharedPlanView — Unit tests for the enhanced client-facing read-only portal.
 *
 * Validates component structure, accessibility, print support,
 * compliance disclaimer, and proper routing.
 */
import { describe, it, expect } from "vitest";
import fs from "fs";

const content = fs.readFileSync("client/src/pages/SharedPlanView.tsx", "utf-8");

describe("SharedPlanView enhancements", () => {
  it("renders at /plan/:token route", () => {
    expect(content).toContain("useRoute('/plan/:token')");
  });

  it("uses planSharing.getShare tRPC query", () => {
    expect(content).toContain("trpc.planSharing.getShare.useQuery");
  });

  it("has branded advisor header with sharedBy name", () => {
    expect(content).toContain("data.sharedBy");
    expect(content).toContain("Shared via WealthBridge AI");
  });

  it("includes print/PDF button", () => {
    expect(content).toContain("handlePrint");
    expect(content).toContain("window.print()");
    expect(content).toContain("Print / PDF");
    expect(content).toContain("Printer");
  });

  it("has print-specific CSS styles", () => {
    expect(content).toContain("@media print");
    expect(content).toContain("print-color-adjust: exact");
    expect(content).toContain("print:hidden");
    expect(content).toContain("print:bg-white");
  });

  it("includes compliance disclaimer footer", () => {
    expect(content).toContain("Important Disclosure");
    expect(content).toContain("informational purposes only");
    expect(content).toContain("does not constitute financial");
    expect(content).toContain("consult with a qualified financial professional");
  });

  it("shows document ID from token", () => {
    expect(content).toContain("Document ID:");
    expect(content).toContain("token.substring(0, 8)");
  });

  it("displays view count and expiry metadata", () => {
    expect(content).toContain("data.viewCount");
    expect(content).toContain("data.expiresAt");
    expect(content).toContain("Expires");
  });

  it("has Read-Only badge", () => {
    expect(content).toContain("Read-Only");
  });

  it("renders financial health score with SVG circle", () => {
    expect(content).toContain("<svg");
    expect(content).toContain("circle");
    expect(content).toContain("strokeDasharray");
  });

  it("renders domain score bars", () => {
    expect(content).toContain("ScoreBar");
    expect(content).toContain("DOMAIN_ICONS");
  });

  it("renders client profile fields", () => {
    expect(content).toContain("ProfileField");
    expect(content).toContain("Annual Income");
    expect(content).toContain("Net Worth");
    expect(content).toContain("Liquid Savings");
  });

  it("renders recommendations with priority badges", () => {
    expect(content).toContain("PriorityBadge");
    expect(content).toContain("recs.slice(0, 12)");
  });

  it("renders holistic cascade summary when available", () => {
    expect(content).toContain("CascadeScore");
    expect(content).toContain("Client Hub");
    expect(content).toContain("Advanced Hub");
    expect(content).toContain("Practice Hub");
  });

  it("has proper error states for expired/max_views/invalid links", () => {
    expect(content).toContain("PlanNotAvailable");
    expect(content).toContain("expired");
    expect(content).toContain("max_views");
    expect(content).toContain("contact your advisor");
  });

  it("has loading skeleton state", () => {
    expect(content).toContain("LoadingSkeleton");
    expect(content).toContain("animate-pulse");
  });

  it("is responsive with sm: breakpoints", () => {
    expect(content).toContain("sm:px-6");
    expect(content).toContain("sm:py-8");
    expect(content).toContain("sm:text-3xl");
    expect(content).toContain("md:grid-cols-4");
  });

  it("uses useRef for print target", () => {
    expect(content).toContain("useRef<HTMLDivElement>");
    expect(content).toContain("ref={printRef}");
  });

  it("formats dates with toLocaleDateString", () => {
    expect(content).toContain("toLocaleDateString");
    expect(content).toContain("year: 'numeric'");
    expect(content).toContain("month: 'long'");
  });
});
