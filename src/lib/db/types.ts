export interface Task {
  id: string;
  title: string;
  description?: string;
  tags: string[];
  subtasks: Subtask[];
  nominalMinutes: number;
  calibratedMinutes?: number;
  isRecurring: boolean;
  recurrenceRule?: string;
  scheduledDate?: string;
  scheduledOrder?: number;
  timeSlotPreference?: 'morning' | 'afternoon' | 'evening' | 'any';
  status: 'pending' | 'active' | 'completed' | 'skipped' | 'rolled-over';
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
  templateId?: string;
  color?: string;
}

export interface Subtask {
  id: string;
  title: string;
  done: boolean;
}

export interface TimerSession {
  id: string;
  taskId: string;
  subtaskId?: string;
  subtaskTitle?: string;
  startedAt: string;
  endedAt?: string;
  pausedDurations: number[];
  rawDurationMs: number;
  activeDurationMs: number;
  adjustedDurationMs?: number;
  isOutlier: boolean;
  excludeFromHistory: boolean;
}

export interface CompletionRecord {
  id: string;
  taskId: string;
  templateId?: string;
  sessionId: string;
  date: string;
  dayOfWeek: number;
  timeOfDay: 'morning' | 'afternoon' | 'evening';
  nominalMinutes: number;
  actualMinutes: number;
  ratio: number;
  splits: { subtaskId?: string; title: string; minutes: number }[];
}

export interface UserSettings {
  id: string;
  dailyCapacityHours: number;
  bufferPercent: number;
  emaAlpha: number;
  outlierThresholdSigma: number;
  geminiApiKey?: string;
  theme: 'light' | 'dark' | 'system';
}
