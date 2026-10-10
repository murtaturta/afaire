"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useTimerStore } from '@/stores/timerStore';
import { useAllSessions, useAllTasks } from '@/hooks/useData';
import { createSession } from '@/lib/db/sessions';
import { Modal } from '@/components/ui/Modal';
import { format } from 'date-fns';
import { formatDuration } from '@/lib/utils/duration';
import { formatElapsed } from '@/hooks/useTimer';
import { DEFAULT_TASK_COLOR } from '@/lib/constants/colors';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, SlidersHorizontal, Maximize2, Minimize2, ExternalLink, Calendar, PlusCircle } from 'lucide-react';

interface TimelineBlock {
  id: string;
  taskId: string;
  title: string;
  subtaskTitle?: string;
  color: string;
  startMs: number;
  endMs: number;
  clampedStart: number;
  clampedEnd: number;
  leftPct: number;
  widthPct: number;
  status: 'completed' | 'running' | 'paused';
  lane: number;
}

interface OfflineLogState {
  isOpen: boolean;
  gapStart: number;
  gapEnd: number;
  minutes: number;
  taskId: string;
}

export const BottomTimeline: React.FC = () => {
  const [mounted, setMounted] = useState(false);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [windowHours, setWindowHours] = useState(3);
  const [isExpanded, setIsExpanded] = useState(false);
  const [hoveredBlock, setHoveredBlock] = useState<TimelineBlock | null>(null);

  const [offlineLog, setOfflineLog] = useState<OfflineLogState>({
    isOpen: false,
    gapStart: 0,
    gapEnd: 0,
    minutes: 30,
    taskId: '',
  });

  const trackRef = useRef<HTMLDivElement>(null);

  const timers = useTimerStore((state) => state.timers);
  const rawSessions = useAllSessions() || [];
  const rawTasks = useAllTasks() || [];

  // Smooth 1-second clock advance
  useEffect(() => {
    setMounted(true);
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Map tasks by ID for title and color
  const taskMap = useMemo(() => {
    const map = new Map<string, { title: string; color: string }>();
    for (const t of rawTasks) {
      map.set(t.id, {
        title: t.title,
        color: t.color || DEFAULT_TASK_COLOR,
      });
    }
    return map;
  }, [rawTasks]);

  // Dynamic window calculation based on windowHours slider
  const pastMs = windowHours * 60 * 60 * 1000;
  const totalWindowMs = pastMs / 0.9;
  const futureMs = totalWindowMs - pastMs;
  const windowStart = currentTime - pastMs;

  const allActiveTimers = Object.values(timers);
  const runningTimers = allActiveTimers.filter((t) => t.isRunning);
  const pausedTimers = allActiveTimers.filter((t) => t.isPaused);
  const hasRunningTimer = runningTimers.length > 0;
  const hasPausedTimer = pausedTimers.length > 0 && !hasRunningTimer;

  // Compute timeline blocks
  const { blocks, hasMultiLane } = useMemo(() => {
    const list: Omit<TimelineBlock, 'lane'>[] = [];

    // 1. Past completed sessions
    for (const s of rawSessions) {
      if (s.excludeFromHistory) continue;
      const sStart = new Date(s.startedAt).getTime();
      const sEnd = s.endedAt
        ? new Date(s.endedAt).getTime()
        : sStart + s.activeDurationMs;

      if (sEnd < windowStart || sStart > currentTime) continue;

      const clampedStart = Math.max(sStart, windowStart);
      const clampedEnd = Math.min(sEnd, currentTime);
      if (clampedEnd <= clampedStart) continue;

      const leftPct = ((clampedStart - windowStart) / totalWindowMs) * 100;
      const widthPct = ((clampedEnd - clampedStart) / totalWindowMs) * 100;

      const taskInfo = taskMap.get(s.taskId);

      list.push({
        id: s.id,
        taskId: s.taskId,
        title: taskInfo?.title || 'Completed task',
        subtaskTitle: s.subtaskTitle,
        color: taskInfo?.color || DEFAULT_TASK_COLOR,
        startMs: sStart,
        endMs: sEnd,
        clampedStart,
        clampedEnd,
        leftPct,
        widthPct: Math.max(widthPct, 0.3),
        status: 'completed',
      });
    }

    // 2. Active in-progress timers (both running and paused)
    for (const t of allActiveTimers) {
      const tStart = t.startTime;
      const taskInfo = taskMap.get(t.taskId);
      const taskColor = t.task.color || taskInfo?.color || DEFAULT_TASK_COLOR;
      const taskTitle = t.task.title || taskInfo?.title || 'Active task';

      if (t.isRunning) {
        const clampedStart = Math.max(tStart, windowStart);
        const clampedEnd = currentTime;
        if (clampedEnd > clampedStart) {
          const leftPct = ((clampedStart - windowStart) / totalWindowMs) * 100;
          const widthPct = 90 - leftPct;

          list.push({
            id: `live-${t.taskId}`,
            taskId: t.taskId,
            title: taskTitle,
            subtaskTitle: t.subtaskTitle,
            color: taskColor,
            startMs: tStart,
            endMs: currentTime,
            clampedStart,
            clampedEnd,
            leftPct,
            widthPct: Math.max(widthPct, 0.4),
            status: 'running',
          });
        }
      } else if (t.isPaused && t.pauseStart) {
        const activeEnd = t.pauseStart;
        const clampedStart = Math.max(tStart, windowStart);
        const clampedActiveEnd = Math.min(activeEnd, currentTime);

        if (clampedActiveEnd > clampedStart) {
          const leftPct = ((clampedStart - windowStart) / totalWindowMs) * 100;
          const activeWidthPct = ((clampedActiveEnd - clampedStart) / totalWindowMs) * 100;

          list.push({
            id: `live-active-${t.taskId}`,
            taskId: t.taskId,
            title: taskTitle,
            subtaskTitle: t.subtaskTitle,
            color: taskColor,
            startMs: tStart,
            endMs: activeEnd,
            clampedStart,
            clampedEnd: clampedActiveEnd,
            leftPct,
            widthPct: Math.max(activeWidthPct, 0.3),
            status: 'completed',
          });
        }

        const clampedPauseStart = Math.max(t.pauseStart, windowStart);
        if (currentTime > clampedPauseStart) {
          const pauseLeftPct = ((clampedPauseStart - windowStart) / totalWindowMs) * 100;
          const pauseWidthPct = 90 - pauseLeftPct;

          list.push({
            id: `live-paused-${t.taskId}`,
            taskId: t.taskId,
            title: taskTitle,
            subtaskTitle: t.subtaskTitle,
            color: taskColor,
            startMs: t.pauseStart,
            endMs: currentTime,
            clampedStart: clampedPauseStart,
            clampedEnd: currentTime,
            leftPct: pauseLeftPct,
            widthPct: Math.max(pauseWidthPct, 0.4),
            status: 'paused',
          });
        }
      }
    }

    list.sort((a, b) => a.clampedStart - b.clampedStart);

    let lane0End = 0;
    let lane1End = 0;
    let hasMultiLane = false;

    const assigned: TimelineBlock[] = list.map((item) => {
      let lane = 0;
      if (item.clampedStart < lane0End) {
        lane = 1;
        lane1End = Math.max(lane1End, item.clampedEnd);
        hasMultiLane = true;
      } else {
        lane0End = item.clampedEnd;
      }
      return { ...item, lane };
    });

    return { blocks: assigned, hasMultiLane };
  }, [rawSessions, allActiveTimers, currentTime, windowStart, totalWindowMs, taskMap]);

  // Click-to-Scroll from Timeline to Task Card
  const handleScrollToTask = (taskId: string) => {
    const el = document.querySelector(`[data-testid="task-card-${taskId}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('ring-4', 'ring-primary', 'transition-all');
      setTimeout(() => {
        el.classList.remove('ring-4', 'ring-primary');
      }, 2000);
    }
  };

  // Click on Idle Gap to Log Offline Time
  const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickPct = (clickX / rect.width) * 100;

    if (clickPct > 90) return;

    const clickTime = windowStart + (clickPct / 100) * totalWindowMs;

    const isInsideBlock = blocks.some(
      (b) => clickTime >= b.clampedStart && clickTime <= b.clampedEnd
    );

    if (isInsideBlock) return;

    let gapStart = windowStart;
    let gapEnd = currentTime;

    for (const b of blocks) {
      if (b.endMs <= clickTime && b.endMs > gapStart) {
        gapStart = b.endMs;
      }
      if (b.startMs >= clickTime && b.startMs < gapEnd) {
        gapEnd = b.startMs;
      }
    }

    const gapMinutes = Math.max(5, Math.round((gapEnd - gapStart) / 60000));
    const defaultTaskId = rawTasks.length > 0 ? rawTasks[0].id : '';

    setOfflineLog({
      isOpen: true,
      gapStart,
      gapEnd,
      minutes: gapMinutes,
      taskId: defaultTaskId,
    });
  };

  const handleSaveOfflineSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!offlineLog.taskId || offlineLog.minutes <= 0) return;

    const sessionStart = new Date(offlineLog.gapStart);
    const sessionEnd = new Date(offlineLog.gapStart + offlineLog.minutes * 60000);

    await createSession({
      taskId: offlineLog.taskId,
      subtaskTitle: undefined,
      startedAt: sessionStart.toISOString(),
      endedAt: sessionEnd.toISOString(),
      rawDurationMs: offlineLog.minutes * 60000,
      activeDurationMs: offlineLog.minutes * 60000,
      pausedDurations: [],
      isOutlier: false,
      excludeFromHistory: false,
    });

    setOfflineLog((prev) => ({ ...prev, isOpen: false }));
  };

  if (!mounted) return null;

  return (
    <>
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-4xl z-30 select-none transition-all">
        {/* Top Control Bar: Integrated Zoom Slider + Detailed View Toggle */}
        <div className="flex items-center justify-between mb-1.5 px-1">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-primary" />
              <span>Timeline</span>
            </span>

            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-card/90 border border-border text-[11px] font-semibold text-foreground hover:bg-muted transition-colors cursor-pointer shadow-2xs"
            >
              {isExpanded ? (
                <>
                  <Minimize2 className="w-3 h-3 text-muted-foreground" />
                  <span>Compact</span>
                </>
              ) : (
                <>
                  <Maximize2 className="w-3 h-3 text-muted-foreground" />
                  <span>Detailed View</span>
                </>
              )}
            </button>
          </div>

          {/* Integrated Zoom Slider */}
          <div className="flex items-center gap-2 bg-card/90 backdrop-blur-md border border-border px-3 py-1 rounded-full shadow-xs text-xs">
            <SlidersHorizontal className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-[11px] font-semibold text-foreground whitespace-nowrap min-w-[45px]">
              {windowHours < 1
                ? `${Math.round(windowHours * 60)}m`
                : `${windowHours}h`}
            </span>
            <input
              type="range"
              min="0.5"
              max="12"
              step="0.5"
              value={windowHours}
              onChange={(e) => setWindowHours(parseFloat(e.target.value))}
              className="w-20 sm:w-28 h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
              title="Adjust timeline time window"
            />
          </div>
        </div>

        {/* Floating Start Markers (above the bar track) */}
        {!isExpanded && (
          <div className="relative h-9 w-full pointer-events-none">
            {allActiveTimers.map((timer) => {
              const markerPosPct =
                ((timer.startTime - windowStart) / totalWindowMs) * 100;
              if (markerPosPct < 0 || markerPosPct > 90) return null;

              const taskInfo = taskMap.get(timer.taskId);
              const markerColor =
                timer.task.color || taskInfo?.color || DEFAULT_TASK_COLOR;

              return (
                <div
                  key={`marker-${timer.taskId}`}
                  style={{ left: `${markerPosPct}%` }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleScrollToTask(timer.taskId);
                  }}
                  className="absolute bottom-1 -translate-x-1/2 flex flex-col items-center pointer-events-auto transition-all duration-300 cursor-pointer group"
                  title="Click to jump to task card"
                >
                  <div
                    style={{ borderColor: markerColor }}
                    className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-card/95 border shadow-md text-[11px] font-medium text-foreground backdrop-blur-xs whitespace-nowrap group-hover:scale-105 transition-transform"
                  >
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        timer.isRunning ? 'animate-pulse' : 'opacity-70'
                      }`}
                      style={{ backgroundColor: markerColor }}
                    />
                    <span className="truncate max-w-[120px] font-semibold">
                      {timer.task.title}
                    </span>
                    {timer.subtaskTitle && (
                      <span className="text-muted-foreground text-[10px] truncate max-w-[80px]">
                        › {timer.subtaskTitle}
                      </span>
                    )}
                    <span
                      className={`text-[9px] font-bold uppercase px-1 rounded ${
                        timer.isRunning
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                      }`}
                    >
                      {timer.isRunning ? 'Live' : 'Paused'}
                    </span>
                    <span className="font-mono text-muted-foreground text-[10px]">
                      {format(new Date(timer.startTime), 'HH:mm')}
                    </span>
                  </div>
                  <div
                    className="w-0.5 h-2"
                    style={{ backgroundColor: markerColor }}
                  />
                </div>
              );
            })}

            {/* Hover Tooltip for Blocks */}
            <AnimatePresence>
              {hoveredBlock && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 5 }}
                  style={{
                    left: `${Math.min(
                      Math.max(hoveredBlock.leftPct + hoveredBlock.widthPct / 2, 8),
                      85
                    )}%`,
                  }}
                  className="absolute bottom-2 -translate-x-1/2 pointer-events-none z-40 bg-zinc-900 text-zinc-100 dark:bg-zinc-800 px-3 py-1.5 rounded-lg shadow-xl text-xs whitespace-nowrap border border-zinc-700/60"
                >
                  <div className="flex items-center gap-1.5 font-medium">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: hoveredBlock.color }}
                    />
                    <span className="font-semibold">{hoveredBlock.title}</span>
                    {hoveredBlock.subtaskTitle && (
                      <span className="text-zinc-400">
                        › {hoveredBlock.subtaskTitle}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 text-[11px] text-zinc-400">
                    <span>
                      {format(new Date(hoveredBlock.startMs), 'HH:mm')} –{' '}
                      {hoveredBlock.status === 'running' ||
                      hoveredBlock.status === 'paused'
                        ? 'Now'
                        : format(new Date(hoveredBlock.endMs), 'HH:mm')}
                    </span>
                    <span>•</span>
                    <span className="text-zinc-200 font-mono font-medium">
                      {formatDuration(hoveredBlock.endMs - hoveredBlock.startMs)}
                    </span>
                    {hoveredBlock.status === 'running' && (
                      <span className="text-emerald-400 font-semibold">• Live</span>
                    )}
                    {hoveredBlock.status === 'paused' && (
                      <span className="text-amber-400 font-semibold">• Paused</span>
                    )}
                  </div>
                  <p className="text-[10px] text-zinc-400 mt-1 italic">
                    Click to view task in list
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Main Bar Track (Compact or Expanded) */}
        <div
          className={`rounded-2xl bg-card/95 backdrop-blur-md border border-border shadow-2xl transition-all flex flex-col overflow-hidden ${
            isExpanded ? 'p-4 gap-4' : 'h-11'
          }`}
        >
          {/* Main Visual Track */}
          <div
            ref={trackRef}
            onClick={handleTrackClick}
            className={`relative w-full rounded-xl bg-muted/80 border border-border/80 overflow-hidden flex items-center cursor-crosshair ${
              isExpanded ? 'h-16' : 'h-full'
            }`}
            title="Click on empty space to log offline time"
          >
            {/* Full-width Track Content */}
            <div className="absolute inset-0">
              {blocks.map((b) => {
                const laneHeight = hasMultiLane ? '48%' : '100%';
                const laneTop = hasMultiLane
                  ? b.lane === 1
                    ? '50%'
                    : '2%'
                  : '0%';

                const isPausedStyle = b.status === 'paused';

                return (
                  <div
                    key={b.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleScrollToTask(b.taskId);
                    }}
                    onMouseEnter={() => setHoveredBlock(b)}
                    onMouseLeave={() => setHoveredBlock(null)}
                    style={{
                      left: `${b.leftPct}%`,
                      width: `${b.widthPct}%`,
                      top: laneTop,
                      height: laneHeight,
                      backgroundColor: isPausedStyle ? undefined : b.color,
                      borderColor: isPausedStyle ? b.color : undefined,
                    }}
                    className={`absolute rounded-md cursor-pointer transition-all ${
                      isPausedStyle
                        ? 'border-2 border-dashed bg-amber-500/20 backdrop-blur-xs'
                        : b.status === 'running'
                        ? 'opacity-95 shadow-sm brightness-105'
                        : 'opacity-85 hover:opacity-100 hover:scale-[1.01]'
                    }`}
                  >
                    {b.widthPct > 6 && (
                      <div className="h-full px-2 flex items-center overflow-hidden">
                        <span
                          className={`text-[10px] font-bold truncate drop-shadow-xs ${
                            isPausedStyle
                              ? 'text-amber-600 dark:text-amber-300'
                              : 'text-white'
                          }`}
                        >
                          {isPausedStyle ? 'Paused' : b.subtaskTitle || b.title}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Present Line (pinned at 90%) */}
            <div
              style={{ left: '90%' }}
              className={`absolute top-0 bottom-0 w-[2.5px] z-20 pointer-events-none transition-colors duration-300 ${
                hasRunningTimer
                  ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.9)]'
                  : hasPausedTimer
                  ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.8)]'
                  : 'bg-zinc-400 dark:bg-zinc-600'
              }`}
            >
              <div
                className={`absolute top-1/2 -translate-y-1/2 -translate-x-[4px] w-2.5 h-2.5 rounded-full transition-colors duration-300 ${
                  hasRunningTimer
                    ? 'bg-emerald-500 animate-pulse ring-2 ring-emerald-400/50'
                    : hasPausedTimer
                    ? 'bg-amber-500 ring-2 ring-amber-400/50'
                    : 'bg-zinc-500 dark:bg-zinc-400'
                }`}
              />
            </div>

            {/* Future Zone (Remaining 10%) */}
            <div className="absolute right-0 top-0 bottom-0 w-[10%] bg-muted/90 border-l border-dashed border-border/70 flex items-center justify-center text-[10px] font-medium text-muted-foreground select-none pointer-events-none">
              +{Math.round(futureMs / 60000)}m
            </div>

            {/* Dynamic Time Ticks Overlay */}
            <div className="absolute inset-0 pointer-events-none flex justify-between px-3 text-[10px] font-mono text-muted-foreground/75 items-end pb-0.5">
              <span>
                -{windowHours < 1
                  ? `${Math.round(windowHours * 60)}m`
                  : `${windowHours}h`}
              </span>
              <span className="relative right-24">
                -{windowHours < 1
                  ? `${Math.round(windowHours * 40)}m`
                  : `${Math.round(windowHours * 0.66 * 10) / 10}h`}
              </span>
              <span className="relative right-12">
                -{windowHours < 1
                  ? `${Math.round(windowHours * 20)}m`
                  : `${Math.round(windowHours * 0.33 * 10) / 10}h`}
              </span>
              <span
                className={`font-semibold ${
                  hasRunningTimer
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : hasPausedTimer
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-foreground'
                }`}
                style={{
                  position: 'absolute',
                  left: '88%',
                  transform: 'translateX(-50%)',
                }}
              >
                NOW
              </span>
              <span className="opacity-60">+{Math.round(futureMs / 60000)}m</span>
            </div>
          </div>

          {/* Expanded View Content: Detailed Session Log */}
          {isExpanded && (
            <div className="space-y-2 border-t border-border pt-3">
              <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <span>Recent Activity Log ({blocks.length} sessions in window)</span>
                <span className="text-[11px] normal-case text-muted-foreground">
                  Click any row to jump to task
                </span>
              </div>

              <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                {blocks.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic py-3 text-center">
                    No activity recorded in this time window
                  </p>
                ) : (
                  [...blocks].reverse().map((b) => (
                    <div
                      key={b.id}
                      onClick={() => handleScrollToTask(b.taskId)}
                      className="flex items-center justify-between p-2 rounded-lg border border-border/80 bg-muted/30 hover:bg-muted/80 text-xs transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: b.color }}
                        />
                        <span className="font-semibold text-foreground truncate">
                          {b.title}
                        </span>
                        {b.subtaskTitle && (
                          <span className="text-xs text-muted-foreground truncate">
                            › {b.subtaskTitle}
                          </span>
                        )}
                        <span
                          className={`text-[9px] font-bold uppercase px-1.5 py-0.2 rounded ${
                            b.status === 'running'
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                              : b.status === 'paused'
                              ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                              : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {b.status}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-muted-foreground text-[11px] shrink-0 font-mono">
                        <span>
                          {format(new Date(b.startMs), 'HH:mm')} –{' '}
                          {b.status === 'running' || b.status === 'paused'
                            ? 'Now'
                            : format(new Date(b.endMs), 'HH:mm')}
                        </span>
                        <span className="font-semibold text-foreground">
                          {formatDuration(b.endMs - b.startMs)}
                        </span>
                        <ExternalLink className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Log Offline Time Modal */}
      <Modal
        isOpen={offlineLog.isOpen}
        onClose={() => setOfflineLog((prev) => ({ ...prev, isOpen: false }))}
        title="Log Offline Time"
      >
        <form onSubmit={handleSaveOfflineSession} className="space-y-4 pt-2">
          <p className="text-sm text-muted-foreground">
            You clicked an untracked idle window between{' '}
            <strong className="text-foreground">
              {format(new Date(offlineLog.gapStart), 'HH:mm')}
            </strong>{' '}
            and{' '}
            <strong className="text-foreground">
              {format(new Date(offlineLog.gapEnd), 'HH:mm')}
            </strong>
            . Assign this time to a task:
          </p>

          <div>
            <label className="block text-xs font-semibold uppercase text-muted-foreground mb-1">
              Task
            </label>
            {rawTasks.length === 0 ? (
              <p className="text-sm text-destructive">
                No tasks found. Please create a task first.
              </p>
            ) : (
              <select
                value={offlineLog.taskId}
                onChange={(e) =>
                  setOfflineLog((prev) => ({ ...prev, taskId: e.target.value }))
                }
                className="w-full px-3 py-2 border rounded-lg bg-background border-input text-sm text-foreground focus:ring-2 focus:ring-primary focus:outline-none"
              >
                {rawTasks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-muted-foreground mb-1">
              Duration (minutes)
            </label>
            <input
              type="number"
              min="1"
              value={offlineLog.minutes}
              onChange={(e) =>
                setOfflineLog((prev) => ({
                  ...prev,
                  minutes: parseInt(e.target.value) || 1,
                }))
              }
              className="w-full px-3 py-2 border rounded-lg bg-background border-input text-sm text-foreground focus:ring-2 focus:ring-primary focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <button
              type="button"
              onClick={() =>
                setOfflineLog((prev) => ({ ...prev, isOpen: false }))
              }
              className="px-4 py-2 text-sm font-medium rounded-lg border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!offlineLog.taskId}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer disabled:opacity-50"
            >
              Save Offline Session
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
};
