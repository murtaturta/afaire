"use client";

import React from 'react';
import type { Task } from '@/lib/db/types';
import { useTaskSplit, useTaskSessions } from '@/hooks/useData';
import { format } from 'date-fns';
import { formatMinutes, formatDuration } from '@/lib/utils/duration';
import { History, BarChart2 } from 'lucide-react';

interface TaskTimelineProps {
  task: Task;
}

export const TaskTimeline: React.FC<TaskTimelineProps> = ({ task }) => {
  const splits = useTaskSplit(task.id) || [];
  const sessions = useTaskSessions(task.id) || [];
  const isCompleted = task.status === 'completed';

  const totalSplitMinutes = splits.reduce((acc, s) => acc + s.minutes, 0);
  const sortedSessions = [...sessions].reverse();

  return (
    <div className="pt-4 border-t border-border space-y-6">
      {/* 1. Time Split Breakdown */}
      <div className={`space-y-3 ${isCompleted ? 'p-3 rounded-lg bg-muted/40 border border-border/80' : ''}`}>
        <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <BarChart2 className="w-4 h-4 text-primary" />
            <span>{isCompleted ? 'Completion Time Split' : 'Time Split (Live)'}</span>
          </div>
          <span className="font-medium normal-case">
            Total: {formatMinutes(totalSplitMinutes)} vs {formatMinutes(task.nominalMinutes)} est.
          </span>
        </div>

        {splits.length === 0 ? (
          <p className="text-xs text-muted-foreground italic py-1">No recorded time yet</p>
        ) : (
          <div className="space-y-2">
            {splits.map((s, idx) => {
              const pct = totalSplitMinutes > 0 ? Math.round((s.minutes / totalSplitMinutes) * 100) : 0;
              return (
                <div key={s.subtaskId || `general-${idx}`} data-testid="split-row" className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-foreground">{s.title}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">{formatMinutes(s.minutes)}</span>
                      <span className="text-xs font-medium text-muted-foreground w-8 text-right">{pct}%</span>
                    </div>
                  </div>
                  <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-300"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 2. Session Timeline */}
      <div className="space-y-3">
        <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <History className="w-4 h-4" />
          <span>Session History ({sortedSessions.length})</span>
        </div>

        {sortedSessions.length === 0 ? (
          <p className="text-xs text-muted-foreground italic py-1">No sessions logged yet</p>
        ) : (
          <div className="space-y-2">
            {sortedSessions.map((session) => {
              const startDate = new Date(session.startedAt);
              const endDate = session.endedAt ? new Date(session.endedAt) : null;
              const dateStr = format(startDate, 'MMM d, yyyy');
              const startTimeStr = format(startDate, 'HH:mm');
              const endTimeStr = endDate ? format(endDate, 'HH:mm') : '-';
              const pauseCount = session.pausedDurations?.length || 0;

              return (
                <div
                  key={session.id}
                  data-testid="timeline-session-row"
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 p-2.5 rounded-lg border border-border bg-card/60 text-xs text-card-foreground"
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-foreground">{dateStr}</span>
                    <span className="text-muted-foreground">|</span>
                    <span className="font-mono text-muted-foreground">
                      <span data-testid="session-start-time">{startTimeStr}</span>
                      <span> - </span>
                      <span data-testid="session-end-time">{endTimeStr}</span>
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-muted text-[11px] font-medium text-foreground">
                      {session.subtaskTitle || 'General'}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-muted-foreground shrink-0 mt-1 sm:mt-0">
                    <span>
                      Duration: <strong className="text-foreground font-semibold">{formatDuration(session.activeDurationMs)}</strong>
                    </span>
                    <span>
                      ({pauseCount} {pauseCount === 1 ? 'pause' : 'pauses'})
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
