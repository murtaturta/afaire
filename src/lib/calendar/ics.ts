import { Task } from '@/lib/db/types';

interface IcsOptions {
  includeCompleted?: boolean;
  calendarName?: string;
}

function formatDateToIcs(date: Date): string {
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

function escapeIcsText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

export function generateIcsCalendar(tasks: Task[], options: IcsOptions = {}): string {
  const { includeCompleted = true, calendarName = 'afaire Tasks' } = options;
  const now = new Date();
  const dtstamp = formatDateToIcs(now);

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//afaire//Adaptive Task Manager//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcsText(calendarName)}`,
    'X-WR-TIMEZONE:UTC',
  ];

  for (const task of tasks) {
    if (!includeCompleted && task.status === 'completed') {
      continue;
    }

    // Determine start and end date/time
    let startDate: Date;
    const durationMinutes = task.calibratedMinutes || task.nominalMinutes || 30;

    if (task.scheduledDate) {
      // Base date from scheduledDate YYYY-MM-DD
      const [year, month, day] = task.scheduledDate.split('-').map(Number);
      startDate = new Date(Date.UTC(year, month - 1, day));

      // Adjust hours based on timeSlotPreference
      switch (task.timeSlotPreference) {
        case 'morning':
          startDate.setUTCHours(9, 0, 0, 0);
          break;
        case 'afternoon':
          startDate.setUTCHours(14, 0, 0, 0);
          break;
        case 'evening':
          startDate.setUTCHours(18, 0, 0, 0);
          break;
        default:
          startDate.setUTCHours(10, 0, 0, 0);
          break;
      }
    } else {
      // Default to today if unscheduled
      startDate = new Date();
      startDate.setUTCHours(10, 0, 0, 0);
    }

    const endDate = new Date(startDate.getTime() + durationMinutes * 60 * 1000);

    // Build event description
    const descParts: string[] = [];
    if (task.description) {
      descParts.push(task.description);
      descParts.push('');
    }

    descParts.push(`Estimated duration: ${task.nominalMinutes}m`);
    if (task.calibratedMinutes) {
      descParts.push(`Calibrated duration: ${task.calibratedMinutes}m`);
    }

    if (task.tags && task.tags.length > 0) {
      descParts.push(`Tags: ${task.tags.map((t) => `#${t}`).join(', ')}`);
    }

    if (task.subtasks && task.subtasks.length > 0) {
      descParts.push('');
      descParts.push('Subtasks:');
      for (const st of task.subtasks) {
        descParts.push(`- [${st.done ? 'x' : ' '}] ${st.title}`);
      }
    }

    descParts.push('');
    descParts.push('Managed with afaire: https://murtaturta.github.io/afaire/');

    const description = escapeIcsText(descParts.join('\n'));
    const summary = escapeIcsText(
      task.status === 'completed' ? `✓ ${task.title}` : task.title
    );

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:task-${task.id}@afaire`);
    lines.push(`DTSTAMP:${dtstamp}`);
    lines.push(`DTSTART:${formatDateToIcs(startDate)}`);
    lines.push(`DTEND:${formatDateToIcs(endDate)}`);
    lines.push(`SUMMARY:${summary}`);
    lines.push(`DESCRIPTION:${description}`);
    lines.push(task.status === 'completed' ? 'STATUS:COMPLETED' : 'STATUS:CONFIRMED');
    if (task.tags && task.tags.length > 0) {
      lines.push(`CATEGORIES:${escapeIcsText(task.tags.join(','))}`);
    }
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

/**
 * Initiates a browser download of the generated .ics file
 */
export function downloadIcsFile(tasks: Task[], filename: string = 'afaire-tasks.ics') {
  const content = generateIcsCalendar(tasks);
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
