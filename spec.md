# Firefly Finance UI Spec

## Summary

Build a focused Firefly III companion UI for this household finance setup.

The goal is not to replace Firefly as the ledger and not to clone Actual Budget.
The goal is to make the existing Firefly data feel as clear, fast, and
decision-oriented as Actual Budget for the workflows that matter here:

- month-to-date household budget decisions;
- transaction review and cleanup;
- AMEX, Monzo, Kraken, Prosper, loans, and manual asset visibility;
- operational confidence that syncs, backups, and health checks are working.

Firefly remains the source of truth. The new UI is a read-first finance review
surface over Firefly and the existing repo/runtime checks.

## Product Thesis

Actual Budget feels better because it is built around one immediate question:
"what money is available to spend now?" Its envelope model turns the interface
into a live decision surface.

Firefly is more powerful for this setup, but its UI exposes accounting objects
instead of household decisions. Pico improves mobile access, but it is mainly a
lightweight transaction companion, not a full monthly review cockpit.

The opportunity is to keep Firefly's stronger ledger and automation, then add a
purpose-built UI that answers:

- Are we safe this month?
- What needs review?
- What changed since last review?
- Are external accounts and imports trustworthy?
- What is budgetable cash versus net worth versus project/accounting movement?

## Current Operating Model

The UI must reflect the policies already documented in this repo.

- Firefly is the canonical ledger.
- Monzo is the primary current account and syncs continuously.
- AMEX is imported and reconciled from statements/CSV exports.
- Kraken sync updates portfolio value and contribution/cost-basis accounts.
- Prosper, gold, and some assets are manually refreshed.
- M&S and paid-off loans are treated through Firefly liability/API semantics.
- House purchase is a project category, not a household bill.
- Tax, business admin, transfers, investments, and own-company loans stay
  outside normal monthly budgets unless a later decision changes that.
- Categories stay small. Detail lives in payees, tags, notes, accounts, and
  review decisions.
- `Review & Setup` / `General / Review` is a leakage queue, not a real spending
  target.

## Non-Goals

- Do not replace Firefly's database.
- Do not build bank sync inside the UI.
- Do not replace Monzo, AMEX, Kraken, backup, or health scripts.
- Do not implement live Firefly mutations in version 1.
- Do not expose Firefly personal access tokens in browser storage.
- Do not model every Firefly feature.
- Do not build a generic open-source finance product before proving this
  household workflow.

## Users

Primary user: the household finance operator who wants quick confidence and
fast monthly review without navigating Firefly's full accounting UI.

Secondary user: an automation/code agent or maintainer who needs a clear
read-only surface for current finance health, review queues, and operational
state before proposing changes.

## Core UX Principles

- Show decisions, not database nouns.
- Prefer one screen that explains the month over many generic reports.
- Separate budgetable household spend from transfers, investments, tax, setup,
  house purchase, and valuation movement.
- Treat uncertainty as a queue.
- Make incorrect state visibly uncomfortable.
- Every warning must lead to an internal action link, local detail view, or
  review surface that helps resolve it; passive warnings are noise.
- Keep write actions staged and reversible.
- Use Firefly as truth, but do not force the user to think in Firefly internals.

## MVP Views

### 1. Monthly Review

Purpose: answer "are we okay this month?"

Content:

- current month date range and last refresh time;
- Monzo balance and Firefly Monzo drift;
- budgetable cash indicator;
- seven household budget cards:
  - `Bills & Utilities`;
  - `Groceries`;
  - `Eating Out`;
  - `Shopping & Personal`;
  - `Transport`;
  - `Travel & Holidays`;
  - `General / Review`.
- each budget card shows:
  - limit;
  - spent;
  - remaining;
  - percent used;
  - days elapsed;
  - projected month-end spend;
  - top merchants/payees this month;
  - new or unusual spend marker.

Design requirement: `General / Review` must visually read as leakage/review
work, not as a normal safe budget.

### 2. Review Inbox

Purpose: answer "what needs human attention?"

Queues:

