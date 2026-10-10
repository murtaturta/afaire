# Multitasking & Session Timeline Design Doc

## 1. Store Design (`src/stores/timerStore.ts`)
- **Shape**: Keep `timers: Record<string, TimerInstance>`. Remove `activeTimerId`, `maximizeTimer`, and `minimizeTimer` since the UI is now a unified Drawer.
- **Persistence**: Wrap the store with Zustand's `persist` middleware (saving to `localStorage`). Because timers store `startTime` and `pausedDurations`, `elapsed` time can be cleanly re-calculated upon reload.
- **Tick Strategy**: Implement a global non-visual component (e.g., `TimerTicker.tsx` in `layout.tsx`) that runs a `setInterval` calling `tick()` every 1000ms *only if* `Object.keys(timers).length > 0`.
- **TimerInstance Updates**: The existing `TimerInstance` interface is sufficient, but ensure `elapsed` is reliably updated by `tick()` taking `Date.now() - startTime - totalPausedMs` into account.

## 2. Session Lifecycle
When a user finishes working on a task, they have two distinct intentions:
1. **Stop Session**: Stops the timer, records the `TimerSession` in Dexie, but the task remains open for future work.
2. **Complete Task**: Stops the timer, records the `TimerSession`, updates the task `status` to `'completed'`, and creates a `CompletionRecord`.

**Dexie DB Actions**:
- **Schema**: A version bump to `2` might be required if new indices are added, but structurally the existing tables can remain. We should ensure indices on `timerSessions.taskId` exist.
- **Helper Functions**: Ensure `createSession` (in `sessions.ts`) and `addCompletionRecord` (in `history.ts`) accurately compute `activeDurationMs` vs `rawDurationMs`. Ensure the completion logic calculates `actualMinutes` from the sum of all sessions for that task, not just the current session.

## 3. Behavior Rules
- **No Duplicates**: `startTimer(task)` should check if `timers[task.id]` exists. If it does, do nothing (or simply expand the drawer to show it).
- **Task Deletion**: If a task is deleted while its timer is running, the timer must be automatically removed from the store (`stopTimer` and discard, no session saved).
- **List Refresh**: Replace the `useEffect`/`useState` pattern in `TodayPage` with `useLiveQuery` from `dexie-react-hooks`. This ensures the UI automatically re-renders when a session is saved or a task is completed, without manual `loadTasks()` calls.

## 4. Component Plan
**Create**:
- `src/components/timer/TimerDrawer.tsx`: The right-side drawer containing all active timers.
- `src/components/timer/TimerItem.tsx`: Individual timer UI inside the drawer (handles pause, resume, stop, complete).
- `src/components/timer/TimerTicker.tsx`: A null-render component for the `setInterval` tick.
- `src/components/tasks/TaskTimeline.tsx`: Expanding inline timeline for a task showing past sessions.

**Modify**:
- `src/app/layout.tsx`: Remove `GlobalTimer`, add `TimerTicker` and `TimerDrawer`.
- `src/components/tasks/TaskCard.tsx`: Integrate `TaskTimeline` using an expandable section.
- `src/app/today/page.tsx`: Swap manual state loading for `useLiveQuery`.

**Delete**:
- `src/components/timer/GlobalTimer.tsx`
- `src/components/timer/FocusTimer.tsx`
- `src/components/timer/TimerMiniPlayer.tsx`
- `src/components/tasks/TaskHistoryModal.tsx`

**Note on `OutlierPrompt.tsx`**: Keep this working. When a session is stopped and its duration is an outlier, `TimerDrawer` should mount `OutlierPrompt` in a modal/overlay to ask for adjustment.

## 5. Drawer UX
- **Position**: Fixed to the right side of the screen, acting as a collapsible sidebar alongside `main`.
- **Collapsed**: Shows a small tab/toggle button attached to the right edge with a timer icon and a badge indicating the number of active timers.
- **Expanded**: Slides out (e.g., `w-80` or `w-96`) displaying vertically stacked `TimerItem` cards.
- **Interaction**: The user can open/close the drawer at any time. Clicking "Start timer" on a task card should automatically expand the drawer.

## 6. Test Contract
The UI Implementer MUST include the following `data-testid` attributes. The Playwright tests will strictly rely on them.

| Element | `data-testid` |
|---------|--------------|
| Add task button | `add-task-btn` |
| Task form title input | `task-form-title` |
| Task form submit button | `task-form-submit` |
| Task card container | `task-card-<taskId>` |
| Start timer button (per card) | `start-timer-btn-<taskId>` |
| Drawer toggle button | `drawer-toggle` |
| Drawer active timer row | `drawer-timer-row-<taskId>` |
| Elapsed time text (Drawer) | `elapsed-time-<taskId>` |
| Pause/Resume button | `pause-resume-btn-<taskId>` |
| Stop session button | `stop-session-btn-<taskId>` |
| Complete task button | `complete-task-btn-<taskId>` |
| Timeline expand toggle (Card) | `timeline-toggle-<taskId>` |
| Timeline session row | `timeline-session-row` |
| Session start time text | `session-start-time` |
| Session end time text | `session-end-time` |

