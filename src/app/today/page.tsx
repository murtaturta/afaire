"use client";

import React, { useState } from 'react';
import { format } from "date-fns";
import { Plus } from "lucide-react";
import { TaskList } from '@/components/tasks/TaskList';
import { TaskForm, TaskFormData } from '@/components/tasks/TaskForm';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Task } from '@/lib/db/types';
import { createTask, updateTask, deleteTask } from '@/lib/db/tasks';
import { useTimerStore } from '@/stores/timerStore';
import { useTasksForDate } from '@/hooks/useData';

export default function TodayPage() {
  const todayDate = format(new Date(), "yyyy-MM-dd");
  const displayDate = format(new Date(), "EEEE, MMMM d, yyyy");
  
  const tasks = useTasksForDate(todayDate) || [];
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [taskToEdit, setTaskToEdit] = useState<Task | undefined>(undefined);
  
  const startTimer = useTimerStore(state => state.startTimer);

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

  const handleSubmitTask = async (data: TaskFormData) => {
    if (taskToEdit) {
      await updateTask(taskToEdit.id, data);
    } else {
      await createTask({ ...data, subtasks: [], status: 'pending', scheduledDate: data.scheduledDate || todayDate });
    }
    handleCloseModal();
  };

  const handleDeleteTask = async (taskId: string) => {
    await deleteTask(taskId);
  };

  const handleStatusChange = async (taskId: string, status: Task['status']) => {
    await updateTask(taskId, { 
      status, 
      completedAt: status === 'completed' ? new Date().toISOString() : undefined 
    });
  };

  const handleStartTimer = (task: Task) => {
    startTimer(task);
  };

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <header className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Today</h1>
          <p className="text-muted-foreground mt-1">{displayDate}</p>
        </div>
        <Button variant="primary" onClick={handleOpenNewTask} className="flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Add Task
        </Button>
      </header>
      
      <div className="mt-8">
        <TaskList 
          tasks={tasks}
          onEdit={handleOpenEditTask}
          onDelete={handleDeleteTask}
          onStatusChange={handleStatusChange}
          onStartTimer={handleStartTimer}
          onViewHistory={() => {}}
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
    </div>
  );
}
