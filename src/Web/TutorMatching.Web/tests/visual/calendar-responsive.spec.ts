import { expect, test } from '@playwright/test';

test('calendar stays available across every responsive boundary', async ({ page }) => {
  for (const width of [375, 500, 699, 700, 701, 768, 900, 901, 1024, 1199, 1200, 1399, 1400, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/student/dashboard');
    await expect(page.locator('.legacy-calendar')).toBeVisible();
    await expect(page.locator('.dashboard-rail')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (width <= 1199) {
      await page.locator('.legacy-event--research').click();
      await expect(page.getByRole('dialog', { name: 'Event details' })).toBeVisible();
      await page.getByRole('button', { name: 'Close', exact: true }).click();
    }
  }
});
