"use client";

import React from 'react';
import type { TimerInstance } from '@/stores/timerStore';
import type { Task } from '@/lib/db/types';
import { useTimerStore } from '@/stores/timerStore';
import { stopSession } from '@/lib/timer/sessionService';
import { formatElapsed } from '@/hooks/useTimer';
import { Play, Pause, Square, CheckCircle2 } from 'lucide-react';

interface TimerItemProps {
  timer: TimerInstance;
  onComplete: (task: Task) => Promise<void>;
}

export const TimerItem: React.FC<TimerItemProps> = ({ timer, onComplete }) => {
  const pauseTimer = useTimerStore((state) => state.pauseTimer);
  const resumeTimer = useTimerStore((state) => state.resumeTimer);

  const handlePauseResume = () => {
    if (timer.isRunning) {
      pauseTimer(timer.taskId);
    } else {
      resumeTimer(timer.taskId);
    }
  };

  const handleStopSession = async () => {
    await stopSession(timer.taskId);
  };

  const handleComplete = async () => {
    await onComplete(timer.task);
  };

  return (
    <div
      data-testid={`drawer-timer-row-${timer.taskId}`}
      className="p-4 rounded-xl border border-border bg-card shadow-sm space-y-3"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-semibold text-sm text-foreground truncate">
              {timer.task.title}
            </span>
            {timer.subtaskTitle && (
              <span className="text-xs text-muted-foreground font-medium flex items-center gap-1 truncate">
                <span>›</span>
                <span>{timer.subtaskTitle}</span>
              </span>
            )}
          </div>
        </div>
        <span
          className={`text-[10px] font-medium px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0 ${
            timer.isRunning
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
              : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
          }`}
        >
          {timer.isRunning ? 'Running' : 'Paused'}
        </span>
      </div>

      <div className="text-center py-2 bg-muted/50 rounded-lg">
        <span
          data-testid={`elapsed-time-${timer.taskId}`}
          className="font-mono text-2xl font-bold tracking-tight text-foreground"
        >
          {formatElapsed(timer.elapsed)}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 pt-1">
        <button
          type="button"
          data-testid={`pause-resume-btn-${timer.taskId}`}
          onClick={handlePauseResume}
          className="flex items-center justify-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-border bg-background hover:bg-muted text-foreground transition-colors cursor-pointer"
        >
          {timer.isRunning ? (
            <>
              <Pause className="w-3.5 h-3.5" />
              <span>Pause</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5" />
              <span>Resume</span>
            </>
          )}
        </button>

        <button
          type="button"
          data-testid={`stop-session-btn-${timer.taskId}`}
          onClick={handleStopSession}
          className="flex items-center justify-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          <Square className="w-3.5 h-3.5" />
          <span>Stop</span>
        </button>

        <button
          type="button"
          data-testid={`complete-task-btn-${timer.taskId}`}
          onClick={handleComplete}
          className="flex items-center justify-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-xs cursor-pointer"
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Complete</span>
        </button>
      </div>
    </div>
  );
};
