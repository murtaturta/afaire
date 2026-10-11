import { exportAllData, importBackupData } from './backup';

export interface SnapshotMeta {
  id: string;
  createdAt: string;
  reason: string;
  tasksCount: number;
  sessionsCount: number;
  recordsCount: number;
  data: string; // Serialized JSON backup string
}

const STORAGE_KEY = 'afaire_rolling_snapshots';
const MAX_SNAPSHOTS = 5;

/**
 * Retrieves all stored rolling snapshots (newest first).
 */
export function getRollingSnapshots(): SnapshotMeta[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

/**
 * Creates and stores a new rolling snapshot. Maintains maximum of MAX_SNAPSHOTS.
 */
export async function createRollingSnapshot(reason: string = 'Automatic snapshot'): Promise<SnapshotMeta | null> {
  if (typeof window === 'undefined') return null;

  try {
    const backup = await exportAllData();
    const snapshot: SnapshotMeta = {
      id: `snap_${Date.now()}`,
      createdAt: backup.exportedAt,
      reason,
      tasksCount: backup.tasks.length,
      sessionsCount: backup.timerSessions.length,
      recordsCount: backup.completionRecords.length,
      data: JSON.stringify(backup),
    };

    const existing = getRollingSnapshots();
    // Prepend new snapshot and slice to max
    const updated = [snapshot, ...existing].slice(0, MAX_SNAPSHOTS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

    return snapshot;
  } catch {
    return null;
  }
}

/**
 * Restores the database from a specified rolling snapshot ID.
 */
export async function restoreRollingSnapshot(id: string): Promise<{ tasksCount: number; sessionsCount: number }> {
  const snapshots = getRollingSnapshots();
  const target = snapshots.find((s) => s.id === id);
  if (!target) {
    throw new Error('Snapshot not found');
  }

  return await importBackupData(target.data);
}

/**
 * Checks if a daily snapshot has been taken today, and creates one if needed.
 */
export async function ensureDailySnapshot(): Promise<void> {
  if (typeof window === 'undefined') return;

  const todayStr = new Date().toISOString().split('T')[0];
  const snapshots = getRollingSnapshots();
  const hasSnapshotToday = snapshots.some((s) => s.createdAt.startsWith(todayStr));

  if (!hasSnapshotToday) {
    await createRollingSnapshot('Daily automatic safeguard');
  }
}
