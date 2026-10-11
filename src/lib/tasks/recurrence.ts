import { nanoid } from 'nanoid';
import { db } from '@/lib/db/schema';
import { calculatePaceCalibration } from '@/lib/calibration/engine';
import type { Task } from '@/lib/db/types';

/**
 * Checks if a recurrence rule applies to the specified date.
 */
export function doesRuleApplyToDate(rule: string, targetDateStr: string, originDateStr?: string): boolean {
  const [y, m, d] = targetDateStr.split('-').map(Number);
  const targetDate = new Date(Date.UTC(y, m - 1, d));
  const dayOfWeek = targetDate.getUTCDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  const dayOfMonth = d;

  const normalizedRule = rule.toLowerCase().trim();

  if (normalizedRule === 'daily') {
    return true;
  }

  if (normalizedRule === 'weekdays') {
    return dayOfWeek >= 1 && dayOfWeek <= 5;
  }

  if (normalizedRule === 'weekly') {
    if (!originDateStr) return true;
    const [oy, om, od] = originDateStr.split('-').map(Number);
    const originDate = new Date(Date.UTC(oy, om - 1, od));
    return dayOfWeek === originDate.getUTCDay();
  }

  if (normalizedRule === 'monthly') {
    if (!originDateStr) return true;
    const [, , od] = originDateStr.split('-').map(Number);
    return dayOfMonth === od;
  }

  return true;
}

/**
 * Automatically evaluates recurring task definitions and generates today's instances
 * with calibrated minutes based on historical pace.
 */
export async function processRecurringTasksForDate(targetDateStr: string): Promise<Task[]> {
  const allTasks = await db.tasks.toArray();
  const recurringTemplates = allTasks.filter((t) => t.isRecurring && t.recurrenceRule);

  if (recurringTemplates.length === 0) return [];

  const createdTasks: Task[] = [];
  const now = new Date().toISOString();

  for (const template of recurringTemplates) {
    const originDate = template.scheduledDate || template.createdAt.split('T')[0];
    const applies = doesRuleApplyToDate(template.recurrenceRule!, targetDateStr, originDate);

    if (!applies) continue;

    // Check if an instance already exists for this template on targetDate
    const alreadyExists = allTasks.some(
      (t) =>
        (t.templateId === template.id || t.id === template.id) &&
        t.scheduledDate === targetDateStr
    );

    if (alreadyExists) continue;

    // Calculate pace calibration based on historical template completion records
    const pace = await calculatePaceCalibration(template.nominalMinutes, {
      title: template.title,
      tags: template.tags,
      templateId: template.id,
    });

    // Create fresh task instance for today
    const newInstance: Task = {
      id: nanoid(),
      templateId: template.id,
      title: template.title,
      description: template.description,
      tags: [...(template.tags || [])],
      subtasks: (template.subtasks || []).map((st) => ({
        id: nanoid(),
        title: st.title,
        done: false,
      })),
      nominalMinutes: template.nominalMinutes,
      calibratedMinutes: pace.calibratedMinutes,
      isRecurring: false,
      scheduledDate: targetDateStr,
      timeSlotPreference: template.timeSlotPreference,
      status: 'pending',
      color: template.color,
      createdAt: now,
      updatedAt: now,
    };

    await db.tasks.add(newInstance);
    createdTasks.push(newInstance);
  }

  return createdTasks;
}
