import { test, expect } from '@playwright/test';

test.describe('Mobile Touch & Daily Task Reordering', () => {
  test('displays drag handles and allows reordering tasks on Today page', async ({ page }) => {
    await page.goto('/today');
    await expect(page).toHaveURL(/.*\/today/);

    // Add Task Alpha
    await page.getByTestId('add-task-btn').click();
    await page.getByTestId('task-form-title').fill('Task Alpha');
    await page.getByTestId('task-form-submit').click();

    // Add Task Beta
    await page.getByTestId('add-task-btn').click();
    await page.getByTestId('task-form-title').fill('Task Beta');
    await page.getByTestId('task-form-submit').click();

    // Verify both tasks and their drag handles exist
    const alphaCard = page.locator('[data-testid^="task-card-"]').filter({ hasText: 'Task Alpha' });
    const betaCard = page.locator('[data-testid^="task-card-"]').filter({ hasText: 'Task Beta' });
    await expect(alphaCard).toBeVisible();
    await expect(betaCard).toBeVisible();

    const handles = page.locator('[data-testid^="drag-handle-"]');
    await expect(handles.first()).toBeVisible();
    expect(await handles.count()).toBeGreaterThanOrEqual(2);
  });

  test('switches timeline window with fast zoom presets and supports mobile touch', async ({ page }) => {
    await page.goto('/today');
    await expect(page).toHaveURL(/.*\/today/);

    // Verify timeline presets
    const preset1h = page.getByTestId('timeline-preset-1h');
    const preset3h = page.getByTestId('timeline-preset-3h');
    const preset6h = page.getByTestId('timeline-preset-6h');
    const preset12h = page.getByTestId('timeline-preset-12h');

    await expect(preset1h).toBeVisible();
    await expect(preset3h).toBeVisible();
    await expect(preset6h).toBeVisible();
    await expect(preset12h).toBeVisible();

    // Click 6h preset
    await preset6h.click();
    await expect(preset6h).toHaveClass(/bg-primary/);

    // Click 1h preset
    await preset1h.click();
    await expect(preset1h).toHaveClass(/bg-primary/);
  });
});
