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

function hexToHsl(hex: string): [number, number, number] {
  const cleanHex = hex.replace('#', '');
  const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
  const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
  const b = parseInt(cleanHex.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

function hslToHex(h: number, s: number, l: number): string {
  const sFrac = s / 100;
  const lFrac = l / 100;
  const a = sFrac * Math.min(lFrac, 1 - lFrac);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = lFrac - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

export function getSubtaskShade(baseColor: string, indexOrId?: number | string): string {
  if (indexOrId === undefined || indexOrId === null || indexOrId === '') return baseColor;

  let idx = 0;
  if (typeof indexOrId === 'number') {
    idx = indexOrId;
  } else {
    let hash = 0;
    for (let i = 0; i < indexOrId.length; i++) {
      hash = (hash << 5) - hash + indexOrId.charCodeAt(i);
      hash |= 0;
    }
    idx = Math.abs(hash);
  }

  try {
    const [h, s, l] = hexToHsl(baseColor || DEFAULT_TASK_COLOR);
    const shadeOffsets = [
      { lShift: 14, sFactor: 0.85 }, // Lighter tint
      { lShift: 24, sFactor: 0.75 }, // Soft pastel tint
      { lShift: -12, sFactor: 0.95 }, // Deeper shade
      { lShift: 18, sFactor: 0.65 }, // Muted light tint
      { lShift: -6, sFactor: 0.90 },  // Rich saturated shade
    ];
    const offset = shadeOffsets[idx % shadeOffsets.length];
    const newL = Math.max(25, Math.min(85, l + offset.lShift));
    const newS = Math.max(30, Math.min(95, Math.round(s * offset.sFactor)));
    return hslToHex(h, newS, newL);
  } catch {
    return baseColor;
  }
}
