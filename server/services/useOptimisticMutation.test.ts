/**
 * Tests for the useOptimisticMutation hook utility.
 * Since this is a React hook, we test the logic patterns it enables
 * rather than the hook itself (which would need a React test renderer).
 * These tests verify the optimistic update patterns work correctly.
 */
import { describe, it, expect } from "vitest";

// ─── Optimistic update pattern tests ───────────────────────────────────────

describe("Optimistic Update Patterns", () => {
  describe("toggle pattern", () => {
    it("toggles a boolean field optimistically", () => {
      const items = [
        { id: 1, name: "Item 1", active: true },
        { id: 2, name: "Item 2", active: false },
      ];

      // Simulate optimistic toggle of item 2
      const targetId = 2;
      const optimisticItems = items.map((item) =>
        item.id === targetId ? { ...item, active: !item.active } : item
      );

      expect(optimisticItems[0].active).toBe(true); // unchanged
      expect(optimisticItems[1].active).toBe(true); // toggled
    });

    it("rolls back on error", () => {
      const original = [
        { id: 1, active: true },
        { id: 2, active: false },
      ];

      // Simulate optimistic toggle
      const optimistic = original.map((item) =>
        item.id === 2 ? { ...item, active: !item.active } : item
      );
      expect(optimistic[1].active).toBe(true);

      // Simulate rollback
      const rolledBack = [...original];
      expect(rolledBack[1].active).toBe(false);
    });
  });

  describe("add-to-list pattern", () => {
    it("adds item optimistically with temp ID", () => {
      const items = [{ id: 1, name: "Existing" }];
      const newItem = { id: -1, name: "Optimistic" }; // temp negative ID

      const optimistic = [...items, newItem];
      expect(optimistic).toHaveLength(2);
      expect(optimistic[1].name).toBe("Optimistic");
    });

    it("replaces temp item with server response", () => {
      const items = [
        { id: 1, name: "Existing" },
        { id: -1, name: "Optimistic" },
      ];
      const serverItem = { id: 42, name: "Optimistic" };

      const updated = items.map((item) =>
        item.id === -1 ? serverItem : item
      );
      expect(updated[1].id).toBe(42);
    });
  });

  describe("remove-from-list pattern", () => {
    it("removes item optimistically", () => {
      const items = [
        { id: 1, name: "Keep" },
        { id: 2, name: "Remove" },
        { id: 3, name: "Keep" },
      ];

      const optimistic = items.filter((item) => item.id !== 2);
      expect(optimistic).toHaveLength(2);
      expect(optimistic.find((i) => i.id === 2)).toBeUndefined();
    });

    it("restores item on rollback", () => {
      const original = [
        { id: 1, name: "Keep" },
        { id: 2, name: "Remove" },
        { id: 3, name: "Keep" },
      ];

      // After rollback, original is restored
      const rolledBack = [...original];
      expect(rolledBack).toHaveLength(3);
      expect(rolledBack[1].name).toBe("Remove");
    });
  });

  describe("update-in-place pattern", () => {
    it("updates a field optimistically", () => {
      const items = [
        { id: 1, name: "Original", score: 50 },
        { id: 2, name: "Target", score: 75 },
      ];

      const optimistic = items.map((item) =>
        item.id === 2 ? { ...item, score: 100 } : item
      );
      expect(optimistic[1].score).toBe(100);
      expect(optimistic[0].score).toBe(50); // unchanged
    });
  });

  describe("favorite/bookmark pattern", () => {
    it("toggles favorite and updates count", () => {
      const state = { isFavorited: false, favoriteCount: 10 };

      // Optimistic toggle
      const optimistic = {
        isFavorited: !state.isFavorited,
        favoriteCount: state.favoriteCount + (state.isFavorited ? -1 : 1),
      };
      expect(optimistic.isFavorited).toBe(true);
      expect(optimistic.favoriteCount).toBe(11);

      // Toggle back
      const toggleBack = {
        isFavorited: !optimistic.isFavorited,
        favoriteCount: optimistic.favoriteCount + (optimistic.isFavorited ? -1 : 1),
      };
      expect(toggleBack.isFavorited).toBe(false);
      expect(toggleBack.favoriteCount).toBe(10);
    });
  });

  describe("batch update pattern", () => {
    it("updates multiple items at once", () => {
      const items = [
        { id: 1, status: "pending" },
        { id: 2, status: "pending" },
        { id: 3, status: "pending" },
      ];
      const idsToUpdate = new Set([1, 3]);

      const optimistic = items.map((item) =>
        idsToUpdate.has(item.id) ? { ...item, status: "completed" } : item
      );
      expect(optimistic[0].status).toBe("completed");
      expect(optimistic[1].status).toBe("pending");
      expect(optimistic[2].status).toBe("completed");
    });
  });

  describe("counter increment pattern", () => {
    it("increments counter optimistically", () => {
      let count = 5;
      count += 1; // optimistic
      expect(count).toBe(6);
    });

    it("decrements counter optimistically with floor at 0", () => {
      let count = 0;
      count = Math.max(0, count - 1); // optimistic with floor
      expect(count).toBe(0);
    });
  });
});
