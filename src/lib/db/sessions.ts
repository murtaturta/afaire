import { nanoid } from 'nanoid';
import { db } from './schema';
import type { TimerSession } from './types';

export async function createSession(data: Omit<TimerSession, 'id'>): Promise<TimerSession> {
  const session: TimerSession = {
    ...data,
    id: nanoid(),
  };
  await db.timerSessions.add(session);
  return session;
}

export async function getSession(id: string): Promise<TimerSession | undefined> {
  return db.timerSessions.get(id);
}

export async function updateSession(id: string, updates: Partial<TimerSession>): Promise<void> {
  await db.timerSessions.update(id, updates);
}

export async function getSessionsByTask(taskId: string): Promise<TimerSession[]> {
  return db.timerSessions.where('taskId').equals(taskId).toArray();
}

export async function deleteSession(id: string): Promise<void> {
  await db.timerSessions.delete(id);
}
