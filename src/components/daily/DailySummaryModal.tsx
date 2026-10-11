"use client";

import React, { useState } from 'react';
import { format, addDays } from 'date-fns';
import { Modal } from '@/components/ui/Modal';
import { Task, TimerSession } from '@/lib/db/types';
import { formatMinutes } from '@/lib/utils/duration';
import { updateTask } from '@/lib/db/tasks';
import { createRollingSnapshot } from '@/lib/db/snapshots';
import { CheckCircle2, Clock, Calendar, ArrowRight, Check, ListChecks } from 'lucide-react';

interface DailySummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  todayDate: string;
  tasks: Task[];
  sessions: TimerSession[];
}

export function DailySummaryModal({
  isOpen,
  onClose,
  todayDate,
  tasks,
  sessions,
}: DailySummaryModalProps) {
  const [rolledOver, setRolledOver] = useState(false);
  const tomorrowDate = format(addDays(new Date(), 1), 'yyyy-MM-dd');

  React.useEffect(() => {
    if (isOpen) {
      createRollingSnapshot('Day wrap-up checkpoint').catch(() => {});
    }
  }, [isOpen]);

  // Filter sessions that took place today
  const todaySessions = sessions.filter(
    (s) => !s.excludeFromHistory && s.startedAt.startsWith(todayDate)
  );

  // Total active focus time today in minutes
  const totalActiveMs = todaySessions.reduce(
    (acc, s) => acc + (s.adjustedDurationMs ?? s.activeDurationMs),
    0
  );
  const totalFocusMinutes = Math.round(totalActiveMs / 60000);

  // Task stats
  const completedTasks = tasks.filter((t) => t.status === 'completed');
  const pendingTasks = tasks.filter((t) => t.status !== 'completed');

  // Time spent per task today
  const timePerTask = new Map<string, number>();
  for (const s of todaySessions) {
    const current = timePerTask.get(s.taskId) || 0;
    timePerTask.set(s.taskId, current + (s.adjustedDurationMs ?? s.activeDurationMs));
  }

  // Count subtasks completed today
  let completedSubtasksCount = 0;
  for (const t of tasks) {
    if (t.subtasks) {
      completedSubtasksCount += t.subtasks.filter((st) => st.done).length;
    }
  }

  const handleRolloverIncomplete = async () => {
    for (const task of pendingTasks) {
      await updateTask(task.id, {
        scheduledDate: tomorrowDate,
        status: 'rolled-over',
      });
    }
    setRolledOver(true);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Daily Accomplishment Summary"
    >
      <div className="space-y-6 text-foreground">
        {/* Banner */}
        <div className="p-4 rounded-xl border border-border bg-muted/30 space-y-1">
          <p className="text-xs uppercase tracking-wider font-semibold text-primary">
            Wrap-up for {format(new Date(), 'EEEE, MMMM d')}
          </p>
          <h2 className="text-lg font-semibold text-foreground">
            That's enough to do for today.
          </h2>
          <p className="text-xs text-muted-foreground">
            You showed up and made progress. Take time to step away and rest.
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-3">
          <div className="p-3.5 rounded-xl border border-border bg-card flex flex-col items-center justify-center text-center">
            <Clock className="w-4 h-4 text-primary mb-1" />
            <span className="text-lg font-bold text-foreground">
              {formatMinutes(totalFocusMinutes)}
            </span>
            <span className="text-[11px] text-muted-foreground">Total Focus</span>
          </div>

          <div className="p-3.5 rounded-xl border border-border bg-card flex flex-col items-center justify-center text-center">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 mb-1" />
            <span className="text-lg font-bold text-foreground">
              {completedTasks.length} / {tasks.length}
            </span>
            <span className="text-[11px] text-muted-foreground">Tasks Done</span>
          </div>

          <div className="p-3.5 rounded-xl border border-border bg-card flex flex-col items-center justify-center text-center">
            <ListChecks className="w-4 h-4 text-amber-500 mb-1" />
            <span className="text-lg font-bold text-foreground">
              {completedSubtasksCount}
            </span>
            <span className="text-[11px] text-muted-foreground">Subtasks Done</span>
          </div>
        </div>

        {/* Tasks Worked On */}
        <div className="space-y-2.5">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Tasks Worked On Today
          </h3>
          <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
            {tasks.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2 italic">
                No tasks were scheduled for today.
              </p>
            ) : (
              tasks.map((task) => {
                const durationMs = timePerTask.get(task.id) || 0;
                const minutes = Math.round(durationMs / 60000);
                const isDone = task.status === 'completed';

                return (
                  <div
                    key={task.id}
                    className="flex items-center justify-between p-2.5 rounded-lg border border-border/80 bg-muted/20 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0 pr-2">
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          isDone ? 'bg-emerald-500' : 'bg-amber-500'
                        }`}
                      />
                      <span
                        className={`font-medium truncate ${
                          isDone ? 'line-through text-muted-foreground' : 'text-foreground'
                        }`}
                      >
                        {task.title}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 text-muted-foreground">
                      {minutes > 0 ? (
                        <span className="font-mono text-[11px] font-medium text-foreground">
                          {formatMinutes(minutes)}
                        </span>
                      ) : (
                        <span className="text-[11px]">Unlogged</span>
                      )}
                      <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-muted">
                        {isDone ? 'Done' : 'Pending'}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Incomplete Tasks Rollover Section */}
        {pendingTasks.length > 0 && (
          <div className="p-4 rounded-xl border border-border bg-card space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h4 className="text-xs font-semibold text-foreground">
                  Incomplete Tasks ({pendingTasks.length})
                </h4>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Roll remaining unfinished tasks over to tomorrow ({tomorrowDate}) so your board stays fresh.
                </p>
              </div>
              <button
                type="button"
                onClick={handleRolloverIncomplete}
                disabled={rolledOver}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground font-medium text-xs hover:bg-primary/90 transition-all cursor-pointer disabled:opacity-60 shrink-0"
              >
                {rolledOver ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Rolled Over</span>
                  </>
                ) : (
                  <>
                    <ArrowRight className="w-3.5 h-3.5" />
                    <span>Roll Over to Tomorrow</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-end pt-2 border-t border-border">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80 font-medium text-xs transition-colors cursor-pointer"
          >
            Done for Today
          </button>
        </div>
      </div>
    </Modal>
  );
}
