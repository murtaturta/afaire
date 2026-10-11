"use client";

import React, { useState } from 'react';
import type { Task, TimerSession } from '@/lib/db/types';
import { useTaskSplit, useTaskSessions } from '@/hooks/useData';
import { format } from 'date-fns';
import { formatMinutes, formatDuration } from '@/lib/utils/duration';
import { History, BarChart2, Pencil, Plus } from 'lucide-react';
import { SessionEditModal } from '@/components/timer/SessionEditModal';
import { getSubtaskShade } from '@/lib/constants/colors';

interface TaskTimelineProps {
  task: Task;
}

export const TaskTimeline: React.FC<TaskTimelineProps> = ({ task }) => {
  const splits = useTaskSplit(task.id) || [];
  const sessions = useTaskSessions(task.id) || [];
  const isCompleted = task.status === 'completed';

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState<TimerSession | null>(null);

  const totalSplitMinutes = splits.reduce((acc, s) => acc + s.minutes, 0);
  const sortedSessions = [...sessions].reverse();

  const handleOpenAddSession = () => {
    setSelectedSession(null);
    setIsModalOpen(true);
  };

  const handleOpenEditSession = (session: TimerSession) => {
    setSelectedSession(session);
    setIsModalOpen(true);
  };

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
              const parentColor = task.color || '#2563eb';
              const splitColor = s.subtaskId ? getSubtaskShade(parentColor, s.subtaskId) : parentColor;
              const matchedSubtask = (task.subtasks || []).find((st) => st.id === s.subtaskId || st.title === s.title);
              return (
                <div key={s.subtaskId || `general-${idx}`} data-testid="split-row" className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: splitColor }}
                      />
                      <span className="font-medium text-foreground truncate">{s.title}</span>
                      {matchedSubtask?.comment && (
                        <span className="text-[10px] text-muted-foreground italic truncate max-w-[180px]">
                          ({matchedSubtask.comment})
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-muted-foreground">{formatMinutes(s.minutes)}</span>
                      <span className="text-xs font-medium text-muted-foreground w-8 text-right">{pct}%</span>
                    </div>
                  </div>
                  <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{ width: `${pct}%`, backgroundColor: splitColor }}
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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <History className="w-4 h-4" />
            <span>Session History ({sortedSessions.length})</span>
          </div>
          <button
            type="button"
            data-testid="add-manual-session-btn"
            onClick={handleOpenAddSession}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md border border-border bg-muted/30 hover:bg-muted text-[11px] font-medium text-foreground transition-colors cursor-pointer"
          >
            <Plus className="w-3 h-3 text-primary" />
            <span>Log Past Session</span>
          </button>
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
              const parentColor = task.color || '#2563eb';
              const isSubtask = Boolean(session.subtaskId || session.subtaskTitle);
              const sessionColor = isSubtask
                ? getSubtaskShade(parentColor, session.subtaskId || session.subtaskTitle)
                : parentColor;
              const matchedSubtask = (task.subtasks || []).find(
                (st) => (session.subtaskId && st.id === session.subtaskId) || (session.subtaskTitle && st.title === session.subtaskTitle)
              );

              return (
                <div
                  key={session.id}
                  data-testid="timeline-session-row"
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-lg border border-border bg-card/60 text-xs text-card-foreground group"
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-foreground">{dateStr}</span>
                    <span className="text-muted-foreground">|</span>
                    <span className="font-mono text-muted-foreground">
                      <span data-testid="session-start-time">{startTimeStr}</span>
                      <span> - </span>
                      <span data-testid="session-end-time">{endTimeStr}</span>
                    </span>
                    <span
                      className="px-2 py-0.5 rounded text-[11px] font-medium text-foreground flex items-center gap-1.5 border border-border/60"
                      style={{
                        backgroundColor: `${sessionColor}18`,
                        borderLeftColor: sessionColor,
                        borderLeftWidth: '3px',
                      }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: sessionColor }} />
                      <span>{session.subtaskTitle || 'General'}</span>
                    </span>
                    {matchedSubtask?.comment && (
                      <span className="text-[10px] text-muted-foreground/80 italic truncate max-w-[200px]">
                        ({matchedSubtask.comment})
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 text-muted-foreground shrink-0 mt-1 sm:mt-0">
                    <span>
                      Duration: <strong className="text-foreground font-semibold">{formatDuration(session.activeDurationMs)}</strong>
                    </span>
                    {pauseCount > 0 && (
                      <span>
                        ({pauseCount} {pauseCount === 1 ? 'pause' : 'pauses'})
                      </span>
                    )}
                    <button
                      type="button"
                      data-testid="edit-session-btn"
                      onClick={() => handleOpenEditSession(session)}
                      className="p-1 rounded text-muted-foreground hover:text-primary hover:bg-muted transition-colors cursor-pointer"
                      title="Edit timecodes"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <SessionEditModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedSession(null);
        }}
        task={task}
        session={selectedSession}
      />
    </div>
  );
};
