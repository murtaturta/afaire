"use client";

import { useEffect } from "react";
import { useTimerStore } from "@/stores/timerStore";

export function TimerTicker() {
  const hasHydrated = useTimerStore((state) => state.hasHydrated);
  const tick = useTimerStore((state) => state.tick);
  
  useEffect(() => {
    if (!hasHydrated) return;

    const interval = setInterval(() => {
      const state = useTimerStore.getState();
      const numTimers = Object.keys(state.timers).length;
      if (numTimers > 0) {
        tick();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [hasHydrated, tick]);

  return null;
}
