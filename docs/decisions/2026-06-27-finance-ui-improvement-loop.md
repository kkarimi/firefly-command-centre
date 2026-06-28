# Finance UI Improvement Loop

## Decision

Use an iterative improvement loop for the finance UI, with each iteration
limited to one meaningful product or code-quality change.

The loop runs on a branch, starts from the current product thesis, and must pass
design, safety, and verification gates before a change is accepted. It may
continue for a long unattended session, but it must stop when a decision needs
human judgement, live infrastructure changes, secrets, or any Firefly mutation.

## Current State

The app is a read-first Firefly III companion UI. Firefly remains the source of
truth, and this app should make monthly household finance review feel calmer,
faster, and more decision-oriented than the default Firefly UI.

Recent accepted design direction:

- The first page should be minimal and reassuring.
- The top month hero should read as month status, not a report sentence.
- The current hero shape is a circular plan gauge, month title, and calm status
  chip such as `On track`.
- Cash is optional first-page material, not default first-page material.
- Spend rhythm is the primary first-page visual.
- Spend categories are behind click-through detail by default.
- Optional panels live behind the settings gear and persist locally.
- Month navigation should feel instant after preload and should not expose raw
  Firefly data to the browser.

Recent implementation guardrails:

- Use neutral code names such as `finance`, `dashboard`, `month`, `review`, and
  `accounts`. Avoid temporary product names in modules, storage keys, and data
  labels.
- Keep live Firefly reads server-side.
- Do not add Firefly write features unless the operator explicitly approves the
  exact write class. The currently approved write class is setting an existing
  category on a flagged transaction from its internal fix-prep page.
- Do not commit secrets, raw exports, raw transactions, or private runtime
  files.
- Prefer small source-controlled config over hidden local state.

## Loop Contract

Each iteration follows this shape:

1. Re-read `AGENTS.md`, `README.md`, `spec.md`, this decision note, and the
   latest relevant component files.
2. Inspect the current desktop and mobile screenshots or generate fresh ones.
3. Pick one improvement from the backlog or from an observed flaw.
4. State the intended user-visible outcome in one sentence before editing.
5. Make the smallest coherent code change that achieves that outcome.
6. Run the local verification gate.
7. Inspect desktop and mobile screenshots.
8. Accept the iteration only if it passes all gates below.
9. Commit with a semantic message and push the branch as a checkpoint.
10. Continue with another iteration only if there is a clear next safe change.

## Design Gate

Reject a change if it:

- adds a generic dashboard panel without a specific review decision it supports;
- promotes too many exact values to the first page;
- duplicates the same meaning in two places;
- uses decorative gradients, blobs, or ornamental widgets;
- makes the first page feel like a marketing landing page;
- uses accounting or implementation language where household decision language
  would be clearer;
- makes mobile feel like a compressed desktop report;
- hides important risk states so thoroughly that the page becomes falsely calm.

Prefer changes that:

- make the first screen easier to scan in under five seconds;
- use visual indicators for state and trend while keeping exact values available
  through hover, click, title, or drill-down;
- reduce always-visible text;
- preserve the current quiet surface, restrained color, and stable card layout;
- make uncertainty visibly actionable through review queues rather than noise.

## Safety Gate

The loop must stop for user approval before:

- deploying to live infrastructure;
- changing router, DNS, Caddy, Docker, secrets, tokens, permissions, or backups;
- adding or using a new Firefly mutation path beyond the approved transaction
  category save flow;
- committing private data, runtime paths, raw exports, or raw transactions;
- introducing a browser-visible Firefly token or raw Firefly payload;
- changing product policy, for example category taxonomy or account treatment.

## Verification Gate

A code iteration must pass:

```bash
bun run verify
```

This includes linting, React Doctor, type checking, unit tests, production
build, and Playwright browser checks. Screenshot output should be inspected for
desktop and mobile before accepting UI work.

