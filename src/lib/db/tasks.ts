import { nanoid } from 'nanoid';
import { db } from './schema';
import type { Task } from './types';

export async function createTask(data: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>): Promise<Task> {
  const now = new Date().toISOString();
  const task: Task = {
    ...data,
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
  await db.tasks.update(id, { ...updates, updatedAt: now });
}

export async function deleteTask(id: string): Promise<void> {
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
