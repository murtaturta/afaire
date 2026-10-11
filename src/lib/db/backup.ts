import { db } from './schema';
import type { Task, TimerSession, CompletionRecord, UserSettings } from './types';

export interface BackupData {
  version: number;
  exportedAt: string;
  tasks: Task[];
  timerSessions: TimerSession[];
  completionRecords: CompletionRecord[];
  settings?: UserSettings[];
}

export async function exportAllData(): Promise<BackupData> {
  const [tasks, timerSessions, completionRecords, settings] = await Promise.all([
    db.tasks.toArray(),
    db.timerSessions.toArray(),
    db.completionRecords.toArray(),
    db.settings.toArray(),
  ]);

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    tasks,
    timerSessions,
    completionRecords,
    settings,
  };
}

export async function downloadBackupJson() {
  const data = await exportAllData();
  const jsonStr = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const dateStr = new Date().toISOString().split('T')[0];
  link.href = url;
  link.setAttribute('download', `afaire-backup-${dateStr}.json`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function importBackupData(jsonStr: string): Promise<{ tasksCount: number; sessionsCount: number }> {
  const data: BackupData = JSON.parse(jsonStr);

  if (!data.tasks || !Array.isArray(data.tasks)) {
    throw new Error('Invalid backup file format: missing tasks array');
  }

  await db.transaction('rw', [db.tasks, db.timerSessions, db.completionRecords], async () => {
    if (data.tasks.length > 0) {
      await db.tasks.bulkPut(data.tasks);
    }
    if (data.timerSessions && data.timerSessions.length > 0) {
      await db.timerSessions.bulkPut(data.timerSessions);
    }
    if (data.completionRecords && data.completionRecords.length > 0) {
      await db.completionRecords.bulkPut(data.completionRecords);
    }
  });

  return {
    tasksCount: data.tasks.length,
    sessionsCount: data.timerSessions?.length || 0,
  };
}
