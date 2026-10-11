import { createSession, updateSession, getSessionsByTask, deleteSession } from '@/lib/db/sessions';
import { updateTask, getTask } from '@/lib/db/tasks';
import { addCompletionRecord, getHistoryByTask, updateCompletionRecord } from '@/lib/db/history';
import { useTimerStore } from '@/stores/timerStore';
import type { TimerSession, CompletionRecord, Task, Subtask } from '@/lib/db/types';
import { recalibratePendingTasks } from '@/lib/calibration/engine';

function getTimeOfDay(date: Date): 'morning' | 'afternoon' | 'evening' {
  const hour = date.getHours();
  if (hour < 12) return 'morning';
  if (hour < 18) return 'afternoon';
  return 'evening';
}

export async function stopSession(taskId: string): Promise<TimerSession | null> {
  const sessionData = useTimerStore.getState().stopTimer(taskId);
  if (!sessionData) return null;

  const now = new Date();
  
  return await createSession({
    taskId: sessionData.taskId,
    subtaskId: sessionData.subtaskId,
    subtaskTitle: sessionData.subtaskTitle,
    startedAt: new Date(sessionData.startedAt).toISOString(),
    endedAt: now.toISOString(),
    rawDurationMs: sessionData.rawDurationMs,
    activeDurationMs: sessionData.activeDurationMs,
    pausedDurations: sessionData.pausedDurations,
    isOutlier: false,
    excludeFromHistory: false,
  });
}

export async function startSession(task: Task, subtaskId?: string, subtaskTitle?: string) {
  const store = useTimerStore.getState();
  const current = store.timers[task.id];
  
  if (current && current.subtaskId !== subtaskId) {
    await stopSession(task.id);
  }

  // Calculate past accumulated active time for this task/subtask
  const allSessions = await getSessionsByTask(task.id);
  let baseElapsedMs = 0;
  for (const s of allSessions) {
    if (s.excludeFromHistory) continue;
    const ms = s.adjustedDurationMs ?? s.activeDurationMs;
    if (subtaskId) {
      if (s.subtaskId === subtaskId) {
        baseElapsedMs += ms;
      }
    } else {
      baseElapsedMs += ms;
    }
  }

  store.startTimer(task, subtaskId, subtaskTitle, baseElapsedMs);
}

export function computeTaskSplit(sessions: TimerSession[], subtasks: Subtask[]) {
  const splits = new Map<string, number>();
  let generalMs = 0;

  for (const s of sessions) {
    if (s.excludeFromHistory) continue;
    const ms = s.adjustedDurationMs ?? s.activeDurationMs;
    if (s.subtaskId) {
      splits.set(s.subtaskId, (splits.get(s.subtaskId) || 0) + ms);
    } else {
      generalMs += ms;
    }
  }

  const result: { subtaskId?: string; title: string; minutes: number }[] = [];

  for (const st of subtasks) {
    const ms = splits.get(st.id) || 0;
    if (ms > 0) {
      result.push({
        subtaskId: st.id,
        title: st.title,
        minutes: ms / 60000,
      });
    }
    splits.delete(st.id);
  }

  // Any remaining subtask sessions that might have been deleted from task
  for (const [id, ms] of splits.entries()) {
    const session = sessions.find(s => s.subtaskId === id);
    result.push({
      subtaskId: id,
      title: session?.subtaskTitle || 'Deleted subtask',
      minutes: ms / 60000,
    });
  }

  if (generalMs > 0) {
    result.push({
      title: 'General',
      minutes: generalMs / 60000,
    });
  }

  return result;
}

export async function completeTask(taskId: string, nominalMinutes: number) {
  // 1. stop session if running
  const session = await stopSession(taskId);
  
  // 2. update task status
  const now = new Date();
  await updateTask(taskId, {
    status: 'completed',
    completedAt: now.toISOString()
  });

  // 3. fetch all sessions for task
  const allSessions = await getSessionsByTask(taskId);
  const task = await getTask(taskId);
  const subtasks = task?.subtasks || [];
  
  // sum non-excluded
  let totalActiveMs = 0;
  for (const s of allSessions) {
    if (!s.excludeFromHistory) {
      totalActiveMs += (s.adjustedDurationMs ?? s.activeDurationMs);
    }
  }

  const actualMinutes = totalActiveMs / 60000;

  // A task completed without ever being timed has no real duration data.
  // Writing a 0-minute record would teach the calibration engine the task takes no time.
  if (allSessions.length === 0) {
    return { session, record: null, isOutlier: false, actualMinutes: 0 };
  }

  const isOutlier = actualMinutes > 2.5 * nominalMinutes;

  if (session && isOutlier) {
      await updateSession(session.id, { isOutlier: true });
      session.isOutlier = true;
  }

  const splits = computeTaskSplit(allSessions, subtasks);

  // Local yyyy-MM-dd. Per the approved design, a session counts toward the task's scheduled day
  // (e.g. a timer running past midnight), so prefer scheduledDate.
  const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const recordDate = task?.scheduledDate ?? localDate;
  const [y, m, d] = recordDate.split('-').map(Number);

  const recordData = {
    taskId,
    templateId: task?.templateId,
    sessionId: session ? session.id : allSessions[allSessions.length - 1].id,
    date: recordDate,
    dayOfWeek: new Date(y, m - 1, d).getDay(),
    timeOfDay: getTimeOfDay(now),
    nominalMinutes,
    actualMinutes,
    ratio: nominalMinutes > 0 ? actualMinutes / nominalMinutes : 1,
    splits,
  };

  // 4. completion record: one per task. If the task was un-completed and completed again,
  // update the existing record instead of adding a duplicate (duplicates would double-weight it).
  const existing = await getHistoryByTask(taskId);
  let record: CompletionRecord;
  if (existing.length > 0) {
    await updateCompletionRecord(existing[0].id, recordData);
    record = { ...existing[0], ...recordData };
  } else {
    record = await addCompletionRecord(recordData);
  }

  // Trigger learning loop for pending tasks if this wasn't an unreviewed outlier
  if (!isOutlier) {
    await recalibratePendingTasks();
  }

  return {
    session,
    record,
    isOutlier,
    actualMinutes
  };
}

