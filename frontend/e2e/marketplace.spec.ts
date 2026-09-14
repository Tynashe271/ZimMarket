import { expect, test } from '@playwright/test';

// These smoke tests only exercise what the frontend can do with the backend
// offline (the sample catalog fallback). A full signed-in purchase-flow e2e
// needs the backend and its Postgres/Redis dependencies running (see
// backend/README.md) plus seeded demo data, and belongs in a follow-up spec.

test('homepage shows the ZimMarket brand', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByLabel('ZimMarket home')).toBeVisible();
});

test('marketplace page falls back to the sample catalog when the backend is offline', async ({ page }) => {
  await page.goto('/marketplace');
  await expect(page.getByText('Handwoven market basket')).toBeVisible();
});

test('marketplace page warns before adding a sample product to the cart', async ({ page }) => {
  await page.goto('/marketplace');
  await page.getByRole('button', { name: /Add to cart/i }).first().click();
  await expect(page.getByText('Sign in to load live products before adding to cart.')).toBeVisible();
});

test('cart page shows an empty state that links back to the marketplace', async ({ page }) => {
  await page.goto('/cart');
  await expect(page.getByText('Your cart is empty')).toBeVisible();
  await page.getByRole('link', { name: 'Browse products' }).click();
  await expect(page).toHaveURL(/\/marketplace$/);
});
