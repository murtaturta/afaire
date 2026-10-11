import { nanoid } from 'nanoid';
import { db } from './schema';
import type { Task } from './types';
import { calculatePaceCalibration } from '@/lib/calibration/engine';

export async function createTask(data: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>): Promise<Task> {
  const now = new Date().toISOString();
  let calibratedMinutes = data.calibratedMinutes;
  if (!calibratedMinutes) {
    const pace = await calculatePaceCalibration(data.nominalMinutes, {
      title: data.title,
      tags: data.tags,
      templateId: data.templateId,
    });
    calibratedMinutes = pace.calibratedMinutes;
  }

  const task: Task = {
    ...data,
    calibratedMinutes,
    id: nanoid(),
    createdAt: now,
    updatedAt: now,
  };
  await db.tasks.add(task);
  return task;
}

export async function getTask(id: string): Promise<Task | undefined> {
  return db.tasks.get(id);
}

export async function updateTask(id: string, updates: Partial<Task>): Promise<void> {
  const now = new Date().toISOString();
  const existing = await db.tasks.get(id);
  const finalUpdates: Partial<Task> = { ...updates, updatedAt: now };

  if (
    existing &&
    (updates.nominalMinutes || updates.title || updates.tags) &&
    !updates.calibratedMinutes
  ) {
    const nominal = updates.nominalMinutes || existing.nominalMinutes;
    const title = updates.title || existing.title;
    const tags = updates.tags || existing.tags;
    const templateId = updates.templateId || existing.templateId;
    const pace = await calculatePaceCalibration(nominal, { title, tags, templateId });
    finalUpdates.calibratedMinutes = pace.calibratedMinutes;
  }

  await db.tasks.update(id, finalUpdates);
}

import { useTimerStore } from '@/stores/timerStore';

export async function deleteTask(id: string): Promise<void> {
  // discard running timer if any
  useTimerStore.getState().discardTimer(id);
  await db.tasks.delete(id);
}

export async function getTasksByDate(date: string): Promise<Task[]> {
  const tasks = await db.tasks.where('scheduledDate').equals(date).toArray();
  return tasks.sort((a, b) => (a.scheduledOrder || 0) - (b.scheduledOrder || 0));
}

export async function getAllTasks(): Promise<Task[]> {
  return db.tasks.toArray();
}

export async function getTasksByStatus(status: Task['status']): Promise<Task[]> {
  return db.tasks.where('status').equals(status).toArray();
}

export async function reorderTasks(taskIds: string[]): Promise<void> {
  const now = new Date().toISOString();
  await Promise.all(
    taskIds.map((id, index) =>
      db.tasks.update(id, { scheduledOrder: index, updatedAt: now })
    )
  );
}
