"use client";

import React, { useState } from 'react';
import { Subtask } from '@/lib/db/types';
import { X, Plus, Check, MessageSquare } from 'lucide-react';

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
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);

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

  const handleCommentChange = (id: string, comment: string) => {
    const updated = subtasks.map(st =>
      st.id === id ? { ...st, comment: comment.trim() || undefined } : st
    );
    onChange(updated);
  };

  return (
    <div className="space-y-2">
      {subtasks.map(st => (
        <div key={st.id} className="space-y-1">
          <div className="group flex items-center gap-2 p-1.5 hover:bg-muted/40 rounded-md transition-colors">
            <button
              type="button"
              onClick={() => handleToggle(st.id)}
              disabled={readonly}
              className={`shrink-0 w-4 h-4 rounded-sm border flex items-center justify-center transition-colors cursor-pointer ${
                st.done 
                  ? 'bg-primary border-primary text-primary-foreground' 
                  : 'border-border text-transparent hover:border-primary'
              }`}
            >
              <Check className="w-3 h-3" />
            </button>
            
            <span className={`flex-1 text-sm ${st.done ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
              {st.title}
            </span>

            {!readonly && (
              <button
                type="button"
                onClick={() => setEditingCommentId(editingCommentId === st.id ? null : st.id)}
                className={`p-1 rounded transition-colors cursor-pointer ${
                  st.comment
                    ? 'text-primary hover:bg-primary/10'
                    : 'opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
                title={st.comment ? 'Edit comment' : 'Add comment'}
              >
                <MessageSquare className="w-3.5 h-3.5" />
              </button>
            )}
            
            {!readonly && (
              <button
                type="button"
                onClick={() => handleDelete(st.id)}
                className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-destructive rounded transition-all cursor-pointer"
                title="Remove subtask"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Subtask comment inline */}
          {editingCommentId === st.id && !readonly ? (
            <div className="pl-6 pb-1 flex items-center gap-2">
              <input
                type="text"
                autoFocus
                value={st.comment || ''}
                onChange={(e) => handleCommentChange(st.id, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === 'Escape') {
                    setEditingCommentId(null);
                  }
                }}
                placeholder="Add subtask comment / detail..."
                className="flex-1 text-xs px-2 py-1 rounded border border-border bg-background text-foreground focus:ring-1 focus:ring-primary outline-none"
              />
              <button
                type="button"
                onClick={() => setEditingCommentId(null)}
                className="text-xs text-primary font-medium hover:underline cursor-pointer"
              >
                Done
              </button>
            </div>
          ) : st.comment ? (
            <div
              onClick={() => !readonly && setEditingCommentId(st.id)}
              className="pl-6 pb-1 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <span className="italic">{st.comment}</span>
            </div>
          ) : null}
        </div>
      ))}
      
      {!readonly && (
        <div className="flex items-center gap-2 p-1.5 mt-2">
          <Plus className="w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            data-testid="subtask-add-input"
            value={newSubtask}
            onChange={(e) => setNewSubtask(e.target.value)}
            onKeyDown={handleAdd}
            placeholder="Add a subtask (press Enter)"
            className="flex-1 bg-transparent border-none focus:ring-0 text-sm text-foreground placeholder-muted-foreground outline-none"
          />
        </div>
      )}
    </div>
  );
};
