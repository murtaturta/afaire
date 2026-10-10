export interface TaskColor {
  name: string;
  value: string;
  bgClass: string;
  borderClass: string;
}

export const TASK_COLORS: TaskColor[] = [
  { name: 'Blue', value: '#2563eb', bgClass: 'bg-blue-500', borderClass: 'border-blue-500' },
  { name: 'Emerald', value: '#10b981', bgClass: 'bg-emerald-500', borderClass: 'border-emerald-500' },
  { name: 'Purple', value: '#8b5cf6', bgClass: 'bg-purple-500', borderClass: 'border-purple-500' },
  { name: 'Amber', value: '#f59e0b', bgClass: 'bg-amber-500', borderClass: 'border-amber-500' },
  { name: 'Rose', value: '#f43f5e', bgClass: 'bg-rose-500', borderClass: 'border-rose-500' },
  { name: 'Cyan', value: '#06b6d4', bgClass: 'bg-cyan-500', borderClass: 'border-cyan-500' },
  { name: 'Indigo', value: '#6366f1', bgClass: 'bg-indigo-500', borderClass: 'border-indigo-500' },
];

export const DEFAULT_TASK_COLOR = '#2563eb';

export function getTaskColor(color?: string): string {
  return color || DEFAULT_TASK_COLOR;
}
