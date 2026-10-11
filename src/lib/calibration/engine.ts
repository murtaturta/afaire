import { db } from '@/lib/db/schema';
import { getSettings } from '@/lib/db/settings';
import type { Task, CompletionRecord } from '@/lib/db/types';

export interface PaceCalibrationResult {
  ratio: number;
  calibratedMinutes: number;
  sampleCount: number;
  source: 'template' | 'title' | 'tag' | 'global' | 'default';
}

/**
 * Calculates exponential moving average (EMA) of completion ratios.
 * Chronologically applies alpha to give more weight to recent performance.
 */
export function calculateEmaRatio(ratios: number[], alpha: number = 0.3): number {
  if (ratios.length === 0) return 1.0;
  if (ratios.length === 1) return ratios[0];

  let ema = ratios[0];
  for (let i = 1; i < ratios.length; i++) {
    ema = alpha * ratios[i] + (1 - alpha) * ema;
  }
  return ema;
}

/**
 * Filters out extreme outliers from completion records
 */
export function filterOutliers(records: CompletionRecord[], thresholdSigma: number = 2.0): CompletionRecord[] {
  if (records.length < 4) {
    // For small sample sizes, simply filter out extreme bounds (> 2.5x or < 0.2x)
    return records.filter((r) => r.ratio >= 0.2 && r.ratio <= 2.5);
  }

  const ratios = records.map((r) => r.ratio);
  const mean = ratios.reduce((a, b) => a + b, 0) / ratios.length;
  const variance =
    ratios.reduce((acc, r) => acc + Math.pow(r - mean, 2), 0) / ratios.length;
  const stdDev = Math.sqrt(variance);

  const lowerBound = Math.max(0.2, mean - thresholdSigma * stdDev);
  const upperBound = Math.min(3.0, mean + thresholdSigma * stdDev);

  return records.filter((r) => r.ratio >= lowerBound && r.ratio <= upperBound);
}

/**
 * Computes learned pace ratio using hierarchical matching:
 * 1. Matching templateId
 * 2. Matching title (case-insensitive)
 * 3. Matching tags
 * 4. Global user pace across all tasks
 * 5. Default 1.0
 */
export async function calculatePaceCalibration(
  nominalMinutes: number,
  params: {
    title?: string;
    tags?: string[];
    templateId?: string;
  } = {}
): Promise<PaceCalibrationResult> {
  const settings = await getSettings();
  const alpha = settings.emaAlpha ?? 0.3;
  const sigma = settings.outlierThresholdSigma ?? 2.0;

  const allRecords = await db.completionRecords.toArray();

  if (allRecords.length === 0) {
    return {
      ratio: 1.0,
      calibratedMinutes: nominalMinutes,
      sampleCount: 0,
      source: 'default',
    };
  }

  // 1. Check template match
  if (params.templateId) {
    const templateRecords = allRecords.filter((r) => r.templateId === params.templateId);
    if (templateRecords.length > 0) {
      const valid = filterOutliers(templateRecords, sigma);
      const sorted = valid.sort((a, b) => a.date.localeCompare(b.date));
      const ratio = calculateEmaRatio(sorted.map((r) => r.ratio), alpha);
      const calibratedMinutes = Math.max(5, Math.round(nominalMinutes * ratio));
      return {
        ratio,
        calibratedMinutes,
        sampleCount: valid.length,
        source: 'template',
      };
    }
  }

  // 2. Check title match (case-insensitive)
  if (params.title && params.title.trim()) {
    const cleanTitle = params.title.trim().toLowerCase();
    const taskIdsWithSameTitle = new Set(
      (await db.tasks.toArray())
        .filter((t) => t.title.trim().toLowerCase() === cleanTitle)
        .map((t) => t.id)
    );

    const titleRecords = allRecords.filter((r) => taskIdsWithSameTitle.has(r.taskId));
    if (titleRecords.length > 0) {
      const valid = filterOutliers(titleRecords, sigma);
      const sorted = valid.sort((a, b) => a.date.localeCompare(b.date));
      const ratio = calculateEmaRatio(sorted.map((r) => r.ratio), alpha);
      const calibratedMinutes = Math.max(5, Math.round(nominalMinutes * ratio));
      return {
        ratio,
        calibratedMinutes,
        sampleCount: valid.length,
        source: 'title',
      };
    }
  }

  // 3. Check tag match
  if (params.tags && params.tags.length > 0) {
    const targetTags = new Set(params.tags.map((t) => t.toLowerCase()));
    const taskIdsWithTags = new Set(
      (await db.tasks.toArray())
        .filter((t) => t.tags && t.tags.some((tag) => targetTags.has(tag.toLowerCase())))
        .map((t) => t.id)
    );

    const tagRecords = allRecords.filter((r) => taskIdsWithTags.has(r.taskId));
    if (tagRecords.length > 0) {
      const valid = filterOutliers(tagRecords, sigma);
      const sorted = valid.sort((a, b) => a.date.localeCompare(b.date));
      const ratio = calculateEmaRatio(sorted.map((r) => r.ratio), alpha);
      const calibratedMinutes = Math.max(5, Math.round(nominalMinutes * ratio));
      return {
        ratio,
        calibratedMinutes,
        sampleCount: valid.length,
        source: 'tag',
      };
    }
  }

  // 4. Global pace across all user completed records
  const validGlobal = filterOutliers(allRecords, sigma);
  if (validGlobal.length > 0) {
    const sorted = validGlobal.sort((a, b) => a.date.localeCompare(b.date));
    const ratio = calculateEmaRatio(sorted.map((r) => r.ratio), alpha);
    const calibratedMinutes = Math.max(5, Math.round(nominalMinutes * ratio));
    return {
      ratio,
      calibratedMinutes,
      sampleCount: validGlobal.length,
      source: 'global',
    };
  }

  return {
    ratio: 1.0,
    calibratedMinutes: nominalMinutes,
    sampleCount: 0,
    source: 'default',
  };
}

/**
 * Calibrates a task and updates its calibratedMinutes in IndexedDB
 */
export async function calibrateTaskRecord(task: Task): Promise<number> {
  const { calibratedMinutes } = await calculatePaceCalibration(task.nominalMinutes, {
    title: task.title,
    tags: task.tags,
    templateId: task.templateId,
  });

  if (task.calibratedMinutes !== calibratedMinutes) {
    await db.tasks.update(task.id, { calibratedMinutes });
  }

  return calibratedMinutes;
}

/**
 * Recalibrates all pending/active tasks whenever new completion history is recorded
 */
export async function recalibratePendingTasks(): Promise<void> {
  const pendingTasks = await db.tasks
    .filter((t) => t.status === 'pending' || t.status === 'active' || t.status === 'rolled-over')
    .toArray();

  for (const task of pendingTasks) {
    await calibrateTaskRecord(task);
  }
}
