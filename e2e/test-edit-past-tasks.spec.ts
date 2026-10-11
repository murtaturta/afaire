import { test, expect } from '@playwright/test';

test.describe('Past Tasks & Timecode Editing', () => {
  test('allows logging, editing, and deleting past session timecodes in All Tasks', async ({ page }) => {
    // 1. Navigate to All Tasks page
    await page.goto('/tasks');
    await expect(page).toHaveURL(/.*\/tasks/);

    // 2. Create a new task
    await page.getByTestId('add-task-btn').click();
    await expect(page.getByTestId('task-form-title')).toBeVisible();
    await page.getByTestId('task-form-title').fill('Architecture Design');
    await page.getByTestId('task-form-submit').click();

    // Verify task appears
    const taskCard = page.locator('[data-testid^="task-card-"]').filter({ hasText: 'Architecture Design' });
    await expect(taskCard).toBeVisible();

    // 3. Expand timeline section
    const timelineToggle = taskCard.locator('[data-testid^="timeline-toggle-"]');
    await expect(timelineToggle).toBeVisible();
    await timelineToggle.click();

    // 4. Click "Log Past Session" button
    const addSessionBtn = taskCard.getByTestId('add-manual-session-btn');
    await expect(addSessionBtn).toBeVisible();
    await addSessionBtn.click();

    // Verify modal opens
    await expect(page.getByRole('heading', { name: 'Log Past Session' })).toBeVisible();

    // 5. Fill start and end times (e.g. 10:00 to 11:00)
    const startInput = page.locator('input[type="time"]').first();
    const endInput = page.locator('input[type="time"]').last();

    await startInput.fill('10:00');
    await endInput.fill('11:00');

    // Submit session
    await page.getByRole('button', { name: 'Log Session' }).click();

    // Verify session row appears in timeline
    const sessionRow = taskCard.locator('[data-testid="timeline-session-row"]').first();
    await expect(sessionRow).toBeVisible();
    await expect(sessionRow.getByTestId('session-start-time')).toHaveText('10:00');
    await expect(sessionRow.getByTestId('session-end-time')).toHaveText('11:00');
    await expect(sessionRow).toContainText('1:00:00');

    // 6. Edit the session timecodes
    const editBtn = sessionRow.getByTestId('edit-session-btn');
    await expect(editBtn).toBeVisible();
    await editBtn.click();

    await expect(page.getByRole('heading', { name: 'Edit Session Timecodes' })).toBeVisible();

    // Change start time to 10:30
    const editStartInput = page.locator('input[type="time"]').first();
    await editStartInput.fill('10:30');

    await page.getByRole('button', { name: 'Save Changes' }).click();

    // Verify updated duration and start time
    await expect(sessionRow.getByTestId('session-start-time')).toHaveText('10:30');
    await expect(sessionRow).toContainText('30:00');

    // 7. Delete the session
    await editBtn.click();
    await expect(page.getByRole('heading', { name: 'Edit Session Timecodes' })).toBeVisible();

    await page.getByRole('button', { name: 'Delete Session' }).click();
    await page.getByRole('button', { name: 'Yes, Delete' }).click();

    // Verify session is removed
    await expect(taskCard.locator('[data-testid="timeline-session-row"]')).toHaveCount(0);
  });
});
