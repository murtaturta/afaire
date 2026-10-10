import { createSession, updateSession, getSessionsByTask } from '@/lib/db/sessions';
import { updateTask, getTask } from '@/lib/db/tasks';
import { addCompletionRecord, getHistoryByTask, updateCompletionRecord } from '@/lib/db/history';
import { useTimerStore } from '@/stores/timerStore';
import type { TimerSession, CompletionRecord, Task, Subtask } from '@/lib/db/types';

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

  store.startTimer(task, subtaskId, subtaskTitle);
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
  const isOutlier = actualMinutes > 2.5 * nominalMinutes;

  if (session && isOutlier) {
      await updateSession(session.id, { isOutlier: true });
      session.isOutlier = true;
  }

  const splits = computeTaskSplit(allSessions, subtasks);

  // 4. completion record
  const record = await addCompletionRecord({
    taskId,
    sessionId: session ? session.id : 'no-session',
    date: now.toISOString(),
    dayOfWeek: now.getDay(),
    timeOfDay: getTimeOfDay(now),
    nominalMinutes,
    actualMinutes,
    ratio: nominalMinutes > 0 ? actualMinutes / nominalMinutes : 1,
    splits,
  });

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
}

export async function toggleSubtaskDone(taskId: string, subtaskId: string, done: boolean) {
  const store = useTimerStore.getState();
  const current = store.timers[taskId];
  
  if (done && current && current.subtaskId === subtaskId) {
    await stopSession(taskId);
  }

  const task = await getTask(taskId);
  if (task) {
    const updatedSubtasks = task.subtasks.map(st => 
      st.id === subtaskId ? { ...st, done } : st
    );
    await updateTask(taskId, { subtasks: updatedSubtasks });
  }
}