- uncategorized rows;
- rows in `Review & Setup`;
- generated or weird categories;
- `needs-review` tags;
- missing external IDs;
- duplicate external ID warnings;
- suspicious AMEX payment/refund rows;
- material uncategorized transfers;
- rows whose payee/category/budget conflicts with current policy.

Version 1 actions are read-only:

- open in Firefly;
- copy transaction ID/group ID;
- show suggested category, budget, tags, and rationale;
- export a proposed dated script/decision-note draft.

Future staged actions:

- approve suggested category/tag/budget changes;
- split material mixed income rows;
- create a dated script under `sql/YYYY-MM-DD/`;
- require explicit approval before apply.

### 3. Money Map

Purpose: answer "where is the money and what kind of money is it?"

Sections:

- Budgetable cash:
  - Monzo;
  - Monzo savings account;
  - known Monzo pot movements where available.
- Credit and liabilities:
  - AMEX;
  - M&S active loan;
  - paid-off liability accounts shown as paid off, not active debt.
- Wealth/manual assets:
  - Prosper SIPP;
  - Prosper GIA;
  - Prosper ISA;
  - Prosper fixed-term deposit;
  - gold holdings;
  - Kraken portfolio value.
- Excluded/project/accounting:
  - Kraken contributions/cost basis;
  - house purchase;
  - transfers and own-company loans;
  - setup/accounting rows.

Important behavior:

- Net worth and budgetable cash must be separate numbers.
- Manual assets must show "last verified" state where possible.
- Kraken must show sync freshness.
- The fixed-term deposit maturity date should be visible while relevant.

### 4. Expected vs Actual

Purpose: answer "what did we expect to happen, and what has happened?"

Panels:

- salary status:
  - Super Payments regular salary;
  - WEFINDFLATS base salary;
  - WEFINDFLATS variable/bonus income.
- bills due soon and recently paid;
- upcoming or outstanding tax/HMRC obligations;
- AMEX statement status:
  - latest statement period reviewed;
  - Firefly statement-date balance check;
  - duplicate external ID status.
- recurring merchant candidates that are not yet bills.

### 5. Ops Strip

Purpose: answer "can we trust the data?"

Always visible compact strip:

- local/Umbrel/GitHub checkout alignment;
- Firefly server and DB status;
- Monzo sync status and drift;
- Kraken sync age;
- latest backup age;
- latest backup integrity check;
- latest restore-test status;
- Pico status;
- health notification status if available.

This is one of the strongest reasons to build instead of adopting Actual:
Actual will not know or care about this operational model.

## Data Sources

### Firefly API

Primary source for:

- accounts;
- balances;
- transactions;
- budgets and budget limits;
- categories;
- tags;
- bills;
- transaction metadata;
- liabilities, using Firefly API/current-balance semantics rather than raw SQL.

### Existing Repo Scripts

Secondary source for already-curated checks:

- `scripts/check-firefly-accounting-on-umbrel.py`;
- `scripts/check-firefly-liabilities-on-umbrel.py`;
- `scripts/plan-firefly-category-taxonomy-on-umbrel.py`;
- `scripts/check-firefly-health-on-umbrel.py`;
- AMEX reconciliation helpers;
- backup verification and restore-test outputs.

The UI should prefer consuming stable JSON outputs from these scripts rather
than reimplementing every audit rule in frontend code.

### Runtime Status Files

Useful server-side inputs:

- latest health JSON under `/home/umbrel/firefly-home-ops-runtime/status/`;
- backup manifests under `/home/umbrel/firefly-backups/manifests/`;
- service logs only through sanitized summaries, not raw secrets.

## Recommended Tech Stack

Use a TypeScript-first stack aligned with the user's preferences.

### Frontend

- Astro for routing, SSR-capable pages, and a clean project structure.
- React islands for interactive dashboard panels, filters, tables, and charts.
- Tailwind CSS for layout and styling.
- Vite through Astro's build pipeline.
- TanStack Query for client-side data fetching/cache where interactivity needs
  it.
- Zod for API response validation.
- date-fns or Temporal polyfill for date handling.
- decimal.js for money arithmetic.

