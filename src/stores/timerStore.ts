"use client";
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Task } from '@/lib/db/types';

export interface TimerInstance {
  taskId: string;
  task: Task;
  subtaskId?: string;
  subtaskTitle?: string;
  isRunning: boolean;
  isPaused: boolean;
  startTime: number;
  elapsed: number;
  pauseStart: number | null;
  totalPausedMs: number;
  pausedDurations: number[];
  baseElapsedMs?: number;
}

export interface SessionData {
  taskId: string;
  task: Task;
  subtaskId?: string;
  subtaskTitle?: string;
  rawDurationMs: number;
  activeDurationMs: number;
  pausedDurations: number[];
  startedAt: number;
}

export interface TimerState {
  timers: Record<string, TimerInstance>;
  isDrawerOpen: boolean;
  hasHydrated: boolean;

  setHasHydrated: (state: boolean) => void;
  setDrawerOpen: (isOpen: boolean) => void;

  startTimer: (task: Task, subtaskId?: string, subtaskTitle?: string, baseElapsedMs?: number) => void;
  pauseTimer: (taskId: string) => void;
  resumeTimer: (taskId: string) => void;
  stopTimer: (taskId: string) => SessionData | null;
  discardTimer: (taskId: string) => void;
  tick: () => void;
}

export const useTimerStore = create<TimerState>()(
  persist(
    (set, get) => ({
      timers: {},
      isDrawerOpen: false,
      hasHydrated: false,

      setHasHydrated: (state) => set({ hasHydrated: state }),
      setDrawerOpen: (isOpen) => set({ isDrawerOpen: isOpen }),

      startTimer: (task, subtaskId, subtaskTitle, baseElapsedMs = 0) => {
        set((state) => {
          const current = state.timers[task.id];
          if (current && current.subtaskId === subtaskId) {
            return state;
          }
          
          return {
            timers: {
              ...state.timers,
              [task.id]: {
                taskId: task.id,
                task,
                subtaskId,
                subtaskTitle,
                isRunning: true,
                isPaused: false,
                startTime: Date.now(),
                elapsed: baseElapsedMs,
                pauseStart: null,
                totalPausedMs: 0,
                pausedDurations: [],
                baseElapsedMs,
              }
            }
          };
        });
      },

      pauseTimer: (taskId) => {
        set((state) => {
          const timer = state.timers[taskId];
          if (timer && timer.isRunning) {
            return {
              timers: {
                ...state.timers,
                [taskId]: {
                  ...timer,
                  isRunning: false,
                  isPaused: true,
                  pauseStart: Date.now(),
                }
              }
            };
          }
          return state;
        });
      },

      resumeTimer: (taskId) => {
        set((state) => {
          const timer = state.timers[taskId];
          if (timer && timer.isPaused && timer.pauseStart !== null) {
            const pauseDuration = Date.now() - timer.pauseStart;
            return {
              timers: {
                ...state.timers,
                [taskId]: {
                  ...timer,
                  isRunning: true,
                  isPaused: false,
                  pauseStart: null,
                  totalPausedMs: timer.totalPausedMs + pauseDuration,
                  pausedDurations: [...timer.pausedDurations, pauseDuration],
                }
              }
            };
          }
          return state;
        });
      },

      stopTimer: (taskId) => {
        const state = get();
        const timer = state.timers[taskId];
        if (!timer) return null;

        const endTime = Date.now();
        let finalTotalPausedMs = timer.totalPausedMs;
        const finalPausedDurations = [...timer.pausedDurations];

        if (timer.isPaused && timer.pauseStart !== null) {
          const currentPause = endTime - timer.pauseStart;
          finalTotalPausedMs += currentPause;
          finalPausedDurations.push(currentPause);
        }

        const rawDurationMs = endTime - timer.startTime;
        const activeDurationMs = rawDurationMs - finalTotalPausedMs;

        const sessionData: SessionData = {
          taskId: timer.taskId,
          task: timer.task,
          subtaskId: timer.subtaskId,
          subtaskTitle: timer.subtaskTitle,
          rawDurationMs,
          activeDurationMs,
          pausedDurations: finalPausedDurations,
          startedAt: timer.startTime,
        };

        set((state) => {
          const newTimers = { ...state.timers };
          delete newTimers[taskId];
          return { timers: newTimers };
        });

        return sessionData;
      },

      discardTimer: (taskId) => {
        set((state) => {
          const newTimers = { ...state.timers };
          delete newTimers[taskId];
          return { timers: newTimers };
        });
      },

      tick: () => {
        const now = Date.now();
        set((state) => {
          const newTimers = { ...state.timers };
          let hasUpdates = false;

          for (const id in newTimers) {
            const timer = newTimers[id];
            if (timer.isRunning) {
              newTimers[id] = {
                ...timer,
                elapsed: (timer.baseElapsedMs || 0) + (now - timer.startTime - timer.totalPausedMs),
              };
              hasUpdates = true;
            }
          }
          
          if (!hasUpdates) return state;
          return { timers: newTimers };
        });
      },
    }),
    {
      name: 'tempodo-timers',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        timers: state.timers,
        isDrawerOpen: state.isDrawerOpen,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      }
    }
  )
);