**Format Requirement**: Elapsed time text must be formatted as `mm:ss` (or `hh:mm:ss` if >= 1 hour). Example: `05:30` or `01:15:00`.

## 7. Playwright Notes (For Test Writer)
- **Environment**: Windows environment.
- **URL**: Dev server runs at `http://localhost:3000`.
- **State**: `IndexedDB` and `localStorage` start empty per test context. You do not need to manually clear them if you rely on Playwright's default isolated contexts.
- **Timers**: For testing timer elapsed times, rely on Playwright's `page.clock` to mock and advance time instead of arbitrary `page.waitForTimeout` to avoid flakiness.

## 8. Open Questions
1. **Cross-tab sync**: Should we sync timers across multiple tabs? 
   *Recommendation*: Default to no (v1). Zustand `persist` handles reload, but cross-tab synchronization adds complexity with IndexedDB/BroadcastChannel.
2. **Midnight Rollover**: What happens to running timers crossing midnight?
   *Recommendation*: Let them keep running; the session will be attached to the task's assigned date regardless of actual finish time.
3. **Outlier Prompt Handling**: Should the drawer stay open while the Outlier prompt is visible?
   *Recommendation*: The prompt should be a modal overlay above the drawer, so the drawer state doesn't matter.

## 9. Decisions (approved by user — treat as settled)
1. Two actions: **Stop session** (log session, task stays open) and **Complete task** (log session, mark completed, write CompletionRecord).
2. A completed task's `actualMinutes` = **sum of `activeDurationMs` of all its non-excluded sessions** (including the final one). This feeds the future calibration engine.
3. Timers crossing midnight keep running; the session counts toward the task's `scheduledDate`.
4. No cross-tab sync in v1; reload persistence only.
5. Outlier prompt: modal overlay above everything. Trigger: when completing a task, total actual minutes > 2.5 × `nominalMinutes`. Accept / Adjust / Exclude apply to the session just finished.
6. Test IDs contain nanoid task IDs the tests can't know in advance. Tests should find cards by visible title text, then read the id from the `data-testid` suffix (or use `[data-testid^="task-card-"]` + `hasText`).

## 10. ADDENDUM — Timed Subtasks (approved by user, supersedes earlier sections where they conflict)

User decisions:
- Each subtask can be timed on its own (start/pause/stop), and its sessions are logged like task sessions.
- **Checked subtasks stay visible** (styled as done, e.g. strikethrough). They are not hidden, removed, or moved to another list. They can be unchecked.
- **When a task is completed, show a time split**: time per subtask, plus time logged on the task itself without a subtask ("General").

Coordinator defaults (user may still veto; implement these unless told otherwise):
1. **Timer key**: a timer targets either a task or one of its subtasks. Key = `taskId` for task-level, `taskId:subtaskId` for a subtask. `TimerInstance` gains `subtaskId?: string` (plus `subtaskTitle` for display).
2. **One timer per task at a time**: multitasking is across *different tasks*. Within one task, only one timer (task-level OR one subtask) runs. Starting another timer in the same task first runs **Stop session** on the current one, so time is never double-counted.
3. **Checking a subtask** while its timer runs stops that session (logs it). Checking never deletes data.
4. **Completing the task** stops any running timer for that task (logs it), then completes.
5. **Data**: `TimerSession` gains `subtaskId?: string` and `subtaskTitle?: string` (a snapshot, so the history survives renames and deletes). Add a Dexie index on `subtaskId` (schema version bump). `CompletionRecord` gains `splits: { subtaskId?: string; title: string; minutes: number }[]` (one entry per subtask with logged time, plus a "General" entry for task-level time if any). `actualMinutes` remains the total of all non-excluded sessions.
6. **Split display**: the TaskCard's expandable section shows the split for completed tasks: per-row title, minutes, % of total, and a simple proportional bar. While the task is in progress, the same breakdown can show live totals so far. The session timeline lists every session, labelled with its subtask (or "General").
7. **Drawer rows** show `Task title › Subtask title` for subtask timers.
8. **Deleting a subtask** keeps its sessions (shown via the title snapshot). A running timer for a deleted subtask is discarded.
9. Out of scope for now: per-subtask time estimates and per-subtask calibration. The data above is enough to add them later.

Test contract additions (`data-testid`):
| Element | `data-testid` |
|---|---|
| Subtask row on card | `subtask-row-<subtaskId>` |
| Subtask checkbox | `subtask-check-<subtaskId>` |
| Subtask start-timer button | `subtask-start-btn-<subtaskId>` |
| Add-subtask input (form and/or card) | `subtask-add-input` |
| Split row (completed summary) | `split-row` (contains title text and minutes text) |
| Drawer timer row (subtask timer) | `drawer-timer-row-<taskId>` (same, one row per task since one timer per task) |
