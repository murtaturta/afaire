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
    () => db.timerSessions.where('taskId').equals(taskId).sortBy('startedAt'),
    [taskId]
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