React is the pragmatic default over Solid for this project because dashboard
widgets, tables, charts, and query tooling have broader ecosystem support. Solid
can be revisited later if the project becomes heavily client-side and
performance-bound.

### Backend

- Astro server endpoints for the first version.
- Bun as package manager and local runtime where compatible.
- Node compatibility maintained for deployment safety on Umbrel.
- Server-side Firefly API proxy so the browser never sees Firefly tokens.
- No application database in MVP.
- Optional SQLite cache later if Firefly API latency or historical aggregation
  becomes a real bottleneck.

### Deployment

Proposed service path:

```text
services/finance-ui/
```

Runtime:

- Docker container on Umbrel;
- local bind to `127.0.0.1`;
- reverse proxy host such as `https://finance.home` or
  `https://firefly-command.home`;
- env/secrets stored only on Umbrel;
- source-controlled compose and runbook in this repo;
- included in backup and health checks once deployed.

## Architecture

```text
Browser
  |
  | HTTPS
  v
Finance UI Astro App
  |
  | server-side API calls only
  v
Firefly API

Finance UI Astro App
  |
  | reads sanitized JSON/status outputs
  v
firefly-home-ops runtime checks
```

Core rule: the browser talks to the finance UI server, never directly to
Firefly with a personal access token.

## API Shape

Initial internal endpoints:

- `GET /api/summary/month?month=YYYY-MM`
  - monthly aggregate for budgets, spend, review counts, and cash status.
- `GET /api/review-inbox?month=YYYY-MM`
  - all review queue items with suggested reason codes.
- `GET /api/money-map`
  - account groups, balances, net-worth, budgetable-cash, and freshness markers.
- `GET /api/expected-vs-actual?month=YYYY-MM`
  - salary, bills, tax, AMEX statement, and recurring candidate status.
- `GET /api/ops`
  - health, backup, restore, sync age, and checkout status.

Future staged write endpoints must not directly mutate Firefly in v1. They
should produce proposed scripts and decision notes first.

## Money and Classification Rules

The UI must encode these current policies:

- Household budgets are only regular spending budgets.
- `House purchase` is a project bucket and must be unbudgeted.
- `Business, Admin & Tax` is normally unbudgeted for household variance.
- `Transfers, Savings & Investments` is unbudgeted.
- `Review & Setup` is a temporary queue and should trend toward zero material
  rows.
- AMEX card payments are transfers when the bank-side transaction exists.
- AMEX refunds are tagged as refunds and must not create false income.
- Super Payments is regular salary.
- WEFINDFLATS has base salary and variable/bonus income.
- Own-company loans remain tagged cash movements unless a receivable model is
  explicitly approved later.
- Liability dashboards should use Firefly API balance semantics, not raw SQL
  transaction sums.

## Design Direction

This is an operational finance app, not a marketing site.

Visual style:

- dense but calm;
- highly scannable;
- restrained color;
- no decorative hero sections;
- no nested cards;
- no gradient/orb decoration;
- clear status colors only where they carry meaning.

Layout:

- desktop-first finance review surface with a strong mobile companion layout;
- top ops strip;
- left or top time-period control;
- primary monthly dashboard above the fold;
- review inbox and money map reachable in one click;
- stable dimensions for cards, counters, charts, and tables.

Interaction:

- segmented controls for month/current year views;
- tabs for `Month`, `Review`, `Money Map`, `Expected`, `Ops`;
- icon buttons with tooltips for open/copy/refresh/export;
- inline filters for category, budget, account, tag, and payee;
- no explanatory onboarding text inside the app unless it is contextual to a
  specific warning or empty state.

## What Makes It "As Good As Actual"

Not envelope budgeting. The equivalent quality bar is:

- a single first screen that tells the user what matters today;
- fast response;
- no accounting vocabulary unless it is needed;
- clear remaining budget and review work;
- confidence that the data is fresh and reconciled;
- obvious next action.

Actual's advantage is opinionated focus. This app needs the same focus, but on
this household's Firefly operating model.

## Phased Delivery

### Phase 0: Read-Only Prototype

