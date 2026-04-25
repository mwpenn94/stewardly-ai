/**
 * PWA Offline Service Worker — Pass 153 Enhanced
 *
 * Caching strategy:
 * - App shell (HTML, CSS, JS): Cache-first with network fallback
 * - Learning API calls: Stale-while-revalidate (aggressive caching for flashcards/quizzes)
 * - Other API calls: Network-first with cache fallback
 * - Static assets: Cache-first
 * - Offline fallback page for navigation requests
 */

const CACHE_NAME = "stewardly-v2";
const LEARNING_CACHE = "stewardly-learning-v1";
const OFFLINE_URL = "/offline.html";

// Learning-related tRPC procedure patterns to cache aggressively
const LEARNING_PATTERNS = [
  "learning.content.",
  "learning.mastery.getMine",
  "learning.mastery.summary",
  "learning.mastery.dueReview",
  "learning.mastery.dueNow",
  "learning.mastery.dueItems",
  "learning.mastery.dueReviewDeck",
  "learning.recommendations",
  "learning.activityCalendar",
  "learning.studyAnalytics",
  "learningSocial.settings.",
];

function isLearningRequest(url) {
  const pathname = url.pathname;
  if (!pathname.includes("/api/trpc/")) return false;
  const procMatch = pathname.match(/\/api\/trpc\/(.+)/);
  if (!procMatch) return false;
  const procName = decodeURIComponent(procMatch[1]);
  return LEARNING_PATTERNS.some((p) => procName.includes(p));
}

// App shell resources to pre-cache on install
const PRECACHE_URLS = [
  "/",
  "/offline.html",
  "/manifest.json",
  "/favicon.ico",
];

// Install: pre-cache app shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS);
    })
  );
  self.skipWaiting();
});

// Activate: clean old caches (keep current + learning)
self.addEventListener("activate", (event) => {
  const keepCaches = new Set([CACHE_NAME, LEARNING_CACHE]);
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => !keepCaches.has(name))
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch: routing strategy
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== "GET") return;

  // Skip Chrome extensions and other non-http(s) requests
  if (!url.protocol.startsWith("http")) return;

  // Learning API requests: stale-while-revalidate (aggressive caching)
  if (url.pathname.startsWith("/api/") && isLearningRequest(url)) {
    event.respondWith(
      caches.open(LEARNING_CACHE).then((cache) => {
        return cache.match(request).then((cached) => {
          const fetchPromise = fetch(request)
            .then((response) => {
              if (response.ok) cache.put(request, response.clone());
              return response;
            })
            .catch(() => cached);
          return cached || fetchPromise;
        });
      })
    );
    return;
  }

  // Other API requests: network-first with cache fallback
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          return caches.match(request);
        })
    );
    return;
  }

  // Navigation requests: network-first with offline fallback
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache the page
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
          return response;
        })
        .catch(() => {
          return caches.match(request).then((cached) => {
            return cached || caches.match(OFFLINE_URL);
          });
        })
    );
    return;
  }

  // Static assets: cache-first
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        return response;
      });
    })
  );
});
