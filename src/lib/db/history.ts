import { nanoid } from 'nanoid';
import { db } from './schema';
import type { CompletionRecord } from './types';

export async function addCompletionRecord(data: Omit<CompletionRecord, 'id'>): Promise<CompletionRecord> {
  const record: CompletionRecord = {
    ...data,
    id: nanoid(),
  };
  await db.completionRecords.add(record);
  return record;
}

export async function updateCompletionRecord(id: string, updates: Partial<CompletionRecord>): Promise<void> {
  await db.completionRecords.update(id, updates);
}

export async function getHistoryByTemplate(templateId: string): Promise<CompletionRecord[]> {
  return db.completionRecords.where('templateId').equals(templateId).toArray();
}

export async function getHistoryByTask(taskId: string): Promise<CompletionRecord[]> {
  return db.completionRecords.where('taskId').equals(taskId).toArray();
}

export async function getHistoryByDateRange(startDate: string, endDate: string): Promise<CompletionRecord[]> {
  return db.completionRecords
    .where('date')
    .between(startDate, endDate, true, true)
    .toArray();
}

export async function getRecentHistory(templateId: string, limit: number = 20): Promise<CompletionRecord[]> {
  return db.completionRecords
    .where('templateId')
    .equals(templateId)
    .reverse()
    .sortBy('date')
    .then(records => records.slice(0, limit));
}
