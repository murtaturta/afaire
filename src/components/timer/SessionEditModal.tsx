"use client";

import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Task, TimerSession } from '@/lib/db/types';
import { editSessionTimecodes, deleteSessionRecord, addManualSession } from '@/lib/timer/sessionService';
import { formatMinutes } from '@/lib/utils/duration';
import { Clock, Trash2, Calendar, Check } from 'lucide-react';

interface SessionEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: Task;
  session?: TimerSession | null;
}

export function SessionEditModal({
  isOpen,
  onClose,
  task,
  session,
}: SessionEditModalProps) {
  const isEditing = !!session;

  const getInitialDate = () => {
    if (session?.startedAt) {
      return session.startedAt.split('T')[0];
    }
    if (task.scheduledDate) {
      return task.scheduledDate;
    }
    return new Date().toISOString().split('T')[0];
  };

  const getInitialTime = (isoString?: string, fallback = '09:00') => {
    if (!isoString) return fallback;
    const d = new Date(isoString);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const [date, setDate] = useState(getInitialDate());
  const [startTime, setStartTime] = useState(
    getInitialTime(session?.startedAt, '09:00')
  );
  const [endTime, setEndTime] = useState(
    getInitialTime(
      session?.endedAt ||
        (session?.startedAt
          ? new Date(
              new Date(session.startedAt).getTime() + (session.activeDurationMs || 1800000)
            ).toISOString()
          : undefined),
      '09:45'
    )
  );
  const [selectedSubtaskId, setSelectedSubtaskId] = useState<string>(
    session?.subtaskId || ''
  );
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setDate(getInitialDate());
      setStartTime(getInitialTime(session?.startedAt, '09:00'));
      setEndTime(
        getInitialTime(
          session?.endedAt ||
            (session?.startedAt
              ? new Date(
                  new Date(session.startedAt).getTime() +
                    (session.activeDurationMs || 1800000)
                ).toISOString()
              : undefined),
          '09:45'
        )
      );
      setSelectedSubtaskId(session?.subtaskId || '');
      setIsDeleting(false);
      setError(null);
    }
  }, [isOpen, session, task]);

  // Calculate duration in minutes
  const calculateDurationMinutes = (): number => {
    if (!startTime || !endTime || !date) return 0;
    const startIso = `${date}T${startTime}:00`;
    const endIso = `${date}T${endTime}:00`;
    const startMs = new Date(startIso).getTime();
    const endMs = new Date(endIso).getTime();
    if (isNaN(startMs) || isNaN(endMs) || endMs <= startMs) return 0;
    return Math.round((endMs - startMs) / 60000);
  };

  const durationMinutes = calculateDurationMinutes();

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!date || !startTime || !endTime) {
      setError('Please fill in date, start time, and end time.');
      return;
    }

    const startIso = new Date(`${date}T${startTime}:00`).toISOString();
    const endIso = new Date(`${date}T${endTime}:00`).toISOString();

    if (new Date(endIso).getTime() <= new Date(startIso).getTime()) {
      setError('End time must be after start time.');
      return;
    }

    const matchedSubtask = task.subtasks?.find((s) => s.id === selectedSubtaskId);
    const subtaskTitle = matchedSubtask ? matchedSubtask.title : undefined;

    try {
      if (isEditing && session) {
        await editSessionTimecodes(
          session.id,
          task.id,
          startIso,
          endIso,
          selectedSubtaskId || undefined,
          subtaskTitle
        );
      } else {
        await addManualSession(
          task.id,
          startIso,
          endIso,
          selectedSubtaskId || undefined,
          subtaskTitle
        );
      }
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save session');
    }
  };

  const handleDelete = async () => {
    if (!session) return;
    try {
      await deleteSessionRecord(session.id, task.id);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to delete session');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Session Timecodes' : 'Log Past Session'}
    >
      <form onSubmit={handleSave} className="space-y-5 text-foreground">
        <div>
          <h4 className="text-sm font-semibold text-foreground">{task.title}</h4>
          <p className="text-xs text-muted-foreground mt-0.5">
            Adjust recorded real-world timestamps or backfill previous work.
          </p>
        </div>

        {error && (
          <div className="p-3 rounded-lg text-xs bg-destructive/10 text-destructive border border-destructive/20 font-medium">
            {error}
          </div>
        )}

        {/* Date Input */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-primary" />
            <span>Date</span>
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            className="w-full text-xs px-3 py-2 rounded-lg border border-border bg-muted/30 text-foreground outline-none focus:border-primary"
          />
        </div>

        {/* Start and End Time Inputs */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-emerald-500" />
              <span>Start Time</span>
            </label>
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              required
              className="w-full text-xs px-3 py-2 rounded-lg border border-border bg-muted/30 text-foreground outline-none focus:border-primary font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-500" />
              <span>End Time</span>
            </label>
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              required
              className="w-full text-xs px-3 py-2 rounded-lg border border-border bg-muted/30 text-foreground outline-none focus:border-primary font-mono"
            />
          </div>
        </div>

        {/* Duration preview banner */}
        <div className="p-3 rounded-lg border border-border bg-card flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Calculated Duration:</span>
          <span
            className={`font-mono font-bold text-sm ${
              durationMinutes > 0 ? 'text-primary' : 'text-destructive'
            }`}
          >
            {durationMinutes > 0
              ? formatMinutes(durationMinutes)
              : 'Invalid time range'}
          </span>
        </div>

        {/* Subtask selector (if task has subtasks) */}
        {task.subtasks && task.subtasks.length > 0 && (
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">
              Associated Subtask (Optional)
            </label>
            <select
              value={selectedSubtaskId}
              onChange={(e) => setSelectedSubtaskId(e.target.value)}
              className="w-full text-xs px-3 py-2 rounded-lg border border-border bg-muted/30 text-foreground outline-none focus:border-primary"
            >
              <option value="">General (No subtask)</option>
              {task.subtasks.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.title} {st.done ? '(Done)' : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-3 border-t border-border">
          {isEditing ? (
            <div>
              {isDeleting ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-destructive font-medium">
                    Confirm delete?
                  </span>
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="px-2.5 py-1 rounded bg-destructive text-destructive-foreground text-xs font-medium cursor-pointer"
                  >
                    Yes, Delete
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsDeleting(false)}
                    className="px-2.5 py-1 rounded border border-border text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsDeleting(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-destructive/20 text-destructive hover:bg-destructive/10 text-xs font-medium transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Session</span>
                </button>
              )}
            </div>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground font-medium transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={durationMinutes <= 0}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-all disabled:opacity-50 cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{isEditing ? 'Save Changes' : 'Log Session'}</span>
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
