/* ═══════════════════════════════════════════════════════════════
   usePanelOrder — Drag-and-drop panel reordering with localStorage persistence
   Pass 155 — Feature 1
   ═══════════════════════════════════════════════════════════════ */
import { useState, useCallback, useRef } from 'react';

const STORAGE_KEY = 'wb-panel-order';

type NavItem = { id: string; label: string; icon: React.ReactNode };
type NavSection = { group: string; items: NavItem[] };

/** Load saved order from localStorage */
function loadSavedOrder(): Record<string, string[]> | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Save order to localStorage */
function saveOrder(order: Record<string, string[]>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(order));
  } catch {
    // localStorage full or unavailable — silently fail
  }
}

/** Apply saved order to NAV_SECTIONS, preserving any new items not in saved order */
export function applyCustomOrder(
  sections: NavSection[],
  savedOrder: Record<string, string[]> | null
): NavSection[] {
  if (!savedOrder) return sections;
  return sections.map(section => {
    const groupOrder = savedOrder[section.group];
    if (!groupOrder) return section;
    const itemMap = new Map(section.items.map(i => [i.id, i]));
    // Ordered items that still exist
    const ordered: NavItem[] = [];
    for (const id of groupOrder) {
      const item = itemMap.get(id);
      if (item) {
        ordered.push(item);
        itemMap.delete(id);
      }
    }
    // Append any new items not in saved order
    for (const item of itemMap.values()) {
      ordered.push(item);
    }
    return { ...section, items: ordered };
  });
}

export function usePanelOrder(defaultSections: NavSection[]) {
  const [customOrder, setCustomOrder] = useState<Record<string, string[]> | null>(() => loadSavedOrder());
  const dragItem = useRef<{ group: string; index: number } | null>(null);
  const dragOverItem = useRef<{ group: string; index: number } | null>(null);

  const orderedSections = applyCustomOrder(defaultSections, customOrder);

  const handleDragStart = useCallback((group: string, index: number) => {
    dragItem.current = { group, index };
  }, []);

  const handleDragEnter = useCallback((group: string, index: number) => {
    dragOverItem.current = { group, index };
  }, []);

  const handleDragEnd = useCallback(() => {
    if (!dragItem.current || !dragOverItem.current) return;
    // Only allow reordering within the same group
    if (dragItem.current.group !== dragOverItem.current.group) {
      dragItem.current = null;
      dragOverItem.current = null;
      return;
    }

    const group = dragItem.current.group;
    const section = orderedSections.find(s => s.group === group);
    if (!section) return;

    const items = [...section.items];
    const [removed] = items.splice(dragItem.current.index, 1);
    items.splice(dragOverItem.current.index, 0, removed);

    const newOrder = { ...customOrder };
    newOrder[group] = items.map(i => i.id);
    setCustomOrder(newOrder);
    saveOrder(newOrder);

    dragItem.current = null;
    dragOverItem.current = null;
  }, [orderedSections, customOrder]);

  const resetOrder = useCallback(() => {
    setCustomOrder(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const hasCustomOrder = customOrder !== null && Object.keys(customOrder).length > 0;

  return {
    orderedSections,
    handleDragStart,
    handleDragEnter,
    handleDragEnd,
    resetOrder,
    hasCustomOrder,
    dragItem,
  };
}