Deliver:

- app scaffold under `services/finance-ui/`;
- mocked/sanitized local fixture data;
- static screens for the five MVP views;
- no Firefly token required;
- design review screenshots for desktop and mobile.

Exit criteria:

- the first screen makes the monthly position clearer than Firefly/Pico;
- no live data or secrets involved;
- user can judge whether the product shape is worth continuing.

### Phase 1: Live Read-Only Dashboard

Deliver:

- server-side Firefly API proxy;
- live monthly review;
- live review inbox;
- live money map;
- ops strip from health/backup status;
- Docker compose and runbook;
- backup and health-check integration.

Exit criteria:

- dashboard agrees with `make check-firefly-accounting`;
- Monzo balance/drift matches health check;
- budget numbers match Firefly for current month;
- no browser-exposed Firefly token;
- no live mutations.

### Phase 2: Review Workflow

Deliver:

- suggested classifications;
- suggested tags/budget/category changes;
- exportable dated SQL/script drafts;
- exportable decision-note drafts;
- links back to Firefly transaction groups.

Exit criteria:

- review inbox reduces monthly review time;
- all suggested changes are human-approved outside the app before apply;
- no direct live mutation path yet.

### Phase 3: Staged Mutations

Deliver only after explicit approval:

- authenticated staging flow;
- generated script preview;
- backup gate;
- apply gate requiring explicit confirmation;
- post-apply verification checklist.

Exit criteria:

- every mutation still produces dated repo artifacts;
- behavior matches current AGENTS.md safety rules;
- failed verification blocks further writes.

## Security and Safety

- Store Firefly tokens only in Umbrel runtime secrets.
- Do not commit `.env`, token, database, statement, or export files.
- Default to read-only Firefly API access if a suitable token can be created.
- Mutations require explicit user approval and existing repo safeguards.
- Log summaries, not raw transaction payloads, unless logs are explicitly local
  runtime files excluded from git.
- Add finance UI runtime data to backup checks if any persistent state is
  introduced.
- Add health checks before treating the app as part of the operational system.

## Testing and Verification

Minimum checks:

- TypeScript typecheck.
- Unit tests for money arithmetic and budget projections.
- Zod schema tests for Firefly API responses.
- Fixture tests for:
  - AMEX payment/refund classification;
  - excluded transfers/investments;
  - house purchase unbudgeted treatment;
  - liability API balance display;
  - WEFINDFLATS base versus variable income.
- Playwright screenshot checks for desktop and mobile dashboards.
- Accessibility checks for keyboard navigation and contrast.

Operational checks after deployment:

```bash
make status
make check-firefly-health
make check-firefly-backup
make test-firefly-backup-restore
```

## Success Metrics

The project is worth continuing if it achieves at least three of these:

- monthly review takes materially less time;
- fewer rows remain in `Review & Setup`;
- budget overspend causes are obvious without opening Firefly;
- AMEX statement/import state is understandable at a glance;
- manual asset refresh state is visible without reading runbooks;
- operational health failures are visible before they become finance-data
  problems;
- user prefers opening this UI over Firefly/Pico for routine review.

The project should be stopped or narrowed if:

- it becomes a second ledger;
- it requires duplicating Firefly's full transaction editor;
- it cannot explain the month better than existing Firefly reports;
- it adds maintenance without reducing review time;
- it encourages unsafe direct mutation of live Firefly data.

## Open Decisions

- Product name and local hostname.
- React only versus React plus Solid components.
- Whether to create a read-only Firefly token specifically for this UI.
- Whether to cache Firefly API responses in SQLite.
- Whether to add staged mutations in this app or keep all mutation scripts
  manual in the repo.
- Whether to build a companion mobile-optimized transaction review mode or leave
  that job to Pico.

## Recommendation

Proceed with Phase 0 only.

Do not migrate to Actual Budget and do not start by building a full alternative
frontend. First prove that a focused read-only finance review UI can make the
current Firefly setup easier to understand. If Phase 0 does not feel obviously
better than Firefly/Pico for monthly review, stop there.