For UI iterations, also check:

- no horizontal overflow;
- text does not wrap awkwardly inside compact values;
- the first page has only one primary status surface;
- optional panels remain optional after reload;
- archived month pages still load CSS and maintain layout;
- month switching remains client-side after warm/preloaded data.

## Safe Backlog

Good candidates for unattended iterations:

- Improve the Review tab so it is a focused work queue, not a list dump.
- Make the Accounts view better separate budgetable cash, liabilities, wealth,
  and excluded accounting movement.
- Improve Expected so salaries, bills, AMEX statement state, and upcoming tax
  obligations are clearer at a glance.
- Add better empty states for months with no review queue or no visible budget
  issue.
- Add more visual regression assertions around first-page clutter.
- Split any remaining large component if it improves human readability without
  creating indirection.
- Add small derived indicators that explain whether a month is healthy, tight,
  or risky without adding more visible copy.

Stop candidates:

- Any change requiring a new live data source.
- Any change requiring a new dependency with architectural consequences.
- Any request to write back to Firefly.
- Any visual direction that conflicts with the calm, spend-first first page.

## Current Branch Plan

Use branch `improve/finance-ui-loop` for this loop. Keep `main` deployable and
do not merge or deploy from this branch without explicit approval.

## Accepted Checkpoints

- `e777355` added this self-contained improvement loop context.
- `c6a6d23` tightened the Trust view with a compact clear/watch/risk summary
  and shorter source rows.
- `0d12293` reorganized the Review inbox into a triage queue with summary
  metrics and severity groups.
- `da4f1b9` summarized Expected cash events with income seen, still expected,
  and watch rows.
- `a9834d7` clarified Accounts summary labels and added Accounts visual
  evidence to the browser test flow.
- `57e2bd6` added Month empty states for no daily spend rows and no visible
  categories without changing the populated fixture layout.
- `36a6e6f` added an Expected cash calendar inspired by scheduled and recurring
  finance workflows, using existing dated events only.
- `441ee10` summarized Review cleanup actions into non-mutating suggested-fix
  chips.
- `9d9a3d9` added account group totals to make the Money Map easier to scan.
- `2a23ce6` made Review suggested-fix counts exclusive so each row contributes
  to one primary action.
- `550cfc5` sorted Trust checks by attention level so watch and risk states
  appear before healthy sources.
- `980fe6d` made the Review copy action functional and disabled unavailable
  Firefly-open controls.
- Trust summary now counts neutral `Info` sources separately so live
  not-wired checks are visible without being treated as failures.
- Review summary now counts stale rows separately from the oldest row age so
  queue pressure is visible without opening every review group.
- Accounts summary now surfaces liabilities separately from net position so
  debt exposure is visible before opening the account map.
- Expected cash calendar now separates open and logged dated events in the
  header so upcoming obligations are visible without scanning every tile.
- Review severity group headers now include queued value as well as row count
  so the work queue shows both effort and materiality.
- Review row ages now inherit the watch treatment once they cross the stale
  threshold so overdue cleanup is visible inside the queue.
- Accounts group headers now show whether that group is clear or has flagged
  accounts so review pressure is visible before scanning individual rows.
- Trust rows now use distinct status icons for clear, info, watch, and risk
  states instead of showing a check mark for every source.
- Expected group headers now show compact totals for income, bills and tax, and
  known bills so each list carries its materiality without another panel.
- Review severity group headers now include the oldest row age so cleanup order
  is visible before scanning individual transactions.
- Month spend rhythm now shows peak daily spend beside average, daily plan, and
  left-per-day so outlier pressure is visible without opening categories.
- Accounts cash coverage now prints the reserved-cash percentage beside the
  amount so the coverage bar has an explicit numeric reading.
- Trust summary now shows clear coverage as a percentage so overall data
  confidence is visible before scanning each source.
- Expected cash calendar now includes the open due amount in its header so
  upcoming cashflow exposure is visible before reading each item.
