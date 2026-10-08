import { expect, test } from '@playwright/test';

test('shows the implementation foundation without claiming feature completion', async ({
  page,
}) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    'A dependable foundation for engineering decisions.',
  );
  await expect(page.getByText('M1 · Contract and validation foundation')).toBeVisible();
});
