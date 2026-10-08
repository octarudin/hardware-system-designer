import { expect, test } from '@playwright/test';

test('shows the secure login flow for an unauthenticated user', async ({ page }) => {
  await page.route('**/api/v1/session', async (route) =>
    route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({
        error: {
          code: 'AUTH_REQUIRED',
          message: 'Authentication is required.',
          requestId: 'e2e-request',
          details: [],
        },
      }),
    }),
  );
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  await expect(page.getByLabel('Email')).toBeVisible();
  await expect(page.getByLabel('Password')).toBeVisible();
});