- Review suggested-fix chips now include queued value as well as row count so
  cleanup action types show materiality before opening the rows.
- Accounts group headers now include flagged balance value as well as count so
  manual asset and liability review pressure shows materiality before opening
  each group.
- Expected cash calendar rows now show compact due timing for open dated events
  so payment urgency is visible without relying on the event order alone.
- Review group rows now sort by queued value and then age so the highest-impact
  cleanup appears first inside each triage group.
- Accounts rows now sort flagged accounts before clear accounts inside each
  group so reviewable manual and liability balances are visible first.
- Expected summary now shows the amount due in the next seven days so scheduled
  cashflow pressure is visible before scanning the full cash calendar.
- Month category cards now show daily room to make category pacing visible
  without adding another dashboard panel.
- Accounts group headers now show each group's share of total account exposure
  so the Money Map reads as allocation as well as balances.
- Review severity group headers now show the dominant source so cleanup can be
  routed to the right import path before opening individual rows.
- Accounts cash coverage now shows a runway estimate from current spend pace so
  free cash after bills translates into time.
- Expected group headers now show open item count and due value so each
  scheduled-cash group can be triaged without reading every row.
- Month spend rhythm now shows projected month-end spend so current pace has a
  whole-month landing estimate before opening category details.
- Review suggested fixes now show the dominant source lead so cleanup can be
  routed before scanning severity groups.
- Month status now uses projected month-end spend, not only spent-to-date, so a
  tight forecast is visible before the plan is actually breached.
- Trust summary now promotes the highest-priority non-clear source so the first
  operational issue is visible before scanning the detail grid.
- Month category cards now show forecasted overrun before actual breach, so
  watch budgets no longer hide behind a current-left amount.
- Trust summary now counts every non-clear source as open, while keeping the
  lead source visible without implying every neutral gap is a warning.
- Expected summary now shows both count and value due in the next seven days so
  near-term cash obligations carry workload as well as amount.
- Review summary now shows stale row count and queued value so old cleanup work
  has materiality as well as age.
- Accounts summary now shows flagged account count and value so review exposure
  is visible before opening the Money Map.
- Month spend rhythm now shows bills left, or bills paid for archived months,
  so scheduled-obligation pressure is visible on the default Month surface.
- Review summary now shows risk row count and queued value so the highest
  priority cleanup has materiality before opening suggested fixes.
- Expected summary now shows still-expected count and value so remaining
  obligations carry workload as well as cash impact.
- Review rows now expose a detail-only fix brief so category, tag, movement,
  and rule guidance is easier to apply in Firefly without adding write access.
- Review copy actions now copy a structured fix note rather than only the group
  id, so applying a category or movement decision in Firefly is less manual.
- Review row actions now open an internal transaction fix-prep page before the
  Firefly edit handoff, keeping category guidance inside the app without adding
  a write path.
- Transaction fix-prep pages now include a copy action for the structured fix
  note so the Firefly handoff can keep the category, tag, and movement context.
- Flagged account rows now link through an internal Firefly account action so
  stale/manual account warnings have a direct resolution path.
- Transaction fix-prep pages now offer a warning-gated category save flow using
  existing Firefly categories only, so missing-category warnings can be resolved
  without leaving the app.
- Transaction category saves now remain disabled until the user chooses a
  different category and confirms the write, so no-op Firefly writes are harder
  to trigger from the fix-prep page.
- Category-save-unavailable notices now include an internal transaction handoff
  link, so the warning itself points at the resolution path instead of relying
  on nearby page actions.
- Approved category writes now include a collapsed scope disclosure explaining
  that the save changes only this split's category and leaves rules, tags, and
  other transaction fields unchanged.
- Flagged account links now open an internal account review page before the
  Firefly handoff, so account warnings include balance, freshness, and a
  copyable resolution note without adding another write path.
