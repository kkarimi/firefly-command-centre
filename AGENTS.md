# AGENTS.md

This repository is a public, source-only project for a Firefly III companion UI.

## Project Intent

- Build a tasteful, elegant, modern command-centre UI over Firefly III.
- Keep Firefly as the source-of-truth ledger.
- Keep v0 read-only and fixture-backed unless a later decision explicitly adds
  live Firefly API access.
- Make the app excellent for household finance review, not a generic clone of
  Firefly, Pico, or Actual Budget.
- Prefer minimal local configuration. Most financial configuration should stay
  in Firefly or in a small source-controlled config file.

## Tech Stack

- TypeScript.
- Astro.
- React islands for interactive widgets.
- Tailwind CSS.
- Vite through Astro.
- Bun for local package management and scripts.
- Node compatibility for deployment.

## Safety Boundaries

- Do not commit secrets, tokens, `.env` files, financial exports, or raw
  transaction data.
- Do not add live Firefly write/mutation features without an explicit decision.
- Browser code must never receive a Firefly personal access token.
- Use fixture or sanitized data for public examples and tests.
- Keep any future live API integration server-side.

## UI Standards

- Operational finance app, not marketing site.
- No landing page as the primary experience.
- No decorative gradients, blobs, or generic dashboard filler.
- Dense, calm, highly scannable UI.
- Mobile usable, desktop command-centre first.
- Text should explain decisions and state, not implementation details.
- Use stable dimensions for cards, counters, charts, and tables.

## Development Workflow

- Use semantic commits: `docs:`, `chore:`, `ci:`, `feat:`, `fix:`, `test:`.
- Keep `main` deployable.
- Run checks before pushing:

```bash
bun run check
bun run test
bun run build
```

## GitHub

The repository is public. Do not commit private household finance details.
