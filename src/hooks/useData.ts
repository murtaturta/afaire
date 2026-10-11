import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db/schema';
import { computeTaskSplit } from '@/lib/timer/sessionService';

export function useTasksForDate(date: string) {
  return useLiveQuery(
    () => db.tasks.where('scheduledDate').equals(date).toArray()
      .then(tasks => tasks.sort((a, b) => (a.scheduledOrder || 0) - (b.scheduledOrder || 0))),
    [date]
  );
}

export function useTaskSessions(taskId: string) {
  return useLiveQuery(
    () => db.timerSessions.where('taskId').equals(taskId).toArray()
      .then(sessions => sessions.sort((a, b) => a.startedAt.localeCompare(b.startedAt))),
    [taskId]
  );
}

export function useSessionsForDate(date: string) {
  return useLiveQuery(
    () => db.timerSessions.filter(s => s.startedAt.startsWith(date)).toArray(),
    [date]
  );
}

export function useTaskSplit(taskId: string) {
  return useLiveQuery(
    async () => {
      const sessions = await db.timerSessions.where('taskId').equals(taskId).toArray();
      const task = await db.tasks.get(taskId);
      if (!task) return [];
      return computeTaskSplit(sessions, task.subtasks || []);
    },
    [taskId]
  );
}

export function useAllSessions() {
  return useLiveQuery(() => db.timerSessions.toArray(), []);
}

export function useAllTasks() {
  return useLiveQuery(() => db.tasks.toArray(), []);
}

export function useAllCompletionRecords() {
  return useLiveQuery(() => db.completionRecords.toArray(), []);
}

export function useUserSettings() {
  return useLiveQuery(async () => {
    const s = await db.settings.get('user-settings');
    if (s) return s;
    return {
      id: 'user-settings',
      dailyCapacityHours: 6,
      bufferPercent: 15,
      emaAlpha: 0.3,
      outlierThresholdSigma: 2.0,
      theme: 'system' as const,
    };
  }, []);
}
