# Phase 3 — Performance & Reliability · Scoring

## Criteria

| # | Criterion | Description |
|---|---|---|
| C1 | **Bundle Size** | Client JS bundle is optimized. Code splitting, lazy loading, tree shaking. No unnecessary dependencies in client bundle. |
| C2 | **Query Efficiency** | Database queries use indexes. No N+1 queries. Pagination on large datasets. |
| C3 | **Caching Strategy** | Appropriate cache headers. React Query stale times configured. No unnecessary refetches. |
| C4 | **Error Resilience** | Graceful degradation when services fail. Circuit breakers. Retry logic. Timeout handling. |
| C5 | **Memory Management** | No memory leaks in React components. Proper cleanup in useEffect. No unbounded arrays. |
| C6 | **Concurrent Request Handling** | Server handles concurrent requests without blocking. No global mutable state. |
| C7 | **Asset Optimization** | Images use CDN. Fonts loaded efficiently. CSS purged. No render-blocking resources. |
| C8 | **Startup Performance** | Server starts quickly. Client renders meaningful content fast. No blocking initialization. |

## Baseline Assessment
