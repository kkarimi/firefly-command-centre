import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => window.localStorage.clear());
});

test('renders the minimal finance review UI and opt-in detail signals', async ({ page }, testInfo) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Finances' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Jun 2026' })).toBeVisible();
  await expect(page.locator('.period-pill')).toHaveCount(0);
  await expect(page.locator('.top-meta')).toHaveCount(0);
  await expect(page.getByText('Fixture')).toHaveCount(0);
  await expect(page.getByText('18:40')).toHaveCount(0);
  await expect(page.locator('.month-lens')).toBeVisible();
  await expect(page.getByRole('meter', { name: /Plan used: \d+%/ })).toBeVisible();
  await expect(page.getByText('Current month')).toHaveCount(0);
  await expect(page.locator('.month-status-chip')).toHaveCount(1);
  await expect(page.locator('.month-status-chip')).toHaveText('Tight');
  await expect(page.locator('.month-status-chip')).toHaveAccessibleName(
    /Tight\. \d+% of the monthly plan is used\. Projected month-end spend is .* against .* plan\. Open category details\./,
  );
  await page.locator('.month-status-chip').click();
  await expect(page.getByRole('region', { name: 'Spend categories' })).toBeVisible();
  await page.locator('.spend-rhythm-trigger').click();
  await expect(page.locator('.spend-rhythm-trigger')).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByText(/heavier|lighter/)).toHaveCount(0);
  await expect(page.locator('.lens-signal')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Open dashboard settings' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Monthly spend rhythm' })).toBeVisible();
  await expect(page.getByText('Peak £421')).toBeVisible();
  await expect(page.getByText('7d spend £833')).toHaveCount(0);
  await expect(page.getByText('Pace over £109/d')).toHaveCount(0);
  await expect(page.locator('.spend-rhythm-foot')).toContainText(/Projected £[\d,]+/);
  await expect(page.locator('.spend-rhythm-foot')).not.toContainText('Forecast over £217');
  await expect(page.getByText(/Left\/day/)).toBeVisible();
  await expect(page.getByText('Bills left £1,810')).toHaveCount(0);
  await expect(page.getByText('Net flow £4,738')).toHaveCount(0);
  await expect(page.getByText('Cash trend +£260')).toHaveCount(0);
  await expect(page.getByText('Focus Review queue')).toHaveCount(0);
  await expect(page.getByRole('navigation', { name: 'Month history' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'General / Review' })).toHaveCount(0);

  await page.evaluate(() => {
    (window as Window & { financeUiNavMarker?: string }).financeUiNavMarker = 'kept';
  });
  await page.getByRole('link', { name: 'May 2026' }).click();
  await expect(page).toHaveURL(/\/months\/2026-05$/);
  await expect(page.getByRole('heading', { name: 'May 2026' })).toBeVisible();
  await expect(page.locator('.spend-rhythm-trigger')).toHaveAttribute('aria-expanded', 'false');
  await expect(page.evaluate(() => (window as Window & { financeUiNavMarker?: string }).financeUiNavMarker)).resolves.toBe(
    'kept',
  );

  await page.getByRole('link', { name: 'This month' }).click();
  await expect(page.getByRole('heading', { name: 'Jun 2026' })).toBeVisible();

  await page.locator('.spend-rhythm-trigger').click();
  await expect(page.locator('.spend-rhythm-trigger')).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('region', { name: 'Spend categories' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'General / Review' })).toBeVisible();
  await expect(page.locator('.budget-tile').filter({ hasText: 'Groceries' }).locator('.budget-pace')).toContainText(
    /£\d+\/day/,
  );
  await expect(page.locator('.budget-tile').filter({ hasText: 'Groceries' }).locator('.budget-values')).toContainText(
    'Forecast over',
  );
  await expect(page.locator('.budget-tile').filter({ hasText: 'Eating Out' }).locator('.budget-pace')).toContainText(
    'No room',
  );
  await expect(page.getByRole('link', { name: 'Open Eating Out budget in Firefly' })).toHaveAttribute(
    'href',
    '/actions/firefly/budgets/show?budgetId=eating-out',
  );
  await expect(page.getByRole('link', { name: 'Open Groceries budget in Firefly' })).toHaveAttribute(
    'href',
    '/actions/firefly/budgets/show?budgetId=groceries',
  );
  await expect(page.getByRole('link', { name: 'Open Bills & Utilities budget in Firefly' })).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath(`${testInfo.project.name}-month-dashboard.png`), fullPage: true });

  await page.getByRole('button', { name: 'Open dashboard settings' }).click();
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  await expect(page.getByRole('checkbox', { name: 'Cash signal' })).not.toBeChecked();
  await expect(page.getByRole('checkbox', { name: 'Focus signal' })).not.toBeChecked();
  await expect(page.getByRole('checkbox', { name: 'Detail signals' })).not.toBeChecked();
  await page.getByRole('checkbox', { name: 'Cash signal' }).check();
  await page.getByRole('checkbox', { name: 'Focus signal' }).check();
  await page.getByRole('button', { name: 'Month' }).click();
  await expect(page.locator('.lens-signal')).toHaveCount(2);
  await expect(page.locator('.lens-signal').filter({ hasText: 'Cash' })).toBeVisible();
  await expect(page.locator('.lens-signal').filter({ hasText: 'Focus' })).toBeVisible();

  await page.getByRole('button', { name: 'Review', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Review Inbox' })).toBeVisible();
  const reviewSummary = page.getByRole('region', { name: 'Review summary' });
  await expect(reviewSummary).toBeVisible();
  await expect(reviewSummary.locator('.metric').filter({ hasText: 'Risk' })).toContainText('1 / £184');
  await expect(reviewSummary.locator('.metric').filter({ hasText: 'Queued' })).toContainText('£2,246');
  await expect(reviewSummary.locator('.metric').filter({ hasText: 'Stale' })).toHaveCount(0);
  const suggestedFixes = page.getByRole('region', { name: 'Suggested fixes' });
  await expect(suggestedFixes).toBeVisible();
  await expect(suggestedFixes.locator('header')).toContainText('4 rows');
  await expect(suggestedFixes.locator('header')).not.toContainText('source Monzo lead');
  await expect(suggestedFixes.locator('header')).not.toContainText('rule-ready');
  await expect(suggestedFixes.locator('header span')).not.toHaveAttribute('title', /rule-ready/);
  await expect(page.getByText('Classify movement 1 / £2,000')).toHaveCount(0);
  await expect(page.getByText('Rule candidate 1 / £43')).toHaveCount(0);
  await expect(page.getByText('Clean payee 1 / £19')).toHaveCount(0);
  await expect(page.locator('.fix-brief')).toHaveCount(0);
  await expect(page.getByText('Handle first')).toBeVisible();
  await expect(page.getByText('Watch next')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Handle first review rows' }).locator('header')).toContainText(
    '1 row / £184 / oldest 2d',
  );
  await expect(page.getByRole('region', { name: 'Watch next review rows' }).locator('header')).toContainText(
    '2 rows / £2,043 / oldest 5d',
  );
  await expect(page.getByRole('region', { name: 'Watch next review rows' }).locator('.review-row').first()).toContainText(
    'Cash movement',
  );
  await expect(page.getByText('Unknown card presentment')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Copy review fix for Unknown card presentment' })).toBeVisible();
  const firstReviewFixLink = page.getByRole('link', { name: 'Open review fix prep for Unknown card presentment' });
  await expect(firstReviewFixLink).toBeVisible();
  await expect(firstReviewFixLink).toHaveAttribute(
    'href',
    '/actions/firefly/transactions/review?groupId=grp_9A2F&month=2026-06',
  );
  await expect(page.getByRole('button', { name: 'Open transaction in Firefly unavailable' })).toHaveCount(0);
  await expect(page.locator('.review-row').filter({ hasText: 'Generated payee 1842' }).locator('.row-detail span').last()).toHaveClass(
    /tone-watch/,
  );
  await page.screenshot({ path: testInfo.outputPath(`${testInfo.project.name}-review-dashboard.png`), fullPage: true });

  await page.getByRole('button', { name: 'Accounts' }).click();
  await expect(page.getByRole('heading', { name: 'Accounts', exact: true })).toBeVisible();
  await expect(page.getByText('Cash accounts \u00a37,090.24')).toBeVisible();
  const accountsSummary = page.locator('.accounts-summary');
  await expect(accountsSummary.getByText('Budgetable cash')).toBeVisible();
  await expect(accountsSummary.locator('.metric').filter({ hasText: 'Liabilities' })).toContainText('-£9,864.98');
  await expect(accountsSummary.locator('.metric').filter({ hasText: 'Needs review' })).toContainText('4 / £70,425');
  await expect(page.locator('.account-group').filter({ hasText: 'Credit and liabilities' })).toContainText('-£9,864.98');
  await expect(page.locator('.account-group').filter({ hasText: 'Cash accounts' }).locator('header')).toContainText('Clear');
  await expect(page.locator('.account-group').filter({ hasText: 'Credit and liabilities' }).locator('header')).not.toContainText(
    '8% of map',
  );
  await expect(page.locator('.account-group').filter({ hasText: 'Credit and liabilities' }).locator('header')).toContainText(
    '1 flagged / £1,435',
  );
  await expect(page.getByRole('link', { name: 'Open AMEX account in Firefly' })).toHaveAttribute(
    'href',
    '/actions/firefly/accounts/show?accountId=amex',
  );
  await expect(page.getByRole('link', { name: 'Open M&S loan account in Firefly' })).toHaveCount(0);
  await expect(page.locator('.account-group').filter({ hasText: 'Wealth and manual assets' }).locator('header')).not.toContainText(
    '69% of map',
  );
  await expect(page.locator('.account-group').filter({ hasText: 'Wealth and manual assets' }).locator('header')).toContainText(
    '3 flagged / £68,990',
  );
  const wealthRows = page.locator('.account-group').filter({ hasText: 'Wealth and manual assets' }).locator('.account-row');
  await expect(wealthRows.nth(2)).toContainText('Gold holdings');
  await expect(wealthRows.nth(3)).toContainText('Fixed-term deposit');
  await expect(page.getByText('£81,930.33')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Cash coverage' })).toBeVisible();
  await expect(page.getByText('Reserved £1,810 (26%)')).toBeVisible();
  await expect(page.getByText('Free after bills £5,280')).toBeVisible();
  await expect(page.getByText(/Runway \d+d at this pace/)).toBeVisible();
  await expect(page.getByText('Debt cover 72%')).toHaveCount(0);
  await expect(page.getByText('After debt -£2,775')).toHaveCount(0);
  await expect(page.getByText('Liquidity 6%')).toHaveCount(0);
  await expect(page.getByText('Largest exposure 41%')).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath(`${testInfo.project.name}-accounts-dashboard.png`), fullPage: true });

  await page.getByRole('button', { name: 'Expected' }).click();
  await expect(page.getByRole('heading', { name: 'Expected' })).toBeVisible();
  const expectedSummary = page.getByRole('region', { name: 'Expected summary' });
  await expect(expectedSummary).toBeVisible();
  await expect(expectedSummary.getByText('£9,300')).toBeVisible();
  await expect(expectedSummary.locator('.metric').filter({ hasText: 'Still expected' })).toContainText('2 / £3,435');
  await expect(expectedSummary.getByText('Due next')).toBeVisible();
  await expect(expectedSummary.getByText('4 Jul / £1,435')).toBeVisible();
  await expect(expectedSummary.locator('.metric').filter({ hasText: 'Next 7d' })).toContainText('1 / £1,435');
  const nearTermCover = page.getByRole('region', { name: /Near-term cover/ });
  await expect(nearTermCover).toBeVisible();
  await expect(nearTermCover).toContainText('£3,495.42');
  await expect(nearTermCover).toContainText('Due 1 / £1,435');
  await expect(nearTermCover).toContainText('After 7d £3,495');
  await expect(nearTermCover).toContainText('Next 4 Jul');
  await expect(nearTermCover).not.toContainText('Later 1 / £2,000');
  await expect(nearTermCover).not.toContainText('After all £1,495');
  await expect(nearTermCover).not.toContainText('Open reserve 70%');
  await expect(nearTermCover).not.toContainText('Cash floor 31 Jul / £1,495');
  await expect(nearTermCover).not.toContainText('Month net £5,865');
  const cashCalendar = page.getByRole('region', { name: 'Cash calendar' });
  await expect(cashCalendar).toBeVisible();
  await expect(cashCalendar.locator('header')).toContainText('2 open / £3,435 due / 3 logged');
  await expect(cashCalendar.getByText('AMEX statement payment')).toBeVisible();
  await expect(cashCalendar.getByText(/Awaiting bank-side transfer \/ (in \d+d|due today|\d+d overdue)/)).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open AMEX statement payment bill in Firefly' }).first()).toHaveAttribute(
    'href',
    '/actions/firefly/bills/show?billId=amex-statement-payment',
  );
  await expect(page.getByRole('link', { name: 'Open Council tax bill in Firefly' })).toHaveCount(0);
  await expect(cashCalendar.getByText('31 Jul')).toBeVisible();
  await expect(page.getByText('WEFINDFLATS variable income')).toBeVisible();
  await expect(page.locator('.expected-group').filter({ hasText: 'Income' }).locator('header')).toContainText('£9,300');
  await expect(page.locator('.expected-group').filter({ hasText: 'Income' }).locator('header')).toContainText('0 open');
  await expect(page.locator('.expected-group').filter({ hasText: 'Bills and tax' }).locator('header')).toContainText('£3,649');
  await expect(page.locator('.expected-group').filter({ hasText: 'Bills and tax' }).locator('header')).toContainText(
    '2 open / £3,435 due',
  );
  await expect(page.locator('.expected-group').filter({ hasText: 'Known bills' }).locator('header')).toContainText('£13');
  await expect(page.locator('.expected-group').filter({ hasText: 'Known bills' }).locator('header')).toContainText('0 open');
  const firstExpectedGroupGap = await page.locator('.expected-group').first().evaluate((group) => {
    const heading = group.querySelector('header')?.getBoundingClientRect();
    const row = group.querySelector('.expected-row')?.getBoundingClientRect();
    return heading && row ? row.top - heading.bottom : 0;
  });
  expect(firstExpectedGroupGap).toBeLessThanOrEqual(24);
  await page.screenshot({ path: testInfo.outputPath(`${testInfo.project.name}-expected-dashboard.png`), fullPage: true });

  await page.getByRole('button', { name: 'Trust' }).click();
  await expect(page.getByRole('heading', { name: 'Data Trust' })).toBeVisible();
  await expect(page.getByText('Read-only checks')).toBeVisible();
  await expect(page.getByText('8 sources observed')).toHaveCount(0);
  const trustSummary = page.getByRole('region', { name: 'Trust summary' });
  await expect(trustSummary).toBeVisible();
  await expect(trustSummary.locator('.metric').filter({ hasText: 'Verified' })).toContainText('88%');
  await expect(trustSummary.locator('.metric').filter({ hasText: 'Lead issue' })).toContainText('Firefly');
  await expect(trustSummary.locator('.metric').filter({ hasText: 'Watch' })).toHaveCount(0);
  await expect(trustSummary.locator('.metric').filter({ hasText: 'Risk' })).toHaveCount(0);
  await expect(page.locator('.ops-detail h3').first()).toHaveText('Firefly');
  const trustActionLink = page.getByRole('link', { name: 'Open Firefly action' });
  await expect(trustActionLink).toBeVisible();
  await expect(trustActionLink).toHaveAttribute('href', '/actions/firefly');

  await page.screenshot({ path: testInfo.outputPath(`${testInfo.project.name}-ops-dashboard.png`), fullPage: true });

  await page.getByRole('button', { name: 'Open dashboard settings' }).click();
  await page.getByRole('checkbox', { name: 'Detail signals' }).check();
  await page.getByRole('button', { name: 'Month' }).click();
  await expect(page.getByText('7d spend £833')).toBeVisible();
  await expect(page.getByText('Pace over £109/d')).toBeVisible();
  await expect(page.getByText('Forecast over £217')).toBeVisible();

  await page.getByRole('button', { name: 'Review', exact: true }).click();
  await expect(reviewSummary.locator('.metric').filter({ hasText: 'Stale' })).toContainText('1 / £19');
  await expect(suggestedFixes.locator('header')).toContainText(
    '4 rows / source Monzo lead / net out £2,246 / affects 49% spend / stale 25% / rule-ready 2 / £62',
  );
  await expect(page.getByText('Classify movement 1 / £2,000')).toBeVisible();
  const firstFixBrief = page.locator('[aria-label="Fix brief for Unknown card presentment"]');
  await expect(firstFixBrief).toContainText('Category');
  await expect(firstFixBrief).toContainText('Travel & Holidays');
  await expect(firstFixBrief).toContainText('Tag');
  await expect(firstFixBrief).toContainText('statement-review');

  await page.getByRole('button', { name: 'Accounts' }).click();
  await expect(page.getByText('Debt cover 72%')).toBeVisible();
  await expect(page.getByText('Largest exposure 41%')).toBeVisible();
  await expect(page.locator('.account-group').filter({ hasText: 'Cash accounts' }).locator('header')).toContainText(
    '6% of map / Clear',
  );

  await page.getByRole('button', { name: 'Expected' }).click();
  await expect(page.getByRole('region', { name: /Near-term cover/ })).toContainText('Open reserve 70%');
  await expect(page.getByRole('region', { name: /Near-term cover/ })).toContainText('Cash floor 31 Jul / £1,495');

  await page.getByRole('button', { name: 'Trust' }).click();
  await expect(page.getByText('8 sources observed')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Trust summary' }).locator('.metric').filter({ hasText: 'Watch' })).toContainText(
    '1 source',
  );
});

