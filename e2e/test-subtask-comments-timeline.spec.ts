import { test, expect } from '@playwright/test';

test.describe('Subtask Comments & Timeline Grouping with Color Shading', () => {
  test('allows adding and viewing comments on subtasks and displays grouped subtasks on the timeline', async ({ page }) => {
    // 1. Navigate to Today page
    await page.goto('/today');
    await expect(page).toHaveURL(/.*\/today/);

    // 2. Create a task with a subtask
    await page.getByTestId('add-task-btn').click();
    await page.getByTestId('task-form-title').fill('Project Documentation');
    await page.getByTestId('task-form-submit').click();

    const taskCard = page.locator('[data-testid^="task-card-"]').filter({ hasText: 'Project Documentation' });
    await expect(taskCard).toBeVisible();

    // 3. Add a subtask inline
    const subtaskInput = taskCard.locator('[data-testid="subtask-add-input"]');
    await subtaskInput.fill('API Schema Design');
    await subtaskInput.press('Enter');

    const subtaskRow = taskCard.locator('[data-testid^="subtask-row-"]').filter({ hasText: 'API Schema Design' });
    await expect(subtaskRow).toBeVisible();

    // 4. Add a comment to the subtask
    const commentBtn = taskCard.locator('[data-testid^="subtask-comment-btn-"]');
    await expect(commentBtn).toBeVisible();
    await commentBtn.click();

    const commentInput = taskCard.locator('[data-testid^="subtask-comment-input-"]');
    await expect(commentInput).toBeVisible();
    await commentInput.fill('Verify OpenAPI v3 compatibility with client SDK');
    
    const saveBtn = taskCard.locator('[data-testid^="subtask-comment-save-"]');
    await saveBtn.click();

    // 5. Verify the comment appears on the subtask card
    const commentDisplay = taskCard.locator('[data-testid^="subtask-comment-text-"]');
    await expect(commentDisplay).toBeVisible();
    await expect(commentDisplay).toContainText('Verify OpenAPI v3 compatibility with client SDK');

    // 6. Run the subtask timer
    const subtaskStartBtn = taskCard.locator('[data-testid^="subtask-start-btn-"]');
    await subtaskStartBtn.click();

    const drawerRow = page.locator('[data-testid^="drawer-timer-row-"]').filter({ hasText: 'API Schema Design' });
    await expect(drawerRow).toBeVisible();

    // Wait ~2 seconds
    const elapsedEl = drawerRow.locator('[data-testid^="elapsed-time-"]');
    await expect(async () => {
      const text = (await elapsedEl.innerText()).trim();
      expect(text).not.toBe('00:00');
    }).toPass({ timeout: 5000 });

    // Stop session
    const stopBtn = drawerRow.locator('[data-testid^="stop-session-btn-"]');
    await stopBtn.click();
    await expect(drawerRow).not.toBeVisible();

    // 7. Verify bottom timeline expanded view groups the subtask under the parent task
    const detailedToggle = page.getByRole('button', { name: /Detailed View/ });
    if (await detailedToggle.isVisible()) {
      await detailedToggle.click();
    }

    // Main task header should be present in the bottom timeline
    await expect(page.getByText('Project Documentation').first()).toBeVisible();
    // Subtask should be listed with indicator
    await expect(page.getByText('API Schema Design').first()).toBeVisible();

    // 8. Open inline task timeline on the card and verify split row shows subtask and comment
    const timelineToggle = taskCard.locator('[data-testid^="timeline-toggle-"]');
    await timelineToggle.click();

    const splitRow = taskCard.locator('[data-testid="split-row"]').filter({ hasText: 'API Schema Design' });
    await expect(splitRow).toBeVisible();
    await expect(splitRow).toContainText('Verify OpenAPI v3 compatibility with client SDK');
  });
});
