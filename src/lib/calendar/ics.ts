import { Task, TimerSession } from '@/lib/db/types';
import { formatDuration, formatMinutes } from '@/lib/utils/duration';

export interface IcsOptions {
  includeSessions?: boolean;
  includePlannedTasks?: boolean;
  calendarName?: string;
}

function formatDateToIcsUtc(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    date.getUTCFullYear() +
    pad(date.getUTCMonth() + 1) +
    pad(date.getUTCDate()) +
    'T' +
    pad(date.getUTCHours()) +
    pad(date.getUTCMinutes()) +
    pad(date.getUTCSeconds()) +
    'Z'
  );
}

function formatDateToIcsDateOnly(dateStr: string): string {
  // Converts YYYY-MM-DD to YYYYMMDD
  return dateStr.replace(/-/g, '');
}

function getNextDayDateOnly(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${next.getUTCFullYear()}${pad(next.getUTCMonth() + 1)}${pad(next.getUTCDate())}`;
}

function escapeIcsText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

export function generateIcsCalendar(
  tasks: Task[],
  sessions: TimerSession[] = [],
  options: IcsOptions = {}
): string {
  const {
    includeSessions = true,
    includePlannedTasks = true,
    calendarName = 'afaire Tasks',
  } = options;

  const now = new Date();
  const dtstamp = formatDateToIcsUtc(now);
  const taskMap = new Map<string, Task>(tasks.map((t) => [t.id, t]));

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//afaire//Adaptive Task Manager//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcsText(calendarName)}`,
    'X-WR-TIMEZONE:UTC',
  ];

  // 1. Session-by-Session Focus Blocks (exact real-world start and end times)
  if (includeSessions && sessions.length > 0) {
    for (const session of sessions) {
      if (session.excludeFromHistory) continue;

      const task = taskMap.get(session.taskId);
      const taskTitle = task ? task.title : 'Task Session';

      const startDate = new Date(session.startedAt);
      const endDate = session.endedAt
        ? new Date(session.endedAt)
        : new Date(startDate.getTime() + (session.activeDurationMs || 60000));

      const durationStr = formatDuration(session.activeDurationMs || 0);
      const summaryTitle = session.subtaskTitle
        ? `${taskTitle} › ${session.subtaskTitle} (${durationStr})`
        : `${taskTitle} (${durationStr})`;

      const descLines: string[] = [];
      descLines.push(`Focus Session: ${durationStr}`);
      if (session.subtaskTitle) {
        descLines.push(`Subtask: ${session.subtaskTitle}`);
      }
      if (session.pausedDurations && session.pausedDurations.length > 0) {
        descLines.push(`Pauses: ${session.pausedDurations.length}`);
      }
      if (task) {
        descLines.push('');
        descLines.push(`Overall Task: ${task.title}`);
        descLines.push(`Status: ${task.status}`);
        if (task.description) {
          descLines.push(task.description);
        }
        if (task.subtasks && task.subtasks.length > 0) {
          descLines.push('');
          descLines.push('Subtasks:');
          for (const st of task.subtasks) {
            descLines.push(`- [${st.done ? 'x' : ' '}] ${st.title}`);
          }
        }
      }

      descLines.push('');
      descLines.push('Logged via afaire: https://murtaturta.github.io/afaire/');

      lines.push('BEGIN:VEVENT');
      lines.push(`UID:session-${session.id}@afaire`);
      lines.push(`DTSTAMP:${dtstamp}`);
      lines.push(`DTSTART:${formatDateToIcsUtc(startDate)}`);
      lines.push(`DTEND:${formatDateToIcsUtc(endDate)}`);
      lines.push(`SUMMARY:${escapeIcsText(summaryTitle)}`);
      lines.push(`DESCRIPTION:${escapeIcsText(descLines.join('\n'))}`);
      lines.push('STATUS:CONFIRMED');
      if (task && task.tags && task.tags.length > 0) {
        lines.push(`CATEGORIES:${escapeIcsText(task.tags.join(','))}`);
      }
      lines.push('END:VEVENT');
    }
  }

  // 2. Planned / Scheduled Tasks (All-Day Items at top of day so they don't block calendar hours)
  if (includePlannedTasks) {
    for (const task of tasks) {
      if (!task.scheduledDate) continue;

      const estMinutes = task.calibratedMinutes || task.nominalMinutes || 30;
      const statusIcon = task.status === 'completed' ? '✓ ' : '';
      const summaryTitle = `${statusIcon}[Planned] ${task.title} (~${formatMinutes(estMinutes)})`;

      const descLines: string[] = [];
      descLines.push(`Planned Task: ${task.title}`);
      descLines.push(`Estimated: ${formatMinutes(task.nominalMinutes)}`);
      if (task.calibratedMinutes) {
        descLines.push(`Calibrated: ${formatMinutes(task.calibratedMinutes)}`);
      }
      descLines.push(`Status: ${task.status}`);
      if (task.description) {
        descLines.push('');
        descLines.push(task.description);
      }
      if (task.subtasks && task.subtasks.length > 0) {
        descLines.push('');
        descLines.push('Subtasks:');
        for (const st of task.subtasks) {
          descLines.push(`- [${st.done ? 'x' : ' '}] ${st.title}`);
        }
      }

      descLines.push('');
      descLines.push('Managed via afaire: https://murtaturta.github.io/afaire/');

      const startDateStr = formatDateToIcsDateOnly(task.scheduledDate);
      const endDateStr = getNextDayDateOnly(task.scheduledDate);

      lines.push('BEGIN:VEVENT');
      lines.push(`UID:task-${task.id}-planned@afaire`);
      lines.push(`DTSTAMP:${dtstamp}`);
      lines.push(`DTSTART;VALUE=DATE:${startDateStr}`);
      lines.push(`DTEND;VALUE=DATE:${endDateStr}`);
      lines.push(`SUMMARY:${escapeIcsText(summaryTitle)}`);
      lines.push(`DESCRIPTION:${escapeIcsText(descLines.join('\n'))}`);
      lines.push(task.status === 'completed' ? 'STATUS:COMPLETED' : 'STATUS:CONFIRMED');
      if (task.tags && task.tags.length > 0) {
        lines.push(`CATEGORIES:${escapeIcsText(task.tags.join(','))}`);
      }
      lines.push('END:VEVENT');
    }
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

/**
 * Initiates a browser download of the generated .ics file
 */
export function downloadIcsFile(
  tasks: Task[],
  sessions: TimerSession[] = [],
  options?: IcsOptions,
  filename: string = 'afaire-tasks.ics'
) {
  const content = generateIcsCalendar(tasks, sessions, options);
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
