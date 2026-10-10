"use client";

import React, { useState } from 'react';
import { Subtask } from '@/lib/db/types';
import { X, Plus, Check } from 'lucide-react';

interface SubtaskListProps {
  subtasks: Subtask[];
  onChange: (subtasks: Subtask[]) => void;
  readonly?: boolean;
}

export const SubtaskList: React.FC<SubtaskListProps> = ({
  subtasks,
  onChange,
  readonly = false
}) => {
  const [newSubtask, setNewSubtask] = useState('');

  const handleToggle = (id: string) => {
    if (readonly) return;
    const updated = subtasks.map(st => 
      st.id === id ? { ...st, done: !st.done } : st
    );
    onChange(updated);
  };

  const handleDelete = (id: string) => {
    if (readonly) return;
    const updated = subtasks.filter(st => st.id !== id);
    onChange(updated);
  };

  const handleAdd = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && newSubtask.trim() && !readonly) {
      e.preventDefault();
      const updated = [
        ...subtasks,
        {
          id: crypto.randomUUID(),
          title: newSubtask.trim(),
          done: false
        }
      ];
      onChange(updated);
      setNewSubtask('');
    }
  };

  return (
    <div className="space-y-2">
      {subtasks.map(st => (
        <div key={st.id} className="group flex items-center gap-2 p-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 rounded-md transition-colors">
          <button
            onClick={() => handleToggle(st.id)}
            disabled={readonly}
            className={`shrink-0 w-4 h-4 rounded-sm border flex items-center justify-center transition-colors ${
              st.done 
                ? 'bg-blue-500 border-blue-500 text-white' 
                : 'border-zinc-300 dark:border-zinc-600 text-transparent hover:border-blue-400'
            }`}
          >
            <Check className="w-3 h-3" />
          </button>
          
          <span className={`flex-1 text-sm ${st.done ? 'line-through text-zinc-500' : 'text-zinc-700 dark:text-zinc-300'}`}>
            {st.title}
          </span>
          
          {!readonly && (
            <button
              onClick={() => handleDelete(st.id)}
              className="opacity-0 group-hover:opacity-100 p-1 text-zinc-400 hover:text-red-500 rounded transition-all"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      ))}
      
      {!readonly && (
        <div className="flex items-center gap-2 p-1.5 mt-2">
          <Plus className="w-4 h-4 text-zinc-400" />
          <input
            type="text"
            value={newSubtask}
            onChange={(e) => setNewSubtask(e.target.value)}
            onKeyDown={handleAdd}
            placeholder="Add a subtask (press Enter)"
            className="flex-1 bg-transparent border-none focus:ring-0 text-sm text-zinc-700 dark:text-zinc-300 placeholder-zinc-400 outline-none"
          />
        </div>
      )}
    </div>
  );
};
