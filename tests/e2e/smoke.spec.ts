import { expect, test } from '@playwright/test';

const routes = [
  { path: '/', heading: 'Denari' },
  { path: '/transactions', heading: 'Transactions' },
  { path: '/raf', heading: 'Resource Allocation' },
  { path: '/periods', heading: 'Periods' },
  { path: '/settings', heading: 'Settings' },
];

test.describe('route smoke checks', () => {
  for (const route of routes) {
    test(`loads ${route.path}`, async ({ page }) => {
      await page.goto(route.path, { waitUntil: 'domcontentloaded' });

      await expect(page.getByRole('heading', { name: route.heading })).toBeVisible();
      await expect(page).toHaveURL(new RegExp(`${route.path === '/' ? '/$' : `${route.path}$`}`));
    });
  }

  test('bottom navigation links are visible', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const bottomNav = page.locator('nav').first();

    await expect(bottomNav.getByRole('link', { name: 'Dashboard', exact: true })).toBeVisible();
    await expect(bottomNav.getByRole('link', { name: 'Transactions', exact: true })).toBeVisible();
    await expect(bottomNav.getByRole('link', { name: 'RAF', exact: true })).toBeVisible();
    await expect(bottomNav.getByRole('link', { name: 'Periods', exact: true })).toBeVisible();
    await expect(bottomNav.getByRole('link', { name: 'Settings', exact: true })).toBeVisible();
  });
});