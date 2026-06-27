# Month Navigation Cache

## Decision

Do not add TanStack DB for month switching yet.

Use a smaller read-only cache path first:

- server-side in-memory cache for monthly aggregate payloads;
- `/api/dashboard.json?month=YYYY-MM` for client-side month data;
- client-side month navigation with hover/focus and adjacent-month prefetch.

## Rationale

Measured `finances.home` month pages spend about 1.2-1.5 seconds waiting for
server response before rendering. The app currently reloads a full Astro page
and recomputes Firefly aggregates for every month switch.

TanStack DB is a better fit for normalized client-side collections, live
queries, optimistic writes, and local-first sync. This app is currently
read-only and passes aggregated dashboard data to the browser, not raw Firefly
records. Adding a sync database would increase architecture and privacy surface
before the simpler bottleneck is exhausted.

## Revisit When

- month comparison needs cross-month client-side querying over many raw records;
- review workflows need optimistic local edits before a staged server apply;
- offline usage becomes a real requirement;
- aggregate caching and prefetching do not meet the latency target.
