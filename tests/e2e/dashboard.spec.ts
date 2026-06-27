import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => window.localStorage.clear());
});

test('renders the finance review UI and all v0 sections', async ({ page }, testInfo) => {
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
  await expect(page.locator('.month-status-chip')).toHaveText('On track');
  await expect(page.locator('.month-status-chip')).toHaveAccessibleName(/On track\. \d+% of the monthly plan is used\./);
  await expect(page.getByText(/heavier|lighter/)).toHaveCount(0);
  await expect(page.locator('.lens-signal')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Open dashboard settings' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Monthly spend rhythm' })).toBeVisible();
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
  await page.screenshot({ path: testInfo.outputPath(`${testInfo.project.name}-month-dashboard.png`), fullPage: true });

  await page.getByRole('button', { name: 'Open dashboard settings' }).click();
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  await expect(page.getByRole('checkbox', { name: 'Cash signal' })).not.toBeChecked();
  await expect(page.getByRole('checkbox', { name: 'Focus signal' })).not.toBeChecked();
  await page.getByRole('checkbox', { name: 'Cash signal' }).check();
  await page.getByRole('checkbox', { name: 'Focus signal' }).check();
  await page.getByRole('button', { name: 'Month' }).click();
  await expect(page.locator('.lens-signal')).toHaveCount(2);
  await expect(page.locator('.lens-signal').filter({ hasText: 'Cash' })).toBeVisible();
  await expect(page.locator('.lens-signal').filter({ hasText: 'Focus' })).toBeVisible();

  await page.getByRole('button', { name: 'Review' }).click();
  await expect(page.getByRole('heading', { name: 'Review Inbox' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Review summary' })).toBeVisible();
  await expect(page.getByText('£2,246')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Suggested fixes' })).toBeVisible();
  await expect(page.getByText('Classify movement 1')).toBeVisible();
  await expect(page.getByText('Rule candidate 1')).toBeVisible();
  await expect(page.getByText('Clean payee 1')).toBeVisible();
  await expect(page.getByText('Handle first')).toBeVisible();
  await expect(page.getByText('Watch next')).toBeVisible();
  await expect(page.getByText('Unknown card presentment')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath(`${testInfo.project.name}-review-dashboard.png`), fullPage: true });

  await page.getByRole('button', { name: 'Accounts' }).click();
  await expect(page.getByRole('heading', { name: 'Accounts', exact: true })).toBeVisible();
  await expect(page.getByText('Cash accounts \u00a37,090.24')).toBeVisible();
  await expect(page.getByText('Budgetable cash')).toBeVisible();
  await expect(page.getByText('Needs review')).toBeVisible();
  await expect(page.getByText('-£9,864.98')).toBeVisible();
  await expect(page.getByText('£81,930.33')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath(`${testInfo.project.name}-accounts-dashboard.png`), fullPage: true });

  await page.getByRole('button', { name: 'Expected' }).click();
  await expect(page.getByRole('heading', { name: 'Expected' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Expected summary' })).toBeVisible();
  await expect(page.getByText('£9,300')).toBeVisible();
  await expect(page.getByText('£3,435')).toBeVisible();
  const cashCalendar = page.getByRole('region', { name: 'Cash calendar' });
  await expect(cashCalendar).toBeVisible();
  await expect(cashCalendar.getByText('AMEX statement payment')).toBeVisible();
  await expect(cashCalendar.getByText('31 Jul')).toBeVisible();
  await expect(page.getByText('WEFINDFLATS variable income')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath(`${testInfo.project.name}-expected-dashboard.png`), fullPage: true });

  await page.getByRole('button', { name: 'Trust' }).click();
  await expect(page.getByRole('heading', { name: 'Data Trust' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Trust summary' })).toBeVisible();
  await expect(page.getByText('7/8')).toBeVisible();
  await expect(page.getByText('1 source')).toBeVisible();
  await expect(page.getByText('Firefly')).toBeVisible();
  await expect(page.locator('.ops-detail h3').first()).toHaveText('Firefly');

  await page.screenshot({ path: testInfo.outputPath(`${testInfo.project.name}-ops-dashboard.png`), fullPage: true });
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
