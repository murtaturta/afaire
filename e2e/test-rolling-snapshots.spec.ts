import { test, expect } from '@playwright/test';

test.describe('Automated Rolling Snapshots & Disaster Recovery', () => {
  test('creates manual snapshot and allows restoring in Settings page', async ({ page }) => {
    // 1. Navigate to Settings page
    await page.goto('/settings');
    await expect(page).toHaveURL(/.*\/settings/);

    // 2. Locate Automated Rolling Snapshots header
    await expect(page.getByText('Automated Rolling Snapshots')).toBeVisible();

    // 3. Click Save Snapshot button
    const saveSnapshotBtn = page.getByRole('button', { name: 'Save Snapshot' });
    await expect(saveSnapshotBtn).toBeVisible();
    await saveSnapshotBtn.click();

    // 4. Verify snapshot appears in list
    await expect(page.getByText('Snapshot created successfully')).toBeVisible();
    await expect(page.getByText('Manual snapshot from Settings')).toBeVisible();

    // 5. Test restore button
    const restoreBtn = page.getByRole('button', { name: 'Restore This Snapshot' }).first();
    await expect(restoreBtn).toBeVisible();
    await restoreBtn.click();

    await expect(page.getByText(/Restored .* tasks and .* sessions from snapshot/)).toBeVisible();
  });
});
