"use client";

import React, { useState } from 'react';
import { Task, Subtask } from '@/lib/db/types';
import { SubtaskList } from './SubtaskList';
import { TASK_COLORS, DEFAULT_TASK_COLOR } from '@/lib/constants/colors';
import { X, Clock, Check } from 'lucide-react';

export interface TaskFormData {
  title: string;
  description: string;
  tags: string[];
  subtasks: Subtask[];
  nominalMinutes: number;
  isRecurring: boolean;
  recurrenceRule?: string;
  scheduledDate?: string;
  timeSlotPreference: 'morning' | 'afternoon' | 'evening' | 'any';
  color?: string;
}

interface TaskFormProps {
  task?: Task;
  onSubmit: (data: TaskFormData) => void;
  onCancel: () => void;
}

const QUICK_MINUTES = [15, 30, 45, 60, 90, 120];

export const TaskForm: React.FC<TaskFormProps> = ({ task, onSubmit, onCancel }) => {
  const [title, setTitle] = useState(task?.title || '');
  const [description, setDescription] = useState(task?.description || '');
  const [tags, setTags] = useState<string[]>(task?.tags || []);
  const [tagInput, setTagInput] = useState('');
  const [subtasks, setSubtasks] = useState<Subtask[]>(task?.subtasks || []);
  const [color, setColor] = useState<string>(task?.color || DEFAULT_TASK_COLOR);
  const [nominalMinutes, setNominalMinutes] = useState<number>(task?.nominalMinutes || 30);
  const [scheduledDate, setScheduledDate] = useState<string>(
    task?.scheduledDate ? new Date(task.scheduledDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
  );
  const [timeSlotPreference, setTimeSlotPreference] = useState<TaskFormData['timeSlotPreference']>(
    task?.timeSlotPreference || 'any'
  );
  const [isRecurring, setIsRecurring] = useState(!!task?.recurrenceRule);
  const [recurrenceRule, setRecurrenceRule] = useState(task?.recurrenceRule || 'daily');

  const handleAddTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      if (!tags.includes(tagInput.trim())) {
        setTags([...tags, tagInput.trim()]);
      }
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(t => t !== tagToRemove));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      title,
      description,
      tags,
      subtasks,
      color,
      nominalMinutes,
      isRecurring,
      recurrenceRule: isRecurring ? recurrenceRule : undefined,
      scheduledDate,
      timeSlotPreference,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Title *</label>
        <input
          type="text"
          data-testid="task-form-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          autoFocus
          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-zinc-800 dark:border-zinc-700"
          placeholder="What needs to be done?"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Color Theme</label>
        <div className="flex items-center gap-2.5 flex-wrap">
          {TASK_COLORS.map((c) => {
            const isSelected = color === c.value;
            return (
              <button
                key={c.value}
                type="button"
                onClick={() => setColor(c.value)}
                style={{ backgroundColor: c.value }}
                className={`w-7 h-7 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                  isSelected ? 'ring-2 ring-offset-2 ring-primary scale-110' : 'opacity-80 hover:opacity-100 hover:scale-105'
                }`}
                title={c.name}
              >
                {isSelected && <Check className="w-4 h-4 text-white stroke-[3]" />}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-zinc-800 dark:border-zinc-700"
          rows={3}
          placeholder="Add some details..."
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Subtasks</label>
        <SubtaskList subtasks={subtasks} onChange={setSubtasks} />
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Tags</label>
        <div className="flex flex-wrap gap-2 mb-2">
          {tags.map(tag => (
            <span key={tag} className="flex items-center gap-1 px-2 py-1 text-sm bg-zinc-100 dark:bg-zinc-800 rounded-md">
              {tag}
              <button type="button" onClick={() => handleRemoveTag(tag)} className="text-zinc-400 hover:text-zinc-600">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
        <input
          type="text"
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          onKeyDown={handleAddTag}
          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-zinc-800 dark:border-zinc-700"
          placeholder="Type a tag and press Enter"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Estimated Time (minutes)</label>
        <div className="flex flex-wrap gap-2 mb-2">
          {QUICK_MINUTES.map(mins => (
            <button
              key={mins}
              type="button"
              onClick={() => setNominalMinutes(mins)}
              className={`px-3 py-1 text-sm rounded-full border transition-colors cursor-pointer ${
                nominalMinutes === mins 
                  ? 'bg-blue-50 border-blue-200 text-blue-600 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-400' 
                  : 'bg-transparent border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800'
              }`}
            >
              {mins}m
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-zinc-400" />
          <input
            type="number"
            min="1"
            value={nominalMinutes}
            onChange={(e) => setNominalMinutes(parseInt(e.target.value) || 1)}
            className="w-24 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-zinc-800 dark:border-zinc-700"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Scheduled Date</label>
          <input
            type="date"
            value={scheduledDate}
            onChange={(e) => setScheduledDate(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-zinc-800 dark:border-zinc-700"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Time Slot</label>
          <select
            value={timeSlotPreference}
            onChange={(e) => setTimeSlotPreference(e.target.value as any)}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-zinc-800 dark:border-zinc-700"
          >
            <option value="any">Any Time</option>
            <option value="morning">Morning</option>
            <option value="afternoon">Afternoon</option>
            <option value="evening">Evening</option>
          </select>
        </div>
      </div>

      <div>
        <label className="flex items-center gap-2 mb-2 cursor-pointer">
          <input
            type="checkbox"
            checked={isRecurring}
            onChange={(e) => setIsRecurring(e.target.checked)}
            className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Recurring Task</span>
        </label>
        
        {isRecurring && (
          <select
            value={recurrenceRule}
            onChange={(e) => setRecurrenceRule(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-zinc-800 dark:border-zinc-700"
          >
            <option value="daily">Daily</option>
            <option value="weekdays">Weekdays</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        )}
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-zinc-200 dark:border-zinc-700">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-zinc-700 bg-white border border-zinc-300 rounded-lg hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:bg-zinc-800 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-700 cursor-pointer"
        >
          Cancel
        </button>
        <button
          type="submit"
          data-testid="task-form-submit"
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 cursor-pointer"
        >
          {task ? 'Update Task' : 'Create Task'}
        </button>
      </div>
    </form>
  );
};
