/**
 * §P0-6 PWA Offline — IndexedDB wrapper
 * Provides offline storage for flashcard reviews, assessment progress,
 * and queued actions that sync when connectivity returns.
 */

const DB_NAME = "wealthbridge-offline";
const DB_VERSION = 1;

interface PendingReview {
  id: string; // client-generated idempotency key
  cardId: number;
  rating: number;
  responseTimeMs: number;
  timestamp: number;
  synced: boolean;
}

interface PendingAction {
  id: string; // idempotency key
  type: string;
  payload: Record<string, unknown>;
  timestamp: number;
  synced: boolean;
  retryCount: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      // Pending flashcard reviews (offline SRS submissions)
      if (!db.objectStoreNames.contains("pendingReviews")) {
        const reviewStore = db.createObjectStore("pendingReviews", { keyPath: "id" });
        reviewStore.createIndex("synced", "synced", { unique: false });
        reviewStore.createIndex("timestamp", "timestamp", { unique: false });
      }
      // Generic pending actions queue
      if (!db.objectStoreNames.contains("pendingActions")) {
        const actionStore = db.createObjectStore("pendingActions", { keyPath: "id" });
        actionStore.createIndex("synced", "synced", { unique: false });
        actionStore.createIndex("type", "type", { unique: false });
      }
      // Cached content for offline reading
      if (!db.objectStoreNames.contains("cachedContent")) {
        db.createObjectStore("cachedContent", { keyPath: "key" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** Generate a client-side idempotency key */
export function generateIdempotencyKey(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

/** Queue a flashcard review for offline sync */
export async function queueReview(review: Omit<PendingReview, "synced">): Promise<void> {
  const db = await openDb();
  const tx = db.transaction("pendingReviews", "readwrite");
  tx.objectStore("pendingReviews").put({ ...review, synced: false });
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Get all unsynced reviews */
export async function getUnsyncedReviews(): Promise<PendingReview[]> {
  const db = await openDb();
  const tx = db.transaction("pendingReviews", "readonly");
  const index = tx.objectStore("pendingReviews").index("synced");
  const request = index.getAll(IDBKeyRange.only(false));
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** Mark reviews as synced */
export async function markReviewsSynced(ids: string[]): Promise<void> {
  const db = await openDb();
  const tx = db.transaction("pendingReviews", "readwrite");
  const store = tx.objectStore("pendingReviews");
  for (const id of ids) {
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      if (getReq.result) {
        store.put({ ...getReq.result, synced: true });
      }
    };
  }
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Queue a generic action for offline sync */
export async function queueAction(action: Omit<PendingAction, "synced" | "retryCount">): Promise<void> {
  const db = await openDb();
  const tx = db.transaction("pendingActions", "readwrite");
  tx.objectStore("pendingActions").put({ ...action, synced: false, retryCount: 0 });
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Get all unsynced actions */
export async function getUnsyncedActions(): Promise<PendingAction[]> {
  const db = await openDb();
  const tx = db.transaction("pendingActions", "readonly");
  const index = tx.objectStore("pendingActions").index("synced");
  const request = index.getAll(IDBKeyRange.only(false));
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** Mark actions as synced */
export async function markActionsSynced(ids: string[]): Promise<void> {
  const db = await openDb();
  const tx = db.transaction("pendingActions", "readwrite");
  const store = tx.objectStore("pendingActions");
  for (const id of ids) {
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      if (getReq.result) {
        store.put({ ...getReq.result, synced: true });
      }
    };
  }
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Cache content for offline reading */
export async function cacheContent(key: string, data: unknown): Promise<void> {
  const db = await openDb();
  const tx = db.transaction("cachedContent", "readwrite");
  tx.objectStore("cachedContent").put({ key, data, cachedAt: Date.now() });
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Get cached content */
export async function getCachedContent<T = unknown>(key: string): Promise<T | null> {
  const db = await openDb();
  const tx = db.transaction("cachedContent", "readonly");
  const request = tx.objectStore("cachedContent").get(key);
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result?.data ?? null);
    request.onerror = () => reject(request.error);
  });
}

/** Sync all pending data when online */
export async function syncPendingData(
  syncReview: (review: PendingReview) => Promise<boolean>,
  syncAction: (action: PendingAction) => Promise<boolean>,
): Promise<{ reviewsSynced: number; actionsSynced: number }> {
  let reviewsSynced = 0;
  let actionsSynced = 0;

  // Sync reviews
  const reviews = await getUnsyncedReviews();
  const syncedReviewIds: string[] = [];
  for (const review of reviews) {
    try {
      const ok = await syncReview(review);
      if (ok) {
        syncedReviewIds.push(review.id);
        reviewsSynced++;
      }
    } catch {
      // Will retry on next sync
    }
  }
  if (syncedReviewIds.length > 0) await markReviewsSynced(syncedReviewIds);

  // Sync actions
  const actions = await getUnsyncedActions();
  const syncedActionIds: string[] = [];
  for (const action of actions) {
    try {
      const ok = await syncAction(action);
      if (ok) {
        syncedActionIds.push(action.id);
        actionsSynced++;
      }
    } catch {
      // Will retry on next sync
    }
  }
  if (syncedActionIds.length > 0) await markActionsSynced(syncedActionIds);

  return { reviewsSynced, actionsSynced };
}

/** Clear all synced data older than maxAge (ms) */
export async function cleanupSyncedData(maxAge: number = 7 * 24 * 60 * 60 * 1000): Promise<void> {
  const cutoff = Date.now() - maxAge;
  const db = await openDb();

  for (const storeName of ["pendingReviews", "pendingActions"] as const) {
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    const index = store.index("synced");
    const request = index.openCursor(IDBKeyRange.only(true));
    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor) {
        if (cursor.value.timestamp < cutoff) {
          cursor.delete();
        }
        cursor.continue();
      }
    };
  }
}
