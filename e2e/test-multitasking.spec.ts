import { test, expect } from '@playwright/test';

test.describe('Multitasking Timers', () => {
  test('runs multiple task timers concurrently in the drawer', async ({ page }) => {
    // 1. Navigate to /today
    await page.goto('/today');
    await expect(page).toHaveURL(/.*\/today/);

    // 2. Add first task "Task 1"
    await page.getByTestId('add-task-btn').click();
    await expect(page.getByTestId('task-form-title')).toBeVisible();
    await page.getByTestId('task-form-title').fill('Task 1');
    await page.getByTestId('task-form-submit').click();

    // Verify Task 1 card is present
    const task1Card = page.locator('[data-testid^="task-card-"]').filter({ hasText: 'Task 1' });
    await expect(task1Card).toBeVisible();

    // 3. Add second task "Task 2"
    await page.getByTestId('add-task-btn').click();
    await expect(page.getByTestId('task-form-title')).toBeVisible();
    await page.getByTestId('task-form-title').fill('Task 2');
    await page.getByTestId('task-form-submit').click();

    // Verify Task 2 card is present
    const task2Card = page.locator('[data-testid^="task-card-"]').filter({ hasText: 'Task 2' });
    await expect(task2Card).toBeVisible();

    // 4. Start timer for Task 1
    const startBtn1 = task1Card.locator('[data-testid^="start-timer-btn-"]');
    await expect(startBtn1).toBeVisible();
    await startBtn1.click();

    // 5. Start timer for Task 2
    const startBtn2 = task2Card.locator('[data-testid^="start-timer-btn-"]');
    await expect(startBtn2).toBeVisible();
    await startBtn2.click();

    // 6. Verify both timer rows appear in the drawer
    const timerRows = page.locator('[data-testid^="drawer-timer-row-"]');
    await expect(timerRows).toHaveCount(2);

    // Verify both rows reflect each task
    await expect(timerRows.filter({ hasText: 'Task 1' })).toBeVisible();
    await expect(timerRows.filter({ hasText: 'Task 2' })).toBeVisible();

    // 7. Wait ~2-3 seconds and assert both elapsed time elements have incremented and format as mm:ss
    const elapsedElements = page.locator('[data-testid^="elapsed-time-"]');
    await expect(elapsedElements).toHaveCount(2);

    const timeFormatRegex = /^\d{2}:\d{2}$/;

    // Verify formatted as mm:ss and both have incremented past 00:00
    await expect(async () => {
      const elapsed1 = (await elapsedElements.nth(0).innerText()).trim();
      const elapsed2 = (await elapsedElements.nth(1).innerText()).trim();

      expect(elapsed1).toMatch(timeFormatRegex);
      expect(elapsed2).toMatch(timeFormatRegex);
      expect(elapsed1).not.toBe('00:00');
      expect(elapsed2).not.toBe('00:00');
    }).toPass({ timeout: 6000 });

    // 8. Verify both tasks run concurrently
    const runningBadges = page.locator('[data-testid^="drawer-timer-row-"]').getByText('Running');
    await expect(runningBadges).toHaveCount(2);
  });

  test('can pause and resume one timer without affecting another concurrent timer', async ({ page }) => {
    await page.goto('/today');

    // Create Task A and Task B
    await page.getByTestId('add-task-btn').click();
    await page.getByTestId('task-form-title').fill('Task A');
    await page.getByTestId('task-form-submit').click();

    await page.getByTestId('add-task-btn').click();
    await page.getByTestId('task-form-title').fill('Task B');
    await page.getByTestId('task-form-submit').click();

    const cardA = page.locator('[data-testid^="task-card-"]').filter({ hasText: 'Task A' });
    const cardB = page.locator('[data-testid^="task-card-"]').filter({ hasText: 'Task B' });

    await cardA.locator('[data-testid^="start-timer-btn-"]').click();
    await cardB.locator('[data-testid^="start-timer-btn-"]').click();

    const rowA = page.locator('[data-testid^="drawer-timer-row-"]').filter({ hasText: 'Task A' });
    const rowB = page.locator('[data-testid^="drawer-timer-row-"]').filter({ hasText: 'Task B' });

    // Pause Task A
    await rowA.locator('[data-testid^="pause-resume-btn-"]').click();
    await expect(rowA.getByText('Paused')).toBeVisible();
    await expect(rowB.getByText('Running')).toBeVisible();

    // Resume Task A
    await rowA.locator('[data-testid^="pause-resume-btn-"]').click();
    await expect(rowA.getByText('Running')).toBeVisible();
    await expect(rowB.getByText('Running')).toBeVisible();
  });
});
