"use client";

import { useEffect } from 'react';
import { useTimerStore } from '@/stores/timerStore';
import { formatDuration } from '@/lib/utils/duration';

export function useTimer() {
  const store = useTimerStore();

  useEffect(() => {
    const intervalId = setInterval(() => {
      store.tick();
    }, 100);
    
    return () => clearInterval(intervalId);
  }, [store.tick]);

  return store;
}

export function useTimerInstance(taskId: string) {
  const store = useTimerStore();
  const timer = store.timers[taskId];
  return {
    ...timer,
    formattedTime: timer ? formatDuration(timer.elapsed) : "00:00"
  };
}