test('renders an archived month on its own URL', async ({ page }, testInfo) => {
  await page.goto('/months/2026-05');

  await expect(page).toHaveURL(/\/months\/2026-05$/);
  await expect(page.getByText('Month archive')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'May 2026' })).toBeVisible();
  await expect(page.getByRole('meter', { name: /Plan used: \d+%/ })).toBeVisible();
  await expect(page.locator('.month-status-chip')).toHaveCount(1);
  await expect(page.locator('.lens-signal')).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Monthly spend rhythm' })).toBeVisible();
  await expect(page.getByText('Month closed')).toBeVisible();
  await expect(page.getByText(/Bills paid £[\d,]+/)).toHaveCount(0);
  await expect(page.getByText('Open bills')).toHaveCount(0);
  await page.locator('.spend-rhythm-trigger').click();
  await expect(page.getByText('Over by')).toBeVisible();
  await expect(page.getByRole('link', { name: 'This month' })).toBeVisible();
  await expect(page.locator('.top-bar')).toHaveCSS('display', 'flex');
  await expect(page.locator('.merchant-line span').first()).toHaveCSS('overflow', 'hidden');
  const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(horizontalOverflow).toBeLessThanOrEqual(1);
  await page.screenshot({ path: testInfo.outputPath(`${testInfo.project.name}-month-archive.png`), fullPage: true });
});

