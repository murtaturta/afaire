"use client";
import { create } from 'zustand';
import type { Task } from '@/lib/db/types';

export interface TimerInstance {
  taskId: string;
  task: Task;
  isRunning: boolean;
  isPaused: boolean;
  startTime: number;
  elapsed: number;
  pauseStart: number | null;
  totalPausedMs: number;
  pausedDurations: number[];
}

export interface SessionData {
  taskId: string;
  task: Task;
  rawDurationMs: number;
  activeDurationMs: number;
  pausedDurations: number[];
  startedAt: number;
}

export interface TimerState {
  timers: Record<string, TimerInstance>;
  activeTimerId: string | null;

  startTimer: (task: Task) => void;
  pauseTimer: (taskId: string) => void;
  resumeTimer: (taskId: string) => void;
  stopTimer: (taskId: string) => SessionData | null;
  tick: () => void;
  maximizeTimer: (taskId: string) => void;
  minimizeTimer: () => void;
}

export const useTimerStore = create<TimerState>((set, get) => ({
  timers: {},
  activeTimerId: null,

  startTimer: (task: Task) => {
    set((state) => {
      const newTimers = { ...state.timers };
      newTimers[task.id] = {
        taskId: task.id,
        task,
        isRunning: true,
        isPaused: false,
        startTime: Date.now(),
        elapsed: 0,
        pauseStart: null,
        totalPausedMs: 0,
        pausedDurations: [],
      };
      return {
        timers: newTimers,
        activeTimerId: task.id,
      };
    });
  },

  pauseTimer: (taskId: string) => {
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

  resumeTimer: (taskId: string) => {
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

  stopTimer: (taskId: string) => {
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
      rawDurationMs,
      activeDurationMs,
      pausedDurations: finalPausedDurations,
      startedAt: timer.startTime,
    };

    set((state) => {
      const newTimers = { ...state.timers };
      delete newTimers[taskId];
      return {
        timers: newTimers,
        activeTimerId: state.activeTimerId === taskId ? null : state.activeTimerId,
      };
    });

    return sessionData;
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
            elapsed: now - timer.startTime - timer.totalPausedMs,
          };
          hasUpdates = true;
        }
      }
      
      if (!hasUpdates) return state;
      return { timers: newTimers };
    });
  },

  maximizeTimer: (taskId: string) => {
    set({ activeTimerId: taskId });
  },

  minimizeTimer: () => {
    set({ activeTimerId: null });
  },
}));
