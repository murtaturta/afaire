"use client";

import React, { useState } from 'react';
import { Task, Subtask } from '@/lib/db/types';
import { useTimerStore } from '@/stores/timerStore';
import { startSession, toggleSubtaskDone } from '@/lib/timer/sessionService';
import { updateTask } from '@/lib/db/tasks';
import { useTaskCompletion } from '@/context/TaskCompletionContext';
import { TaskTimeline } from './TaskTimeline';
import { Play, Pencil, Trash2, CheckCircle2, Circle, Check, Plus, X, ChevronDown, ChevronUp, History } from 'lucide-react';
import { motion } from 'framer-motion';

interface TaskCardProps {
  task: Task;
  onEdit: (task: Task) => void;
  onDelete: (taskId: string) => void;
  onStatusChange?: (taskId: string, status: Task['status']) => void;
  onStartTimer?: (task: Task) => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({
  task,
  onEdit,
  onDelete,
  onStatusChange,
  onStartTimer
}) => {
  const isCompleted = task.status === 'completed';
  const [isExpanded, setIsExpanded] = useState(isCompleted);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');

  const timers = useTimerStore((state) => state.timers);
  const discardTimer = useTimerStore((state) => state.discardTimer);
  const { completeWithOutlierCheck } = useTaskCompletion();

  const currentTimer = timers[task.id];
  const isTaskRunning = currentTimer?.isRunning && !currentTimer?.subtaskId;

  const handleToggleTaskStatus = async () => {
    if (isCompleted) {
      await updateTask(task.id, {
        status: 'pending',
        completedAt: undefined,
      });
      if (onStatusChange) onStatusChange(task.id, 'pending');
    } else {
      await completeWithOutlierCheck(task);
      setIsExpanded(true);
      if (onStatusChange) onStatusChange(task.id, 'completed');
    }
  };

  const handleStartTaskTimer = async () => {
    await startSession(task);
    if (onStartTimer) onStartTimer(task);
  };

  const handleStartSubtaskTimer = async (st: Subtask) => {
    await startSession(task, st.id, st.title);
  };

  const handleToggleSubtask = async (st: Subtask) => {
    await toggleSubtaskDone(task.id, st.id, !st.done);
  };

  const handleRemoveSubtask = async (subtaskId: string) => {
    const timer = useTimerStore.getState().timers[task.id];
    if (timer && timer.subtaskId === subtaskId) {
      discardTimer(task.id);
    }
    const updatedSubtasks = (task.subtasks || []).filter((s) => s.id !== subtaskId);
    await updateTask(task.id, { subtasks: updatedSubtasks });
  };

  const handleAddSubtask = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && newSubtaskTitle.trim()) {
      e.preventDefault();
      const newSt: Subtask = {
        id: crypto.randomUUID(),
        title: newSubtaskTitle.trim(),
        done: false,
      };
      const updatedSubtasks = [...(task.subtasks || []), newSt];
      await updateTask(task.id, { subtasks: updatedSubtasks });
      setNewSubtaskTitle('');
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      data-testid={`task-card-${task.id}`}
      style={{ borderLeftColor: task.color || '#2563eb', borderLeftWidth: '4px' }}
      className={`group relative flex flex-col p-4 rounded-xl border bg-card text-card-foreground shadow-xs transition-colors ${
        isCompleted
          ? 'border-border/60 opacity-75'
          : 'border-border'
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Task Completion Checkbox */}
        <button
          type="button"
          onClick={handleToggleTaskStatus}
          className="mt-0.5 text-muted-foreground hover:text-primary transition-colors shrink-0 cursor-pointer"
          aria-label={isCompleted ? 'Mark task pending' : 'Mark task completed'}
        >
          {isCompleted ? (
            <CheckCircle2 className="w-5 h-5 text-success" />
          ) : (
            <Circle className="w-5 h-5" />
          )}
        </button>

        {/* Task Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: task.color || '#2563eb' }}
              title="Task color"
            />
            <h3
              className={`text-base font-medium truncate ${
                isCompleted
                  ? 'line-through text-muted-foreground'
                  : 'text-foreground'
              }`}
            >
              {task.title}
            </h3>
            {isTaskRunning && (
              <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Running
              </span>
            )}
          </div>

          {task.tags && task.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {task.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 text-xs rounded-full bg-primary/10 text-primary font-medium"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
            <div>
              {task.calibratedMinutes ? (
                <span>
                  {task.nominalMinutes}m &rarr; {task.calibratedMinutes}m
                </span>
              ) : (
                <span>{task.nominalMinutes}m est.</span>
              )}
            </div>
          </div>
        </div>

        {/* Top-right card actions */}
        <div className="flex items-center gap-1 shrink-0">
          {!isCompleted && (
            <button
              type="button"
              data-testid={`start-timer-btn-${task.id}`}
              onClick={handleStartTaskTimer}
              className={`p-2 rounded-lg transition-colors cursor-pointer ${
                isTaskRunning
                  ? 'text-emerald-600 bg-emerald-500/10'
                  : 'text-muted-foreground hover:text-emerald-600 hover:bg-emerald-500/10'
              }`}
              title="Start timer"
            >
              <Play className="w-4 h-4" />
            </button>
          )}

          <button
            type="button"
            onClick={() => onEdit(task)}
            className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors cursor-pointer"
            title="Edit task"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(task.id)}
            className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors cursor-pointer"
            title="Delete task"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Subtasks Section */}
      <div className="mt-3 pl-8">
        {(task.subtasks || []).length > 0 && (
          <div className="space-y-1.5 pt-2 border-t border-border/50">
            {task.subtasks.map((st) => {
              const isSubtaskRunning =
                currentTimer?.isRunning && currentTimer?.subtaskId === st.id;
              return (
                <div
                  key={st.id}
                  data-testid={`subtask-row-${st.id}`}
                  className="group/st flex items-center gap-2 p-1 rounded-md hover:bg-muted/40 transition-colors"
                >
                  <button
                    type="button"
                    data-testid={`subtask-check-${st.id}`}
                    onClick={() => handleToggleSubtask(st)}
                    className={`shrink-0 w-4 h-4 rounded-sm border flex items-center justify-center transition-colors cursor-pointer ${
                      st.done
                        ? 'bg-primary border-primary text-primary-foreground'
                        : 'border-border text-transparent hover:border-primary'
                    }`}
                  >
                    <Check className="w-3 h-3" />
                  </button>

                  <span
                    className={`flex-1 text-xs truncate ${
                      st.done
                        ? 'line-through text-muted-foreground'
                        : 'text-foreground'
                    }`}
                  >
                    {st.title}
                  </span>

                  {isSubtaskRunning && (
                    <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full flex items-center gap-1 shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Running
                    </span>
                  )}

                  {!isCompleted && (
                    <button
                      type="button"
                      data-testid={`subtask-start-btn-${st.id}`}
                      onClick={() => handleStartSubtaskTimer(st)}
                      className={`p-1 text-muted-foreground hover:text-emerald-600 hover:bg-emerald-500/10 rounded transition-colors cursor-pointer ${
                        isSubtaskRunning ? 'text-emerald-600 font-bold' : ''
                      }`}
                      title="Start subtask timer"
                    >
                      <Play className="w-3 h-3" />
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => handleRemoveSubtask(st.id)}
                    className="opacity-0 group-hover/st:opacity-100 p-1 text-muted-foreground hover:text-destructive rounded transition-all cursor-pointer"
                    title="Remove subtask"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Inline Add Subtask Input */}
        <div className="flex items-center gap-2 p-1 mt-1 text-xs text-muted-foreground">
          <Plus className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <input
            type="text"
            data-testid="subtask-add-input"
            value={newSubtaskTitle}
            onChange={(e) => setNewSubtaskTitle(e.target.value)}
            onKeyDown={handleAddSubtask}
            placeholder="Add a subtask (press Enter)"
            className="flex-1 bg-transparent border-none focus:ring-0 text-xs text-foreground placeholder-muted-foreground outline-none"
          />
        </div>
      </div>

      {/* Prominent Activity & Splits Toggle Button */}
      <button
        type="button"
        data-testid={`timeline-toggle-${task.id}`}
        onClick={() => setIsExpanded(!isExpanded)}
        className="mt-3.5 flex items-center justify-between w-full px-3 py-2 rounded-lg border border-border/80 bg-muted/40 hover:bg-muted/70 text-xs font-medium text-foreground transition-all cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <History className="w-3.5 h-3.5 text-primary shrink-0" />
          <span>{isCompleted ? 'Completion Time Split & Sessions' : 'Activity Split & Sessions'}</span>
        </div>
        <div className="flex items-center gap-1.5 text-muted-foreground text-[11px]">
          <span>{isExpanded ? 'Hide' : 'View'}</span>
          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </div>
      </button>

      {/* Expandable Section: Timeline & Split */}
      {isExpanded && (
        <div className="mt-3 pt-1">
          <TaskTimeline task={task} />
        </div>
      )}
    </motion.div>
  );
};
