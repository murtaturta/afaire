import { test, expect } from '@playwright/test';

test.describe('Task Session History & Timeline', () => {
  test('records session history and displays time split breakdown upon completion', async ({ page }) => {
    // 1. Navigate to /today
    await page.goto('/today');
    await expect(page).toHaveURL(/.*\/today/);

    // 2. Create a task with title "History Task"
    await page.getByTestId('add-task-btn').click();
    await expect(page.getByTestId('task-form-title')).toBeVisible();
    await page.getByTestId('task-form-title').fill('History Task');
    await page.getByTestId('task-form-submit').click();

    // Verify task card appears
    const taskCard = page.locator('[data-testid^="task-card-"]').filter({ hasText: 'History Task' });
    await expect(taskCard).toBeVisible();

    // 3. Start timer
    const startBtn = taskCard.locator('[data-testid^="start-timer-btn-"]');
    await expect(startBtn).toBeVisible();
    await startBtn.click();

    // Verify drawer opens with timer row
    const drawerRow = page.locator('[data-testid^="drawer-timer-row-"]').filter({ hasText: 'History Task' });
    await expect(drawerRow).toBeVisible();

    // 4. Wait ~2 seconds for elapsed time to accumulate
    const elapsedEl = drawerRow.locator('[data-testid^="elapsed-time-"]');
    await expect(async () => {
      const text = (await elapsedEl.innerText()).trim();
      expect(text).toMatch(/^\d{2}:\d{2}$/);
      expect(text).not.toBe('00:00');
    }).toPass({ timeout: 5000 });

    // 5. In the drawer, complete the task
    const completeBtn = drawerRow.locator('[data-testid^="complete-task-btn-"]');
    await expect(completeBtn).toBeVisible();
    await completeBtn.click();

    // Timer should be stopped and removed from drawer
    await expect(drawerRow).not.toBeVisible();

    // 6. Click timeline expand toggle on the task card
    const timelineToggle = taskCard.locator('[data-testid^="timeline-toggle-"]');
    await expect(timelineToggle).toBeVisible();
    await timelineToggle.click();

    // 7. Assert [data-testid="timeline-session-row"] exists
    const sessionRow = taskCard.locator('[data-testid="timeline-session-row"]');
    await expect(sessionRow).toBeVisible();

    // 8. Assert [data-testid="session-start-time"] and [data-testid="session-end-time"] are visible
    const startTime = sessionRow.locator('[data-testid="session-start-time"]');
    const endTime = sessionRow.locator('[data-testid="session-end-time"]');
    await expect(startTime).toBeVisible();
    await expect(endTime).toBeVisible();

    // Ensure format is HH:mm
    const timeFormat = /^\d{2}:\d{2}$/;
    expect((await startTime.innerText()).trim()).toMatch(timeFormat);
    expect((await endTime.innerText()).trim()).toMatch(timeFormat);

    // 9. Assert [data-testid="split-row"] is visible with time breakdown
    const splitRow = taskCard.locator('[data-testid="split-row"]');
    await expect(splitRow).toBeVisible();
    await expect(splitRow).toContainText('General');
  });

  test('records subtask sessions and displays subtask splits in timeline', async ({ page }) => {
    await page.goto('/today');

    // Create task
    await page.getByTestId('add-task-btn').click();
    await page.getByTestId('task-form-title').fill('Subtask History Task');
    await page.getByTestId('task-form-submit').click();

    const taskCard = page.locator('[data-testid^="task-card-"]').filter({ hasText: 'Subtask History Task' });
    await expect(taskCard).toBeVisible();

    // Add a subtask
    const subtaskInput = taskCard.locator('[data-testid="subtask-add-input"]');
    await subtaskInput.fill('Phase 1 Research');
    await subtaskInput.press('Enter');

    // Verify subtask row exists
    const subtaskRow = taskCard.locator('[data-testid^="subtask-row-"]').filter({ hasText: 'Phase 1 Research' });
    await expect(subtaskRow).toBeVisible();

    // Start subtask timer
    const subtaskStartBtn = subtaskRow.locator('[data-testid^="subtask-start-btn-"]');
    await subtaskStartBtn.click();

    // Verify drawer displays the subtask timer
    const drawerRow = page.locator('[data-testid^="drawer-timer-row-"]').filter({ hasText: 'Phase 1 Research' });
    await expect(drawerRow).toBeVisible();

    // Wait ~2 seconds
    const elapsedEl = drawerRow.locator('[data-testid^="elapsed-time-"]');
    await expect(async () => {
      const text = (await elapsedEl.innerText()).trim();
      expect(text).not.toBe('00:00');
    }).toPass({ timeout: 5000 });

    // Complete task from drawer
    const completeBtn = drawerRow.locator('[data-testid^="complete-task-btn-"]');
    await completeBtn.click();

    // Expand timeline
    const timelineToggle = taskCard.locator('[data-testid^="timeline-toggle-"]');
    await timelineToggle.click();

    // Verify split row shows Phase 1 Research
    const splitRows = taskCard.locator('[data-testid="split-row"]');
    await expect(splitRows.filter({ hasText: 'Phase 1 Research' })).toBeVisible();

    // Verify session row shows Phase 1 Research
    const sessionRow = taskCard.locator('[data-testid="timeline-session-row"]');
    await expect(sessionRow.filter({ hasText: 'Phase 1 Research' })).toBeVisible();
  });
});
