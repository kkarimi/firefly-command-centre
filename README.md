# Firefly Finance UI

A modern, read-first finance review UI for a Firefly III household finance
setup.

Firefly stays the ledger. This app focuses on the questions the Firefly UI does
not answer quickly enough:

- Are we safe this month?
- What needs review?
- What changed since last review?
- Can we trust the syncs, backups, and external evidence?
- What is budgetable cash versus net worth versus project/accounting movement?

## Status

Early v0. The app is live-read by default when configured with a Firefly token
file, and falls back to sanitized fixture data only when no token is present.
It is read-only by design.

## Stack

- Astro 7
- TypeScript
- React
- Tailwind CSS
- Bun

## Development

```bash
bun install
bun run dev
```

Checks:

```bash
bun run lint
bun run lint:react
bun run check
bun run test
bun run build
bun run test:e2e
```

Or run the full local gate:

```bash
bun run verify
```

`lint` uses oxlint with React, accessibility, import, TypeScript, performance,
and Vitest rules. `lint:react` runs React Doctor without telemetry and fails on
React Doctor errors. `doctor` runs React Doctor in stricter advisory mode for
larger UI refactors.

## Code Organization

- `src/pages/` keeps Astro routing thin.
- `src/server/` loads and aggregates read-only Firefly data.
- `src/data/` owns sanitized fixtures and shared dashboard types.
- `src/lib/` owns framework-independent calculations.
- `src/components/FinanceApp.tsx` is the client shell.
- `src/components/*View.tsx` owns one visible app section.
- `src/components/uiPrimitives.tsx` owns small shared UI helpers.

Prefer neutral domain names such as `dashboard`, `month`, `review`, `accounts`,
or `finance` in code. Avoid encoding temporary project names into modules,
types, storage keys, or data labels.

`test:e2e` runs the built app through Playwright and writes ignored desktop and
mobile screenshots under `test-results/`.

## Runtime

Live Firefly mode is server-side only. Configure the container with:

```bash
FIREFLY_BASE_URL=http://firefly-iii_server_1:8080
FIREFLY_TOKEN_FILE=/run/secrets/firefly_token
```

The browser receives only aggregated dashboard data, never the Firefly token.
Without a token, the app uses sanitized fixture data.

## Safety

Do not commit Firefly tokens, exports, raw transactions, `.env` files, or
private finance data. Public examples must use fixture or sanitized data.

See [spec.md](./spec.md) for the product and implementation plan.
