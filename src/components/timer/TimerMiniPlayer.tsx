"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Play, Pause, Square, Maximize2 } from 'lucide-react';
import { useTimer, useTimerInstance } from '@/hooks/useTimer';
import type { SessionData } from '@/stores/timerStore';

interface TimerMiniPlayerProps {
  taskId: string;
  onComplete: (sessionData: SessionData) => void;
}

export function TimerMiniPlayer({ taskId, onComplete }: TimerMiniPlayerProps) {
  const { pauseTimer, resumeTimer, stopTimer, maximizeTimer } = useTimer();
  const timer = useTimerInstance(taskId);
  
  if (!timer || !timer.task) return null;
  const { task, isRunning, formattedTime } = timer;

  const handleStop = () => {
    const session = stopTimer(taskId);
    if (session) {
      onComplete(session);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 50 }}
      className="flex items-center gap-4 p-3 pr-4 bg-background/90 backdrop-blur-md border border-border rounded-full shadow-lg w-80"
    >
      <div className="flex-1 min-w-0 flex items-center gap-3 pl-2">
        <div className="w-16 font-mono font-bold text-lg tabular-nums">
          {formattedTime}
        </div>
        <div className="flex-1 truncate text-sm font-medium">
          {task.title}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {isRunning ? (
          <button
            onClick={() => pauseTimer(taskId)}
            className="p-2 rounded-full hover:bg-secondary transition-colors text-secondary-foreground"
            aria-label="Pause timer"
          >
            <Pause size={18} />
          </button>
        ) : (
          <button
            onClick={() => resumeTimer(taskId)}
            className="p-2 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            aria-label="Resume timer"
          >
            <Play size={18} fill="currentColor" />
          </button>
        )}

        <button
          onClick={handleStop}
          className="p-2 rounded-full hover:bg-destructive/10 text-destructive transition-colors"
          aria-label="Stop and complete"
        >
          <Square size={18} className="fill-current" />
        </button>
        
        <div className="w-px h-6 bg-border mx-1" />

        <button
          onClick={() => maximizeTimer(taskId)}
          className="p-2 rounded-full hover:bg-muted transition-colors text-muted-foreground"
          aria-label="Expand timer"
        >
          <Maximize2 size={18} />
        </button>
      </div>
    </motion.div>
  );
}