export async function applyOutlierChoice(
  sessionId: string, 
  taskId: string, 
  choice: 'accept' | 'adjust' | 'exclude', 
  adjustedMinutes?: number
) {
  const updates: Partial<TimerSession> = { isOutlier: false };
  
  if (choice === 'exclude') {
    updates.excludeFromHistory = true;
  } else if (choice === 'adjust' && adjustedMinutes !== undefined) {
    updates.adjustedDurationMs = adjustedMinutes * 60000;
  }
  
  await updateSession(sessionId, updates);

  // Recompute actualMinutes for the task
  const allSessions = await getSessionsByTask(taskId);
  const task = await getTask(taskId);
  const subtasks = task?.subtasks || [];
  
  let totalActiveMs = 0;
  for (const s of allSessions) {
    if (!s.excludeFromHistory) {
      totalActiveMs += (s.adjustedDurationMs ?? s.activeDurationMs);
    }
  }
  const actualMinutes = totalActiveMs / 60000;
  const splits = computeTaskSplit(allSessions, subtasks);

  // Update completion record
  const records = await getHistoryByTask(taskId);
  const record = records.find(r => r.sessionId === sessionId) || records[records.length - 1];
  
  if (record) {
    await updateCompletionRecord(record.id, {
      actualMinutes,
      ratio: record.nominalMinutes > 0 ? actualMinutes / record.nominalMinutes : 1,
      splits,
    });
  }

  await recalibratePendingTasks();
}

export async function toggleSubtaskDone(taskId: string, subtaskId: string, done: boolean) {
  const store = useTimerStore.getState();
  const current = store.timers[taskId];
  const wasSubtaskTimerActive = done && current && current.subtaskId === subtaskId;
  
  if (wasSubtaskTimerActive) {
    await stopSession(taskId);
  }

  const task = await getTask(taskId);
  if (task) {
    const updatedSubtasks = task.subtasks.map(st => 
      st.id === subtaskId ? { ...st, done } : st
    );
    await updateTask(taskId, { subtasks: updatedSubtasks });

    // When a subtask completes while its timer was running, seamlessly continue tracking the parent task from total accumulated time
    if (wasSubtaskTimerActive) {
      const allSessions = await getSessionsByTask(taskId);
      const totalAccumulatedMs = allSessions
        .filter(s => !s.excludeFromHistory)
        .reduce((sum, s) => sum + (s.adjustedDurationMs ?? s.activeDurationMs), 0);

      store.startTimer(task, undefined, undefined, totalAccumulatedMs);
    }
  }
}

export async function syncTaskHistoryRecords(taskId: string) {
  const allSessions = await getSessionsByTask(taskId);
  const task = await getTask(taskId);
  if (!task) return;
  const subtasks = task.subtasks || [];

  let totalActiveMs = 0;
  for (const s of allSessions) {
    if (!s.excludeFromHistory) {
      totalActiveMs += (s.adjustedDurationMs ?? s.activeDurationMs);
    }
  }
  const actualMinutes = totalActiveMs / 60000;
  const splits = computeTaskSplit(allSessions, subtasks);

  const records = await getHistoryByTask(taskId);
  if (records.length > 0) {
    for (const record of records) {
      await updateCompletionRecord(record.id, {
        actualMinutes,
        ratio: record.nominalMinutes > 0 ? actualMinutes / record.nominalMinutes : 1,
        splits,
      });
    }
  }
}

export async function editSessionTimecodes(
  sessionId: string,
  taskId: string,
  startedAt: string,
  endedAt: string,
  subtaskId?: string,
  subtaskTitle?: string
) {
  const startMs = new Date(startedAt).getTime();
  const endMs = new Date(endedAt).getTime();
  const durationMs = Math.max(0, endMs - startMs);

  await updateSession(sessionId, {
    startedAt,
    endedAt,
    rawDurationMs: durationMs,
    activeDurationMs: durationMs,
    adjustedDurationMs: undefined,
    subtaskId: subtaskId || undefined,
    subtaskTitle: subtaskTitle || undefined,
  });

  await syncTaskHistoryRecords(taskId);
}

export async function deleteSessionRecord(sessionId: string, taskId: string) {
  await deleteSession(sessionId);
  await syncTaskHistoryRecords(taskId);
}

export async function addManualSession(
  taskId: string,
  startedAt: string,
  endedAt: string,
  subtaskId?: string,
  subtaskTitle?: string
): Promise<TimerSession> {
  const startMs = new Date(startedAt).getTime();
  const endMs = new Date(endedAt).getTime();
  const durationMs = Math.max(0, endMs - startMs);

  const session = await createSession({
    taskId,
    subtaskId: subtaskId || undefined,
    subtaskTitle: subtaskTitle || undefined,
    startedAt,
    endedAt,
    rawDurationMs: durationMs,
    activeDurationMs: durationMs,
    pausedDurations: [],
    isOutlier: false,
    excludeFromHistory: false,
  });

  await syncTaskHistoryRecords(taskId);
  return session;
}
