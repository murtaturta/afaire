"use client";

import React, { useState, useEffect } from 'react';
import { useTimerStore } from '@/stores/timerStore';
import { useTaskCompletion } from '@/context/TaskCompletionContext';
import { TimerItem } from './TimerItem';
import { Timer, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const TimerDrawer: React.FC = () => {
  const [mounted, setMounted] = useState(false);
  const timers = useTimerStore((state) => state.timers);
  const isDrawerOpen = useTimerStore((state) => state.isDrawerOpen);
  const setDrawerOpen = useTimerStore((state) => state.setDrawerOpen);
  const hasHydrated = useTimerStore((state) => state.hasHydrated);

  const { completeWithOutlierCheck } = useTaskCompletion();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !hasHydrated) {
    return null;
  }

  const timerList = Object.values(timers);
  const runningCount = timerList.filter((t) => t.isRunning).length;
  const totalCount = timerList.length;

  return (
    <>
      {/* Collapsed Tab */}
      {!isDrawerOpen && (
        <div className="fixed right-0 top-20 z-40">
          <button
            type="button"
            data-testid="drawer-toggle"
            onClick={() => setDrawerOpen(true)}
            className="flex items-center gap-2 px-3 py-2 bg-card border border-r-0 border-border rounded-l-xl shadow-md hover:bg-muted text-foreground transition-all cursor-pointer group"
            aria-label="Open active timers drawer"
          >
            <div className="relative flex items-center justify-center">
              <Timer
                className={`w-5 h-5 ${
                  runningCount > 0
                    ? 'text-primary animate-pulse'
                    : 'text-muted-foreground'
                }`}
              />
              {totalCount > 0 && (
                <span className="absolute -top-1.5 -right-2 min-w-4 h-4 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center shadow-xs">
                  {runningCount > 0 ? runningCount : totalCount}
                </span>
              )}
            </div>
            <span className="text-xs font-medium hidden sm:inline text-muted-foreground group-hover:text-foreground">
              Timers
            </span>
          </button>
        </div>
      )}

      {/* Expanded Drawer */}
      <AnimatePresence>
        {isDrawerOpen && (
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 250 }}
            className="fixed top-0 right-0 bottom-0 w-80 sm:w-96 bg-card border-l border-border shadow-2xl z-40 flex flex-col"
            aria-label="Active timers drawer"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border bg-card">
              <div className="flex items-center gap-2">
                <Timer className="w-5 h-5 text-primary" />
                <h3 className="font-semibold text-base text-foreground">
                  Active Timers
                </h3>
                {totalCount > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                    {totalCount}
                  </span>
                )}
              </div>
              <button
                type="button"
                data-testid="drawer-toggle"
                onClick={() => setDrawerOpen(false)}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                aria-label="Close active timers drawer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Timers List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {timerList.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-muted-foreground space-y-2">
                  <Timer className="w-8 h-8 opacity-40" />
                  <p className="text-sm">No active timers</p>
                </div>
              ) : (
                timerList.map((timer) => (
                  <TimerItem
                    key={timer.taskId}
                    timer={timer}
                    onComplete={completeWithOutlierCheck}
                  />
                ))
              )}
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
};
