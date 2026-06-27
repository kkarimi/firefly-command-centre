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

Early v0. The current app is fixture-backed and read-only by design.

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
```

## Safety

Do not commit Firefly tokens, exports, raw transactions, `.env` files, or
private finance data. Public examples must use fixture or sanitized data.

See [spec.md](./spec.md) for the product and implementation plan.
