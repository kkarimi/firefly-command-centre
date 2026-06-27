import { expect, test } from '@playwright/test';

test('renders the command centre and all v0 sections', async ({ page }, testInfo) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Firefly Command Centre' })).toBeVisible();
  await expect(page.getByText('Budgetable cash')).toBeVisible();
  await expect(page.getByRole('heading', { name: /Spend is \d+% of planned household budget/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'General / Review' })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath(`${testInfo.project.name}-month-dashboard.png`), fullPage: true });

  await page.getByRole('button', { name: 'Review' }).click();
  await expect(page.getByRole('heading', { name: 'Review Inbox' })).toBeVisible();
  await expect(page.getByText('Unknown card presentment')).toBeVisible();

  await page.getByRole('button', { name: 'Money Map' }).click();
  await expect(page.getByRole('heading', { name: 'Money Map' })).toBeVisible();
  await expect(page.getByText('Budgetable cash \u00a37,090.24')).toBeVisible();

  await page.getByRole('button', { name: 'Expected' }).click();
  await expect(page.getByRole('heading', { name: 'Expected vs Actual' })).toBeVisible();
  await expect(page.getByText('WEFINDFLATS variable income')).toBeVisible();

  await page.getByRole('button', { name: 'Ops' }).click();
  await expect(page.getByRole('heading', { name: 'Ops' })).toBeVisible();
  await expect(page.getByText('No browser path can modify Firefly in this prototype.')).toBeVisible();

  await page.screenshot({ path: testInfo.outputPath(`${testInfo.project.name}-ops-dashboard.png`), fullPage: true });
});
