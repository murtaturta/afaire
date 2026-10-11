"use client";

import { useEffect } from "react";
import { useTimerStore } from "@/stores/timerStore";
import { timerWorkerClient } from "@/lib/timer/timerWorkerClient";
import { ensureDailySnapshot } from "@/lib/db/snapshots";

export function TimerTicker() {
  const hasHydrated = useTimerStore((state) => state.hasHydrated);
  const tick = useTimerStore((state) => state.tick);

  useEffect(() => {
    if (!hasHydrated) return;

    // Ensure daily snapshot safeguard runs once per day
    ensureDailySnapshot().catch(() => {});

    // Register tick handler with the background Web Worker scheduler
    const unsubscribe = timerWorkerClient.onTick(() => {
      const state = useTimerStore.getState();
      const numTimers = Object.keys(state.timers).length;
      if (numTimers > 0) {
        tick();
      }
    });

    // Start background worker
    timerWorkerClient.start(1000);

    return () => {
      unsubscribe();
      timerWorkerClient.stop();
    };
  }, [hasHydrated, tick]);

  return null;
}
