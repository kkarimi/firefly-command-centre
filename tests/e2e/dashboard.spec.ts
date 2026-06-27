import { expect, test } from '@playwright/test';

test('renders the command centre and all v0 sections', async ({ page }, testInfo) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Finances' })).toBeVisible();
  await expect(page.getByText('Cash accounts')).toBeVisible();
  await expect(page.getByRole('heading', { name: /\d+% of .* plan used/ })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Month history' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'General / Review' })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath(`${testInfo.project.name}-month-dashboard.png`), fullPage: true });

  await page.getByRole('button', { name: 'Review' }).click();
  await expect(page.getByRole('heading', { name: 'Review Inbox' })).toBeVisible();
  await expect(page.getByText('Unknown card presentment')).toBeVisible();

  await page.getByRole('button', { name: 'Accounts' }).click();
  await expect(page.getByRole('heading', { name: 'Accounts', exact: true })).toBeVisible();
  await expect(page.getByText('Cash accounts \u00a37,090.24')).toBeVisible();

  await page.getByRole('button', { name: 'Expected' }).click();
  await expect(page.getByRole('heading', { name: 'Expected' })).toBeVisible();
  await expect(page.getByText('WEFINDFLATS variable income')).toBeVisible();

  await page.getByRole('button', { name: 'Trust' }).click();
  await expect(page.getByRole('heading', { name: 'Data Trust' })).toBeVisible();
  await expect(page.getByText('Firefly')).toBeVisible();

  await page.screenshot({ path: testInfo.outputPath(`${testInfo.project.name}-ops-dashboard.png`), fullPage: true });
});

test('renders an archived month on its own URL', async ({ page }, testInfo) => {
  await page.goto('/months/2026-05');

  await expect(page).toHaveURL(/\/months\/2026-05$/);
  await expect(page.getByText('Month archive')).toBeVisible();
  await expect(page.getByRole('heading', { name: /\d+% of May 2026 plan used/ })).toBeVisible();
  await expect(page.getByRole('link', { name: 'This month' })).toBeVisible();
  await expect(page.locator('.top-bar')).toHaveCSS('display', 'flex');
  await page.screenshot({ path: testInfo.outputPath(`${testInfo.project.name}-month-archive.png`), fullPage: true });
});
