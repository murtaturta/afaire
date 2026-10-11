"use client";

import React, { useState } from 'react';
import { format } from "date-fns";
import { Plus } from "lucide-react";
import { TaskList } from '@/components/tasks/TaskList';
import { TaskForm, TaskFormData } from '@/components/tasks/TaskForm';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Task } from '@/lib/db/types';
import { createTask, updateTask, deleteTask, reorderTasks } from '@/lib/db/tasks';
import { startSession, stopSession } from '@/lib/timer/sessionService';
import { useTasksForDate, useSessionsForDate } from '@/hooks/useData';
import { useTimerStore } from '@/stores/timerStore';
import { useTaskCompletion } from '@/context/TaskCompletionContext';
import { DailySummaryModal } from '@/components/daily/DailySummaryModal';
import { CapacityGauge } from '@/components/capacity/CapacityGauge';
import { processRecurringTasksForDate } from '@/lib/tasks/recurrence';
import { Moon } from 'lucide-react';

export default function TodayPage() {
  const todayDate = format(new Date(), "yyyy-MM-dd");
  const displayDate = format(new Date(), "EEEE, MMMM d, yyyy");
  
  const tasks = useTasksForDate(todayDate) || [];
  const sessions = useSessionsForDate(todayDate) || [];
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [taskToEdit, setTaskToEdit] = useState<Task | undefined>(undefined);
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);

  // Automatically process recurring tasks for today
  React.useEffect(() => {
    processRecurringTasksForDate(todayDate).catch(() => {});
  }, [todayDate]);
  
  const { completeWithOutlierCheck } = useTaskCompletion();

  const handleOpenNewTask = () => {
    setTaskToEdit(undefined);
    setIsTaskModalOpen(true);
  };

  const handleOpenEditTask = (task: Task) => {
    setTaskToEdit(task);
    setIsTaskModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsTaskModalOpen(false);
    setTaskToEdit(undefined);
  };

  const handleWrapUpDay = async () => {
    // If any timers are currently running in the store, stop them to record active minutes
    const activeTimers = useTimerStore.getState().timers;
    const runningTaskIds = Object.keys(activeTimers);
    for (const taskId of runningTaskIds) {
      await stopSession(taskId);
    }
    setIsSummaryOpen(true);
  };

  const handleSubmitTask = async (data: TaskFormData) => {
    if (taskToEdit) {
      await updateTask(taskToEdit.id, data);
    } else {
      await createTask({
        ...data,
        subtasks: data.subtasks || [],
        status: 'pending',
        scheduledDate: data.scheduledDate || todayDate
      });
    }
    handleCloseModal();
  };

  const handleDeleteTask = async (taskId: string) => {
    await deleteTask(taskId);
  };

  const handleStatusChange = async (taskId: string, status: Task['status']) => {
    if (status === 'completed') {
      const task = tasks.find(t => t.id === taskId);
      if (task) {
        await completeWithOutlierCheck(task);
      } else {
        await updateTask(taskId, { status, completedAt: new Date().toISOString() });
      }
    } else {
      await updateTask(taskId, { 
        status: 'pending', 
        completedAt: undefined 
      });
    }
  };

  const handleStartTimer = async (task: Task) => {
    await startSession(task);
  };

  const handleReorder = async (reorderedPendingTasks: Task[]) => {
    await reorderTasks(reorderedPendingTasks.map((t) => t.id));
  };

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Today</h1>
          <p className="text-muted-foreground mt-1">{displayDate}</p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleWrapUpDay}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg border border-border bg-card hover:bg-muted/60 text-foreground font-medium text-xs transition-colors cursor-pointer"
          >
            <Moon className="w-4 h-4 text-primary" />
            <span>That's enough to do for today.</span>
          </button>
          <Button
            variant="primary"
            onClick={handleOpenNewTask}
            data-testid="add-task-btn"
            className="flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add Task
          </Button>
        </div>
      </header>
      
      {/* Daily Cognitive Capacity Gauge */}
      <CapacityGauge tasks={tasks} />

      <div className="mt-6">
        <TaskList 
          tasks={tasks}
          onEdit={handleOpenEditTask}
          onDelete={handleDeleteTask}
          onStatusChange={handleStatusChange}
          onStartTimer={handleStartTimer}
          onReorder={handleReorder}
        />
      </div>

      <Modal 
        isOpen={isTaskModalOpen} 
        onClose={handleCloseModal} 
        title={taskToEdit ? "Edit Task" : "New Task"}
      >
        <TaskForm 
          task={taskToEdit} 
          onSubmit={handleSubmitTask} 
          onCancel={handleCloseModal} 
        />
      </Modal>

      <DailySummaryModal
        isOpen={isSummaryOpen}
        onClose={() => setIsSummaryOpen(false)}
        todayDate={todayDate}
        tasks={tasks}
        sessions={sessions}
      />
    </div>
  );
}
