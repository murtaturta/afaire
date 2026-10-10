"use client";

import React from 'react';
import { Task } from '@/lib/db/types';
import { TaskCard } from './TaskCard';
import { motion, AnimatePresence } from 'framer-motion';
import { ClipboardList } from 'lucide-react';

interface TaskListProps {
  tasks: Task[];
  onEdit: (task: Task) => void;
  onDelete: (taskId: string) => void;
  onStatusChange?: (taskId: string, status: Task['status']) => void;
  onStartTimer?: (task: Task) => void;
  emptyMessage?: string;
}

export const TaskList: React.FC<TaskListProps> = ({
  tasks,
  onEdit,
  onDelete,
  onStatusChange,
  onStartTimer,
  emptyMessage = "No tasks yet"
}) => {
  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-zinc-400">
        <ClipboardList className="w-12 h-12 mb-4 opacity-50" />
        <p className="text-sm font-medium">{emptyMessage}</p>
      </div>
    );
  }

  // Sort tasks: pending first, then completed
  const sortedTasks = [...tasks].sort((a, b) => {
    if (a.status === 'completed' && b.status !== 'completed') return 1;
    if (a.status !== 'completed' && b.status === 'completed') return -1;
    return 0;
  });

  return (
    <div className="space-y-3">
      <AnimatePresence mode="popLayout">
        {sortedTasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            onEdit={onEdit}
            onDelete={onDelete}
            onStatusChange={onStatusChange}
            onStartTimer={onStartTimer}
          />
        ))}
      </AnimatePresence>
    </div>
  );
};
