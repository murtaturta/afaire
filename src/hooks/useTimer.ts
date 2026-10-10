"use client";

import { useTimerStore } from '@/stores/timerStore';

export function formatElapsed(elapsedMs: number): string {
  const totalSeconds = Math.floor(elapsedMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const mm = minutes.toString().padStart(2, '0');
  const ss = seconds.toString().padStart(2, '0');

  if (hours > 0) {
    const hh = hours.toString().padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  }
  return `${mm}:${ss}`;
}

export function useTimer() {
  return useTimerStore();
}

export function useTimerInstance(taskId: string) {
  const store = useTimerStore();
  const timer = store.timers[taskId];
  return {
    ...timer,
    formattedTime: timer ? formatElapsed(timer.elapsed) : "00:00"
  };
}
