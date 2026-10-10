import Dexie, { type Table } from 'dexie';
import type { Task, TimerSession, CompletionRecord, UserSettings } from './types';

export class TempoDoDatabase extends Dexie {
  tasks!: Table<Task, string>;
  timerSessions!: Table<TimerSession, string>;
  completionRecords!: Table<CompletionRecord, string>;
  settings!: Table<UserSettings, string>;

  constructor() {
    super('TempoDoDB');
    this.version(1).stores({
      tasks: 'id, scheduledDate, templateId, status',
      timerSessions: 'id, taskId',
      completionRecords: 'id, taskId, templateId, date',
      settings: 'id'
    });
  }
}

export const db = new TempoDoDatabase();