test('renders an internal transaction fix prep page before Firefly handoff', async ({ page }, testInfo) => {
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/actions/firefly/transactions/review?groupId=grp_9A2F&month=2026-06');

  await expect(page.getByRole('heading', { name: 'Unknown card presentment' })).toBeVisible();
  await expect(page.locator('.action-header .status-chip')).toHaveText('Missing category and statement marker');
  await expect(page.getByRole('region', { name: 'Transaction summary' })).toContainText('-£184.20');
  await expect(page.getByRole('region', { name: 'Fix checklist' })).toContainText('Travel & Holidays');
  await expect(page.getByRole('region', { name: 'Review fix note' })).toContainText('Open: /actions/firefly/transactions/edit?groupId=grp_9A2F');
  await expect(page.getByRole('region', { name: 'Set category in Firefly' })).toContainText('Set category here');
  await expect(page.getByRole('region', { name: 'Set category in Firefly' })).toContainText('Category save unavailable');
  await expect(page.getByRole('link', { name: 'Continue in Firefly' })).toHaveAttribute(
    'href',
    '/actions/firefly/transactions/edit?groupId=grp_9A2F',
  );
  await page.getByRole('button', { name: 'Copy fix note for Unknown card presentment' }).click();
  await expect(page.getByText('Copied')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Copied fix note' })).toBeVisible();
  const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
  expect(clipboardText).toContain('Firefly group: grp_9A2F');
  expect(clipboardText).toContain('Category: Travel & Holidays');
  const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(horizontalOverflow).toBeLessThanOrEqual(1);
  await page.screenshot({ path: testInfo.outputPath(`${testInfo.project.name}-transaction-fix-prep.png`), fullPage: true });
});
