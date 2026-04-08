/**
 * Unit tests for the EMBA Learning permission model (pure helpers).
 */
import { describe, it, expect } from "vitest";
import {
  canEditContent,
  canPublish,
  canSeedContent,
  canSeeContent,
  assertCanEdit,
  type ActingUser,
  type ContentRow,
} from "./permissions";

const asUser = (id: number, role: ActingUser["role"]): ActingUser => ({ id, role });

const row = (over: Partial<ContentRow> = {}): ContentRow => ({
  id: 1,
  createdBy: 10,
  visibility: "public",
  status: "published",
  ...over,
});

describe("learning/permissions", () => {
  describe("canEditContent", () => {
    it("admin can edit anything", () => {
      expect(canEditContent(asUser(1, "admin"), row())).toBe(true);
      expect(canEditContent(asUser(1, "admin"), row({ createdBy: 999, visibility: "private" }))).toBe(true);
    });
    it("owner can edit their own row", () => {
      expect(canEditContent(asUser(10, "user"), row({ createdBy: 10 }))).toBe(true);
    });
    it("advisor can edit team content", () => {
      expect(canEditContent(asUser(5, "advisor"), row({ createdBy: 20, visibility: "team" }))).toBe(true);
    });
    it("manager can edit team content", () => {
      expect(canEditContent(asUser(5, "manager"), row({ createdBy: 20, visibility: "team" }))).toBe(true);
    });
    it("user cannot edit others' rows", () => {
      expect(canEditContent(asUser(3, "user"), row({ createdBy: 10 }))).toBe(false);
    });
    it("advisor cannot edit others' private rows", () => {
      expect(canEditContent(asUser(5, "advisor"), row({ createdBy: 20, visibility: "private" }))).toBe(false);
    });
  });

  describe("canPublish", () => {
    it("requires advisor+", () => {
      expect(canPublish(asUser(1, "user"))).toBe(false);
      expect(canPublish(asUser(1, "advisor"))).toBe(true);
      expect(canPublish(asUser(1, "manager"))).toBe(true);
      expect(canPublish(asUser(1, "admin"))).toBe(true);
    });
  });

  describe("canSeedContent", () => {
    it("admin-only", () => {
      expect(canSeedContent(asUser(1, "admin"))).toBe(true);
      expect(canSeedContent(asUser(1, "advisor"))).toBe(false);
      expect(canSeedContent(asUser(1, "user"))).toBe(false);
    });
  });

  describe("canSeeContent", () => {
    it("public published: everyone", () => {
      expect(canSeeContent(null, row())).toBe(true);
      expect(canSeeContent(asUser(1, "user"), row())).toBe(true);
    });
    it("team published: authenticated only", () => {
      expect(canSeeContent(null, row({ visibility: "team" }))).toBe(false);
      expect(canSeeContent(asUser(1, "user"), row({ visibility: "team" }))).toBe(true);
    });
    it("private published: owner or admin", () => {
      expect(canSeeContent(asUser(10, "user"), row({ visibility: "private", createdBy: 10 }))).toBe(true);
      expect(canSeeContent(asUser(11, "user"), row({ visibility: "private", createdBy: 10 }))).toBe(false);
      expect(canSeeContent(asUser(99, "admin"), row({ visibility: "private", createdBy: 10 }))).toBe(true);
    });
    it("drafts: owner or admin only", () => {
      expect(canSeeContent(asUser(10, "user"), row({ status: "draft" }))).toBe(true);
      expect(canSeeContent(asUser(11, "user"), row({ status: "draft" }))).toBe(false);
      expect(canSeeContent(asUser(99, "admin"), row({ status: "draft" }))).toBe(true);
    });
  });

  describe("assertCanEdit", () => {
    it("throws FORBIDDEN for unauthorized", () => {
      expect(() => assertCanEdit(asUser(3, "user"), row({ createdBy: 10 }))).toThrow(/cannot edit/);
    });
    it("does not throw for admin", () => {
      expect(() => assertCanEdit(asUser(1, "admin"), row({ createdBy: 10 }))).not.toThrow();
    });
  });
});
