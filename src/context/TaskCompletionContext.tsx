"use client";

import React, { createContext, useContext, useState, useCallback } from 'react';
import type { Task } from '@/lib/db/types';
import { completeTask, applyOutlierChoice } from '@/lib/timer/sessionService';
import { OutlierPrompt } from '@/components/timer/OutlierPrompt';

interface OutlierState {
  sessionId: string;
  taskId: string;
  taskTitle: string;
  nominalMinutes: number;
  actualMinutes: number;
}

interface TaskCompletionContextValue {
  completeWithOutlierCheck: (task: Task) => Promise<void>;
}

const TaskCompletionContext = createContext<TaskCompletionContextValue | null>(null);

export function TaskCompletionProvider({ children }: { children: React.ReactNode }) {
  const [outlierData, setOutlierData] = useState<OutlierState | null>(null);

  const completeWithOutlierCheck = useCallback(async (task: Task) => {
    const res = await completeTask(task.id, task.nominalMinutes);
    if (res.isOutlier && res.session) {
      setOutlierData({
        sessionId: res.session.id,
        taskId: task.id,
        taskTitle: task.title,
        nominalMinutes: task.nominalMinutes,
        actualMinutes: res.actualMinutes,
      });
    }
  }, []);

  const handleAccept = useCallback(async () => {
    if (!outlierData) return;
    const { sessionId, taskId } = outlierData;
    setOutlierData(null);
    await applyOutlierChoice(sessionId, taskId, 'accept');
  }, [outlierData]);

  const handleAdjust = useCallback(async (adjustedMinutes: number) => {
    if (!outlierData) return;
    const { sessionId, taskId } = outlierData;
    setOutlierData(null);
    await applyOutlierChoice(sessionId, taskId, 'adjust', adjustedMinutes);
  }, [outlierData]);

  const handleExclude = useCallback(async () => {
    if (!outlierData) return;
    const { sessionId, taskId } = outlierData;
    setOutlierData(null);
    await applyOutlierChoice(sessionId, taskId, 'exclude');
  }, [outlierData]);

  return (
    <TaskCompletionContext.Provider value={{ completeWithOutlierCheck }}>
      {children}
      {outlierData && (
        <OutlierPrompt
          isOpen={true}
          taskTitle={outlierData.taskTitle}
          nominalMinutes={outlierData.nominalMinutes}
          actualMinutes={outlierData.actualMinutes}
          onAccept={handleAccept}
          onAdjust={handleAdjust}
          onExclude={handleExclude}
        />
      )}
    </TaskCompletionContext.Provider>
  );
}

export function useTaskCompletion() {
  const context = useContext(TaskCompletionContext);
  if (!context) {
    throw new Error('useTaskCompletion must be used within a TaskCompletionProvider');
  }
  return context;
}
