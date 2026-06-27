# Firefly Command Centre

A modern, read-first command-centre UI for a Firefly III household finance
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
bun run check
bun run test
bun run build
bun run test:e2e
```

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
