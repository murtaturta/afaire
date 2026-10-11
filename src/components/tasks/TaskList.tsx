"use client";

import React from 'react';
import { Task } from '@/lib/db/types';
import { TaskCard } from './TaskCard';
import { Reorder, useDragControls } from 'framer-motion';
import { ClipboardList } from 'lucide-react';

interface TaskListProps {
  tasks: Task[];
  onEdit: (task: Task) => void;
  onDelete: (taskId: string) => void;
  onStatusChange?: (taskId: string, status: Task['status']) => void;
  onStartTimer?: (task: Task) => void;
  onReorder?: (reorderedTasks: Task[]) => void;
  emptyMessage?: string;
}

const ReorderableTaskCard: React.FC<{
  task: Task;
  onEdit: (task: Task) => void;
  onDelete: (taskId: string) => void;
  onStatusChange?: (taskId: string, status: Task['status']) => void;
  onStartTimer?: (task: Task) => void;
}> = ({ task, onEdit, onDelete, onStatusChange, onStartTimer }) => {
  const dragControls = useDragControls();

  return (
    <Reorder.Item
      value={task}
      as="div"
      dragListener={false}
      dragControls={dragControls}
      className="relative select-none"
    >
      <TaskCard
        task={task}
        onEdit={onEdit}
        onDelete={onDelete}
        onStatusChange={onStatusChange}
        onStartTimer={onStartTimer}
        dragControls={dragControls}
        isDraggable={true}
      />
    </Reorder.Item>
  );
};

export const TaskList: React.FC<TaskListProps> = ({
  tasks,
  onEdit,
  onDelete,
  onStatusChange,
  onStartTimer,
  onReorder,
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

  const pendingTasks = tasks.filter((t) => t.status !== 'completed');
  const completedTasks = tasks.filter((t) => t.status === 'completed');

  const handleReorder = (newOrder: Task[]) => {
    if (onReorder) {
      onReorder(newOrder);
    }
  };

  return (
    <div className="space-y-4">
      {/* Active / Pending Tasks */}
      {pendingTasks.length > 0 && (
        onReorder ? (
          <Reorder.Group
            axis="y"
            values={pendingTasks}
            onReorder={handleReorder}
            className="space-y-3"
          >
            {pendingTasks.map((task) => (
              <ReorderableTaskCard
                key={task.id}
                task={task}
                onEdit={onEdit}
                onDelete={onDelete}
                onStatusChange={onStatusChange}
                onStartTimer={onStartTimer}
              />
            ))}
          </Reorder.Group>
        ) : (
          <div className="space-y-3">
            {pendingTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onEdit={onEdit}
                onDelete={onDelete}
                onStatusChange={onStatusChange}
                onStartTimer={onStartTimer}
                isDraggable={false}
              />
            ))}
          </div>
        )
      )}

      {/* Completed Tasks */}
      {completedTasks.length > 0 && (
        <div className="space-y-3 pt-3 border-t border-border/50">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Completed ({completedTasks.length})
            </span>
          </div>
          <div className="space-y-3">
            {completedTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onEdit={onEdit}
                onDelete={onDelete}
                onStatusChange={onStatusChange}
                onStartTimer={onStartTimer}
                isDraggable={false}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
