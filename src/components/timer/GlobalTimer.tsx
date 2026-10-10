"use client";

import React from 'react';
import { FocusTimer } from './FocusTimer';
import { TimerMiniPlayer } from './TimerMiniPlayer';
import { useTimer } from '@/hooks/useTimer';
import { addCompletionRecord } from '@/lib/db/history';
import { updateTask, getTask } from '@/lib/db/tasks';
import { createSession } from '@/lib/db/sessions';
import type { SessionData } from '@/stores/timerStore';

export function GlobalTimer() {
  const { timers, activeTimerId } = useTimer();

  const handleComplete = async (sessionData: SessionData) => {
    // 1. Mark task as completed
    await updateTask(sessionData.taskId, { status: 'completed', completedAt: new Date().toISOString() });
    
    // 2. Save session
    await createSession({
      taskId: sessionData.taskId,
      startedAt: new Date(sessionData.startedAt).toISOString(),
      endedAt: new Date().toISOString(),
      rawDurationMs: sessionData.rawDurationMs,
      activeDurationMs: sessionData.activeDurationMs,
      pausedDurations: sessionData.pausedDurations,
      isOutlier: false,
      excludeFromHistory: false
    });

    // 3. Refresh task to get templateId and other info
    const task = await getTask(sessionData.taskId);
    if (task) {
      // 4. Save completion record
      await addCompletionRecord({
        taskId: task.id,
        templateId: task.templateId,
        sessionId: crypto.randomUUID(),
        date: new Date().toISOString().split('T')[0],
        dayOfWeek: new Date().getDay(),
        timeOfDay: new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening',
        nominalMinutes: task.nominalMinutes,
        actualMinutes: Math.round(sessionData.activeDurationMs / 60000),
        ratio: (sessionData.activeDurationMs / 60000) / task.nominalMinutes
      });
    }
  };

  const timerIds = Object.keys(timers);
  if (timerIds.length === 0) return null;

  return (
    <>
      {activeTimerId && timers[activeTimerId] && (
        <FocusTimer taskId={activeTimerId} onComplete={handleComplete} />
      )}
      
      <div className="fixed bottom-4 right-4 flex flex-col gap-2 z-50">
        {timerIds.filter(id => id !== activeTimerId).map(id => (
          <TimerMiniPlayer key={id} taskId={id} onComplete={handleComplete} />
        ))}
      </div>
    </>
  );
}
