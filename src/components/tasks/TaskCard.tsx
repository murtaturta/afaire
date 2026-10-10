"use client";

import React from 'react';
import { Task } from '@/lib/db/types';
import { Play, Pencil, Trash2, CheckCircle2, Circle } from 'lucide-react';
import { motion } from 'framer-motion';

interface TaskCardProps {
  task: Task;
  onEdit: (task: Task) => void;
  onDelete: (taskId: string) => void;
  onStatusChange: (taskId: string, status: Task['status']) => void;
  onStartTimer: (task: Task) => void;
  onViewHistory: (task: Task) => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({
  task,
  onEdit,
  onDelete,
  onStatusChange,
  onStartTimer,
  onViewHistory
}) => {
  const isCompleted = task.status === 'completed';

  const toggleStatus = () => {
    onStatusChange(task.id, isCompleted ? 'pending' : 'completed');
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ scale: 1.01 }}
      className={`group relative flex items-start gap-3 p-4 rounded-xl border bg-white dark:bg-zinc-900 shadow-sm transition-colors ${
        isCompleted ? 'border-zinc-200 dark:border-zinc-800 opacity-60' : 'border-zinc-200 dark:border-zinc-700'
      }`}
    >
      <button 
        onClick={toggleStatus}
        className="mt-0.5 text-zinc-400 hover:text-blue-500 transition-colors shrink-0"
      >
        {isCompleted ? (
          <CheckCircle2 className="w-5 h-5 text-green-500" />
        ) : (
          <Circle className="w-5 h-5" />
        )}
      </button>

      <div className="flex-1 min-w-0">
        <h3 className={`text-base font-medium truncate ${isCompleted ? 'line-through text-zinc-500' : 'text-zinc-900 dark:text-zinc-100'}`}>
          {task.title}
        </h3>
        
        {task.tags && task.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {task.tags.map(tag => (
              <span key={tag} className="px-2 py-0.5 text-xs rounded-full bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                {tag}
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 mt-3 text-sm text-zinc-500 dark:text-zinc-400">
          <div className="flex items-center">
            {task.calibratedMinutes ? (
              <span>{task.nominalMinutes}m &rarr; {task.calibratedMinutes}m</span>
            ) : (
              <span>{task.nominalMinutes}m</span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {!isCompleted && (
          <button
            onClick={() => onStartTimer(task)}
            className="p-2 text-zinc-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
            title="Start timer"
          >
            <Play className="w-4 h-4" />
          </button>
        )}
        <button
          onClick={() => onViewHistory(task)}
          className="p-2 text-zinc-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
          title="View history"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>
        <button
          onClick={() => onEdit(task)}
          className="p-2 text-zinc-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
          title="Edit task"
        >
          <Pencil className="w-4 h-4" />
        </button>
        <button
          onClick={() => onDelete(task.id)}
          className="p-2 text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
          title="Delete task"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  );
};
