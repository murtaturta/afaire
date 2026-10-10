"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Play, Pause, Square, Minimize2 } from 'lucide-react';
import { useTimer, useTimerInstance } from '@/hooks/useTimer';
import { minutesToMs } from '@/lib/utils/duration';
import type { SessionData } from '@/stores/timerStore';

interface FocusTimerProps {
  taskId: string;
  onComplete: (sessionData: SessionData) => void;
}

export function FocusTimer({ taskId, onComplete }: FocusTimerProps) {
  const { pauseTimer, resumeTimer, stopTimer, minimizeTimer } = useTimer();
  const timer = useTimerInstance(taskId);
  
  if (!timer || !timer.task) return null;
  const { task, isRunning, formattedTime, elapsed } = timer;

  const nominalMs = task.nominalMinutes ? minutesToMs(task.nominalMinutes) : 0;
  let progress = 0;
  if (nominalMs > 0) {
      progress = Math.min((elapsed / nominalMs) * 100, 100);
  }

  const handleStop = () => {
    const session = stopTimer(taskId);
    if (session) {
      onComplete(session);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="fixed inset-x-0 top-0 z-50 p-4 bg-background/80 backdrop-blur-md border-b border-border shadow-sm flex flex-col items-center justify-center"
    >
      <div className="w-full max-w-3xl flex justify-between items-center mb-4">
          <div className="flex-1"></div>
          <h2 className="text-xl font-medium text-center flex-1 truncate px-4">{task.title}</h2>
          <div className="flex-1 flex justify-end">
             <button 
              onClick={minimizeTimer}
              className="p-2 rounded-full hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
              aria-label="Minimize timer"
            >
              <Minimize2 size={20} />
            </button>
          </div>
      </div>

      <div className="relative mb-6">
        <div className="text-6xl md:text-8xl font-mono font-bold tabular-nums tracking-tighter">
          {formattedTime}
        </div>
      </div>

      {task.nominalMinutes && (
        <div className="w-full max-w-md mb-8">
            <div className="flex justify-between text-sm text-muted-foreground mb-2">
                <span>Progress</span>
                <span>Estimated: {task.nominalMinutes} min</span>
            </div>
            <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                <div 
                    className="h-full bg-primary transition-all duration-300 ease-linear"
                    style={{ width: `${progress}%` }}
                />
            </div>
        </div>
      )}

      <div className="flex items-center gap-6">
        {isRunning ? (
          <button
            onClick={() => pauseTimer(taskId)}
            className="flex items-center gap-2 px-6 py-3 rounded-full bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors font-medium"
          >
            <Pause size={24} />
            Pause
          </button>
        ) : (
          <button
            onClick={() => resumeTimer(taskId)}
            className="flex items-center gap-2 px-6 py-3 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors font-medium"
          >
            <Play size={24} />
            Resume
          </button>
        )}

        <button
          onClick={handleStop}
          className="flex items-center gap-2 px-6 py-3 rounded-full bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors font-medium"
        >
          <Square size={24} className="fill-current" />
          Done
        </button>
      </div>
    </motion.div>
  );
}
