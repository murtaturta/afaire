"use client";

import React, { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { TimerSession } from '@/lib/db/types';
import { getSessionsByTask } from '@/lib/db/sessions';
import { format } from 'date-fns';
import { formatDuration } from '@/lib/utils/duration';

interface TaskHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  taskId: string;
  taskTitle: string;
}

export const TaskHistoryModal: React.FC<TaskHistoryModalProps> = ({
  isOpen,
  onClose,
  taskId,
  taskTitle,
}) => {
  const [sessions, setSessions] = useState<TimerSession[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadSessions();
    }
  }, [isOpen, taskId]);

  const loadSessions = async () => {
    setIsLoading(true);
    try {
      const data = await getSessionsByTask(taskId);
      // Sort by start time descending (newest first)
      data.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
      setSessions(data);
    } catch (error) {
      console.error("Failed to load sessions", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`History: ${taskTitle}`}>
      <div className="space-y-4 max-h-[60vh] overflow-y-auto">
        {isLoading ? (
          <p className="text-zinc-500 text-center py-4">Loading history...</p>
        ) : sessions.length === 0 ? (
          <p className="text-zinc-500 text-center py-4">No timer sessions recorded for this task yet.</p>
        ) : (
          <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {sessions.map(session => (
              <div key={session.id} className="py-3 flex flex-col gap-1">
                <div className="flex justify-between items-start">
                  <span className="font-medium text-sm text-zinc-900 dark:text-zinc-100">
                    {format(new Date(session.startedAt), 'MMM d, yyyy')}
                  </span>
                  <span className="text-sm font-mono font-medium text-blue-600 dark:text-blue-400">
                    {formatDuration(session.activeDurationMs)}
                  </span>
                </div>
                <div className="text-xs text-zinc-500 flex justify-between">
                  <span>
                    Started: {format(new Date(session.startedAt), 'h:mm a')}
                    {session.endedAt && ` • Ended: ${format(new Date(session.endedAt), 'h:mm a')}`}
                  </span>
                  {session.pausedDurations.length > 0 && (
                    <span>Pauses: {session.pausedDurations.length}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
};
