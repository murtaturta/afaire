"use client";

import React, { useState, useMemo } from 'react';
import { useAllTasks, useAllSessions } from '@/hooks/useData';
import { TaskList } from '@/components/tasks/TaskList';
import { TaskForm, TaskFormData } from '@/components/tasks/TaskForm';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Task } from '@/lib/db/types';
import { createTask, updateTask, deleteTask } from '@/lib/db/tasks';
import { startSession } from '@/lib/timer/sessionService';
import { useTaskCompletion } from '@/context/TaskCompletionContext';
import {
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Calendar,
  Layers,
  ArrowUpDown
} from 'lucide-react';

export default function TasksPage() {
  const allTasks = useAllTasks() || [];
  const allSessions = useAllSessions() || [];

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'completed' | 'rolled-over'>('all');
  const [selectedTag, setSelectedTag] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'date' | 'title'>('newest');

  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [taskToEdit, setTaskToEdit] = useState<Task | undefined>(undefined);

  const { completeWithOutlierCheck } = useTaskCompletion();

  // Extract unique tags
  const uniqueTags = useMemo(() => {
    const set = new Set<string>();
    for (const t of allTasks) {
      if (t.tags) {
        for (const tag of t.tags) {
          set.add(tag);
        }
      }
    }
    return Array.from(set).sort();
  }, [allTasks]);

  // Filtered & sorted tasks
  const filteredTasks = useMemo(() => {
    return allTasks
      .filter((task) => {
        // Status filter
        if (statusFilter !== 'all') {
          if (statusFilter === 'pending' && task.status !== 'pending' && task.status !== 'active') return false;
          if (statusFilter === 'completed' && task.status !== 'completed') return false;
          if (statusFilter === 'rolled-over' && task.status !== 'rolled-over') return false;
        }

        // Tag filter
        if (selectedTag !== 'all') {
          if (!task.tags || !task.tags.includes(selectedTag)) return false;
        }

        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchTitle = task.title.toLowerCase().includes(q);
          const matchDesc = task.description?.toLowerCase().includes(q);
          const matchTag = task.tags?.some((t) => t.toLowerCase().includes(q));
          if (!matchTitle && !matchDesc && !matchTag) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'newest') {
          return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
        }
        if (sortBy === 'date') {
          return (a.scheduledDate || '9999').localeCompare(b.scheduledDate || '9999');
        }
        return a.title.localeCompare(b.title);
      });
  }, [allTasks, statusFilter, selectedTag, searchQuery, sortBy]);

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
      await createTask({
        ...data,
        subtasks: data.subtasks || [],
        status: 'pending',
      });
    }
    handleCloseModal();
  };

  const handleDeleteTask = async (taskId: string) => {
    await deleteTask(taskId);
  };

  const handleStatusChange = async (taskId: string, status: Task['status']) => {
    if (status === 'completed') {
      const task = allTasks.find((t) => t.id === taskId);
      if (task) {
        await completeWithOutlierCheck(task);
      } else {
        await updateTask(taskId, { status, completedAt: new Date().toISOString() });
      }
    } else {
      await updateTask(taskId, {
        status: 'pending',
        completedAt: undefined,
      });
    }
  };

  const handleStartTimer = async (task: Task) => {
    await startSession(task);
  };

  const completedCount = allTasks.filter((t) => t.status === 'completed').length;
  const pendingCount = allTasks.filter((t) => t.status === 'pending' || t.status === 'active').length;

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6 pb-36">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">All Tasks</h1>
          <p className="text-muted-foreground mt-1">
            Manage your full library, review past tasks, and edit session timecodes
          </p>
        </div>
        <Button
          variant="primary"
          onClick={handleOpenNewTask}
          data-testid="add-task-btn"
          className="flex items-center gap-2 cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          Add Task
        </Button>
      </header>

      {/* Controls Bar */}
      <div className="p-4 rounded-xl border border-border bg-card space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
          {/* Search Box */}
          <div className="flex-1 relative">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by title, description, or tag..."
              className="w-full text-xs pl-9 pr-3 py-2 rounded-lg border border-border bg-muted/30 text-foreground outline-none focus:border-primary placeholder-muted-foreground"
            />
          </div>

          {/* Status Filter Tabs */}
          <div className="flex items-center gap-1 bg-muted p-1 rounded-lg border border-border shrink-0 text-xs">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-card text-foreground shadow-xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              All ({allTasks.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('pending')}
              className={`px-3 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                statusFilter === 'pending'
                  ? 'bg-card text-foreground shadow-xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Pending ({pendingCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('completed')}
              className={`px-3 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                statusFilter === 'completed'
                  ? 'bg-card text-foreground shadow-xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Completed ({completedCount})
            </button>
          </div>
        </div>

        {/* Secondary filters (Tag, Sort) */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border/60 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground flex items-center gap-1">
              <Filter className="w-3.5 h-3.5" />
              <span>Tag:</span>
            </span>
            <select
              value={selectedTag}
              onChange={(e) => setSelectedTag(e.target.value)}
              className="px-2 py-1 rounded-md border border-border bg-muted/40 text-foreground outline-none text-xs"
            >
              <option value="all">All Tags</option>
              {uniqueTags.map((tag) => (
                <option key={tag} value={tag}>
                  {tag}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-muted-foreground flex items-center gap-1">
              <ArrowUpDown className="w-3.5 h-3.5" />
              <span>Sort:</span>
            </span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-2 py-1 rounded-md border border-border bg-muted/40 text-foreground outline-none text-xs"
            >
              <option value="newest">Newest First</option>
              <option value="date">Scheduled Date</option>
              <option value="title">Title A-Z</option>
            </select>
          </div>
        </div>
      </div>

      {/* Task List */}
      <div>
        <TaskList
          tasks={filteredTasks}
          onEdit={handleOpenEditTask}
          onDelete={handleDeleteTask}
          onStatusChange={handleStatusChange}
          onStartTimer={handleStartTimer}
          emptyMessage={
            searchQuery.trim() || statusFilter !== 'all' || selectedTag !== 'all'
              ? 'No tasks match the active filters'
              : 'No tasks in your library yet. Click "Add Task" to create your first one.'
          }
        />
      </div>

      {/* Task Edit/Create Modal */}
      <Modal
        isOpen={isTaskModalOpen}
        onClose={handleCloseModal}
        title={taskToEdit ? 'Edit Task' : 'New Task'}
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
