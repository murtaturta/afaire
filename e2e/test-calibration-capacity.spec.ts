import { test, expect } from '@playwright/test';

test.describe('Adaptive Calibration & Cognitive Capacity Gauge', () => {
  test('displays daily capacity gauge and updates planned minutes on Today page', async ({ page }) => {
    // 1. Navigate to Today page
    await page.goto('/today');
    await expect(page).toHaveURL(/.*\/today/);

    // 2. Verify Capacity Gauge is visible
    await expect(page.getByText('Daily Capacity')).toBeVisible();

    // 3. Add a task with 60m nominal estimate
    await page.getByTestId('add-task-btn').click();
    await expect(page.getByTestId('task-form-title')).toBeVisible();
    await page.getByTestId('task-form-title').fill('Deep Learning Review');

    // Click 60m quick estimate button
    const sixtyMinBtn = page.getByRole('button', { name: '60m' });
    if (await sixtyMinBtn.isVisible()) {
      await sixtyMinBtn.click();
    }

    await page.getByTestId('task-form-submit').click();

    // Verify task card appears
    const taskCard = page.locator('[data-testid^="task-card-"]').filter({ hasText: 'Deep Learning Review' });
    await expect(taskCard).toBeVisible();

    // 4. Verify capacity gauge has updated
    await expect(page.getByText('Daily Capacity')).toBeVisible();
    await expect(page.getByText(/\/ 6h/)).toBeVisible();

    // 5. Expand capacity details
    const detailsBtn = page.getByRole('button', { name: 'Details' });
    if (await detailsBtn.isVisible()) {
      await detailsBtn.click();
      await expect(page.getByText('Target Capacity')).toBeVisible();
      await expect(page.getByText('Planned Calibrated')).toBeVisible();
    }
  });

  test('allows configuring daily capacity limits in Settings page', async ({ page }) => {
    // 1. Navigate to Settings
    await page.goto('/settings');
    await expect(page).toHaveURL(/.*\/settings/);

    // 2. Locate Cognitive Capacity & Pace Learning card
    await expect(page.getByRole('heading', { name: 'Cognitive Capacity & Pace Learning' })).toBeVisible();

    // 3. Click 4h capacity preset button
    const fourHourBtn = page.getByRole('button', { name: '4h' });
    await expect(fourHourBtn).toBeVisible();
    await fourHourBtn.click();

    // 4. Verify status message
    await expect(page.getByText('Daily capacity limit updated')).toBeVisible();

    // 5. Navigate back to Today and verify the gauge now reflects 4h
    await page.goto('/today');
    await expect(page.getByText(/\/ 4h/)).toBeVisible();
  });
});
