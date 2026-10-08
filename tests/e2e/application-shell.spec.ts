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

test('shows the M4 project dashboard for an authenticated owner', async ({ page }) => {
  await page.route('**/api/v1/session', async (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        user: {
          userId: 'USR-E2E',
          email: 'engineer@example.com',
          displayName: 'E2E Engineer',
          role: 'USER',
        },
        expiresAt: '2026-10-09T00:00:00.000Z',
      }),
    }),
  );
  await page.route('**/api/v1/projects', async (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: [
          {
            projectId: 'PROJ-E2E',
            name: 'Control cabinet',
            description: 'Persistent E2E fixture',
            documentRevision: 4,
            engineeringRevision: 2,
            updatedAt: '2026-10-08T00:00:00.000Z',
            designCheck: null,
          },
        ],
      }),
    }),
  );

  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Engineering projects.' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Control cabinet' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'New Project' })).toBeVisible();
  await expect(page.getByText('Revision 4')).toBeVisible();
});
