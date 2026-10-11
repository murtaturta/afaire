"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useTimerStore } from '@/stores/timerStore';
import { useAllSessions, useAllTasks } from '@/hooks/useData';
import { createSession } from '@/lib/db/sessions';
import { Modal } from '@/components/ui/Modal';
import { format } from 'date-fns';
import { formatDuration } from '@/lib/utils/duration';
import { formatElapsed } from '@/hooks/useTimer';
import { DEFAULT_TASK_COLOR, getSubtaskShade } from '@/lib/constants/colors';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, SlidersHorizontal, Maximize2, Minimize2, ExternalLink, Calendar, PlusCircle } from 'lucide-react';

interface TimelineBlock {
  id: string;
  taskId: string;
  title: string;
  subtaskId?: string;
  subtaskTitle?: string;
  subtaskComment?: string;
  color: string;
  parentColor: string;
  isSubtask: boolean;
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
  const [touchScrub, setTouchScrub] = useState<{
    pct: number;
    timeMs: number;
    blockTitle?: string;
    isGap: boolean;
  } | null>(null);
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);

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

  // Map tasks by ID for title, color, and subtasks
  const taskMap = useMemo(() => {
    const map = new Map<string, { title: string; color: string; subtasks?: typeof rawTasks[0]['subtasks'] }>();
    for (const t of rawTasks) {
      map.set(t.id, {
        title: t.title,
        color: t.color || DEFAULT_TASK_COLOR,
        subtasks: t.subtasks,
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
      const parentColor = taskInfo?.color || DEFAULT_TASK_COLOR;
      const isSubtask = Boolean(s.subtaskId || s.subtaskTitle);
      const blockColor = isSubtask
        ? getSubtaskShade(parentColor, s.subtaskId || s.subtaskTitle)
        : parentColor;

      const matchedSubtask = taskInfo?.subtasks?.find(
        (st) => (s.subtaskId && st.id === s.subtaskId) || (s.subtaskTitle && st.title === s.subtaskTitle)
      );

      list.push({
        id: s.id,
        taskId: s.taskId,
        title: taskInfo?.title || 'Completed task',
        subtaskId: s.subtaskId,
        subtaskTitle: s.subtaskTitle,
        subtaskComment: matchedSubtask?.comment,
        color: blockColor,
        parentColor,
        isSubtask,
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
      const parentColor = t.task.color || taskInfo?.color || DEFAULT_TASK_COLOR;
      const taskTitle = t.task.title || taskInfo?.title || 'Active task';
      const isSubtask = Boolean(t.subtaskId || t.subtaskTitle);
      const blockColor = isSubtask
        ? getSubtaskShade(parentColor, t.subtaskId || t.subtaskTitle)
        : parentColor;

      const matchedSubtask = taskInfo?.subtasks?.find(
        (st) => (t.subtaskId && st.id === t.subtaskId) || (t.subtaskTitle && st.title === t.subtaskTitle)
      );

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
            subtaskId: t.subtaskId,
            subtaskTitle: t.subtaskTitle,
            subtaskComment: matchedSubtask?.comment,
            color: blockColor,
            parentColor,
            isSubtask,
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
            subtaskId: t.subtaskId,
            subtaskTitle: t.subtaskTitle,
            subtaskComment: matchedSubtask?.comment,
            color: blockColor,
            parentColor,
            isSubtask,
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
            subtaskId: t.subtaskId,
            subtaskTitle: t.subtaskTitle,
            subtaskComment: matchedSubtask?.comment,
            color: blockColor,
            parentColor,
            isSubtask,
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

  // Group blocks by parent task for structured timeline breakdown
  const groupedTasks = useMemo(() => {
    const map = new Map<string, {
      taskId: string;
      taskTitle: string;
      taskColor: string;
      totalDurationMs: number;
      blocks: TimelineBlock[];
    }>();

    for (const b of [...blocks].reverse()) {
      if (!map.has(b.taskId)) {
        map.set(b.taskId, {
          taskId: b.taskId,
          taskTitle: b.title,
          taskColor: b.parentColor || b.color,
          totalDurationMs: 0,
          blocks: [],
        });
      }
      const g = map.get(b.taskId)!;
      g.totalDurationMs += (b.endMs - b.startMs);
      g.blocks.push(b);
    }

    return Array.from(map.values());
  }, [blocks]);

  // Group contiguous blocks of the same task on each lane into unified capsules
  const clusters = useMemo(() => {
    if (blocks.length === 0) return [];

    const result: {
      id: string;
      taskId: string;
      taskTitle: string;
      parentColor: string;
      lane: number;
      leftPct: number;
      widthPct: number;
      blocks: (TimelineBlock & { relativeWidthPct: number })[];
    }[] = [];

    const lanes = [0, 1];
    for (const laneNum of lanes) {
      const laneBlocks = blocks.filter((b) => b.lane === laneNum);
      if (laneBlocks.length === 0) continue;

      const sorted = [...laneBlocks].sort((a, b) => a.clampedStart - b.clampedStart);

      let currentCluster: {
        id: string;
        taskId: string;
        taskTitle: string;
        parentColor: string;
        lane: number;
        startMs: number;
        endMs: number;
        clampedStart: number;
        clampedEnd: number;
        blocks: TimelineBlock[];
      } | null = null;

      for (const b of sorted) {
        const gapMs = currentCluster ? b.clampedStart - currentCluster.clampedEnd : Infinity;
        // Group if same task and contiguous or switching subtasks within 3 minutes
        const isContiguous =
          currentCluster !== null &&
          currentCluster.taskId === b.taskId &&
          gapMs <= 3 * 60 * 1000 &&
          gapMs >= -1000;

        if (isContiguous && currentCluster) {
          currentCluster.endMs = Math.max(currentCluster.endMs, b.endMs);
          currentCluster.clampedEnd = Math.max(currentCluster.clampedEnd, b.clampedEnd);
          currentCluster.blocks.push(b);
        } else {
          if (currentCluster) {
            const cLeft = ((currentCluster.clampedStart - windowStart) / totalWindowMs) * 100;
            const cRight = ((currentCluster.clampedEnd - windowStart) / totalWindowMs) * 100;
            const cWidth = Math.max(cRight - cLeft, 0.4);
            const rawSum = currentCluster.blocks.reduce(
              (acc, blk) => acc + Math.max(blk.clampedEnd - blk.clampedStart, 1),
              0
            );

            result.push({
              id: currentCluster.id,
              taskId: currentCluster.taskId,
              taskTitle: currentCluster.taskTitle,
              parentColor: currentCluster.parentColor,
              lane: currentCluster.lane,
              leftPct: cLeft,
              widthPct: cWidth,
              blocks: currentCluster.blocks.map((blk) => {
                const dur = Math.max(blk.clampedEnd - blk.clampedStart, 1);
                return {
                  ...blk,
                  relativeWidthPct: (dur / rawSum) * 100,
                };
              }),
            });
          }

          currentCluster = {
            id: `cluster-${b.id}`,
            taskId: b.taskId,
            taskTitle: b.title,
            parentColor: b.parentColor || b.color,
            lane: b.lane,
            startMs: b.startMs,
            endMs: b.endMs,
            clampedStart: b.clampedStart,
            clampedEnd: b.clampedEnd,
            blocks: [b],
          };
        }
      }

      if (currentCluster) {
        const cLeft = ((currentCluster.clampedStart - windowStart) / totalWindowMs) * 100;
        const cRight = ((currentCluster.clampedEnd - windowStart) / totalWindowMs) * 100;
        const cWidth = Math.max(cRight - cLeft, 0.4);
        const rawSum = currentCluster.blocks.reduce(
          (acc, blk) => acc + Math.max(blk.clampedEnd - blk.clampedStart, 1),
          0
        );

        result.push({
          id: currentCluster.id,
          taskId: currentCluster.taskId,
          taskTitle: currentCluster.taskTitle,
          parentColor: currentCluster.parentColor,
          lane: currentCluster.lane,
          leftPct: cLeft,
          widthPct: cWidth,
          blocks: currentCluster.blocks.map((blk) => {
            const dur = Math.max(blk.clampedEnd - blk.clampedStart, 1);
            return {
              ...blk,
              relativeWidthPct: (dur / rawSum) * 100,
            };
          }),
        });
      }
    }

    return result;
  }, [blocks, windowStart, totalWindowMs]);

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

  const updateTouchScrub = (touchX: number) => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const scrubX = touchX - rect.left;
    const scrubPct = Math.max(0, Math.min(90, (scrubX / rect.width) * 100));
    const scrubTime = windowStart + (scrubPct / 100) * totalWindowMs;

    const block = blocks.find(
      (b) => scrubTime >= b.clampedStart && scrubTime <= b.clampedEnd
    );

    if (block) {
      setHoveredBlock(block);
      setTouchScrub({
        pct: scrubPct,
        timeMs: scrubTime,
        blockTitle: block.subtaskTitle ? `${block.title} › ${block.subtaskTitle}` : block.title,
        isGap: false,
      });
    } else {
      setHoveredBlock(null);
      setTouchScrub({
        pct: scrubPct,
        timeMs: scrubTime,
        isGap: true,
      });
    }
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      touchStartPos.current = { x: touch.clientX, y: touch.clientY };
      updateTouchScrub(touch.clientX);
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 1) {
      updateTouchScrub(e.touches[0].clientX);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (touchScrub) {
      const touch = e.changedTouches[0];
      const start = touchStartPos.current;
      const dist = start
        ? Math.hypot(touch.clientX - start.x, touch.clientY - start.y)
        : 0;

      if (dist < 15) {
        if (hoveredBlock) {
          handleScrollToTask(hoveredBlock.taskId);
        } else if (touchScrub.isGap) {
          let gapStart = windowStart;
          let gapEnd = currentTime;
          for (const b of blocks) {
            if (b.endMs <= touchScrub.timeMs && b.endMs > gapStart) {
              gapStart = b.endMs;
            }
            if (b.startMs >= touchScrub.timeMs && b.startMs < gapEnd) {
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
        }
      }

      setTimeout(() => {
        setTouchScrub(null);
        setHoveredBlock(null);
      }, 1500);
    }
    touchStartPos.current = null;
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
      <div className="fixed bottom-3 sm:bottom-4 left-1/2 -translate-x-1/2 w-[calc(100%-1rem)] sm:w-[calc(100%-2rem)] max-w-4xl z-30 select-none transition-all">
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

          {/* Integrated Zoom Controls (Presets + Slider) */}
          <div className="flex items-center gap-1.5 bg-card/90 backdrop-blur-md border border-border px-2 sm:px-3 py-1 rounded-full shadow-xs text-xs">
            {/* Quick Presets */}
            <div className="flex items-center gap-1">
              {[1, 3, 6, 12].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  data-testid={`timeline-preset-${preset}h`}
                  onClick={() => setWindowHours(preset)}
                  className={`px-2 py-0.5 rounded-full text-[10px] font-semibold transition-colors cursor-pointer ${
                    windowHours === preset
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted/70 hover:bg-muted text-muted-foreground hover:text-foreground'
                  }`}
                  title={`${preset} hour window`}
                >
                  {preset}h
                </button>
              ))}
            </div>

            <div className="h-3 w-px bg-border/60 mx-0.5 hidden sm:block" />

            <div className="hidden sm:flex items-center gap-1.5">
              <SlidersHorizontal className="w-3.5 h-3.5 text-muted-foreground" />
              <input
                type="range"
                min="0.5"
                max="12"
                step="0.5"
                value={windowHours}
                onChange={(e) => setWindowHours(parseFloat(e.target.value))}
                className="w-16 md:w-24 h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                title="Adjust timeline time window"
              />
            </div>
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
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: hoveredBlock.parentColor }}
                      title="Parent task color"
                    />
                    <span className="font-semibold">{hoveredBlock.title}</span>
                    {hoveredBlock.isSubtask && (
                      <>
                        <span className="text-zinc-500">›</span>
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: hoveredBlock.color }}
                          title="Subtask shade"
                        />
                        <span className="text-zinc-300 font-semibold">
                          {hoveredBlock.subtaskTitle}
                        </span>
                      </>
                    )}
                  </div>
                  {hoveredBlock.subtaskComment && (
                    <p className="text-[10px] text-zinc-400 italic max-w-[260px] truncate mt-0.5">
                      Note: {hoveredBlock.subtaskComment}
                    </p>
                  )}
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
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            style={{ touchAction: 'pan-y' }}
            className={`relative w-full rounded-xl bg-muted/80 border border-border/80 overflow-hidden flex items-center cursor-crosshair ${
              isExpanded ? 'h-16' : 'h-full'
            }`}
            title="Click on empty space to log offline time or scrub on touch"
          >
            {/* Mobile Touch Scrubber Line & Indicator */}
            {touchScrub && (
              <div
                style={{ left: `${touchScrub.pct}%` }}
                className="absolute top-0 bottom-0 w-0.5 bg-primary z-30 pointer-events-none transition-none shadow-[0_0_8px_rgba(37,99,235,0.8)]"
              >
                <div className="absolute -top-6 -translate-x-1/2 bg-zinc-900 text-zinc-100 text-[10px] font-mono font-medium px-2 py-0.5 rounded-md shadow-lg whitespace-nowrap border border-zinc-700/80">
                  {format(new Date(touchScrub.timeMs), 'HH:mm')}
                  {touchScrub.blockTitle ? ` • ${touchScrub.blockTitle}` : ' • Idle'}
                </div>
              </div>
            )}

            {/* Full-width Track Content */}
            <div className="absolute inset-0">
              {clusters.map((cluster) => {
                const laneHeight = hasMultiLane ? '48%' : '100%';
                const laneTop = hasMultiLane
                  ? cluster.lane === 1
                    ? '50%'
                    : '2%'
                  : '0%';

                const isAllPaused = cluster.blocks.every((b) => b.status === 'paused');

                return (
                  <div
                    key={cluster.id}
                    style={{
                      left: `${cluster.leftPct}%`,
                      width: `${cluster.widthPct}%`,
                      top: laneTop,
                      height: laneHeight,
                    }}
                    className={`absolute rounded-lg overflow-hidden flex border transition-all ${
                      isAllPaused
                        ? 'border-dashed border-amber-500/60'
                        : 'border-border/70 shadow-xs'
                    }`}
                  >
                    {/* Unified Top Accent Bar across the entire task capsule */}
                    <div
                      className="absolute top-0 left-0 right-0 h-[3px] z-20 pointer-events-none"
                      style={{ backgroundColor: cluster.parentColor }}
                    />

                    {/* Segments (Subtasks / Sessions) */}
                    {cluster.blocks.map((b, idx) => {
                      const isPausedStyle = b.status === 'paused';
                      const isRunningStyle = b.status === 'running';
                      const hasDivider = idx < cluster.blocks.length - 1;
                      const approxPixelWidth = cluster.widthPct * (b.relativeWidthPct / 100);

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
                            width: `${b.relativeWidthPct}%`,
                            backgroundColor: isPausedStyle ? undefined : b.color,
                          }}
                          className={`h-full relative flex items-center cursor-pointer transition-all ${
                            hasDivider ? 'border-r border-black/25 dark:border-white/20' : ''
                          } ${
                            isPausedStyle
                              ? 'border-2 border-dashed border-amber-500 bg-amber-500/20 backdrop-blur-xs'
                              : isRunningStyle
                              ? 'opacity-95 brightness-105 shadow-xs'
                              : 'opacity-90 hover:opacity-100 hover:brightness-110'
                          }`}
                        >
                          {approxPixelWidth > 6 && (
                            <div className="h-full px-1.5 flex items-center overflow-hidden">
                              <span
                                className={`text-[10px] font-bold truncate drop-shadow-xs ${
                                  isPausedStyle
                                    ? 'text-amber-600 dark:text-amber-300'
                                    : 'text-white'
                                }`}
                              >
                                {isPausedStyle ? 'Paused' : b.isSubtask ? `› ${b.subtaskTitle}` : b.title}
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* Unified Task Title Overlay when individual segments are too small to show text */}
                    {cluster.widthPct >= 8 &&
                      cluster.blocks.every(
                        (b) => (cluster.widthPct * b.relativeWidthPct) / 100 <= 6
                      ) && (
                        <div
                          className="absolute inset-0 px-2 flex items-center pointer-events-none z-10 overflow-hidden"
                        >
                          <span className="text-[10px] font-bold text-white drop-shadow-md truncate">
                            {cluster.taskTitle}
                            {cluster.blocks.length > 1 && (
                              <span className="ml-1 opacity-80 text-[9px] font-normal">
                                ({cluster.blocks.length} parts)
                              </span>
                            )}
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

              <div className="max-h-52 overflow-y-auto space-y-2 pr-1">
                {groupedTasks.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic py-3 text-center">
                    No activity recorded in this time window
                  </p>
                ) : (
                  groupedTasks.map((group) => (
                    <div
                      key={group.taskId}
                      className="rounded-lg border border-border/80 bg-muted/20 overflow-hidden"
                    >
                      {/* Main Task Group Header */}
                      <div
                        onClick={() => handleScrollToTask(group.taskId)}
                        className="flex items-center justify-between p-2 bg-muted/60 hover:bg-muted/80 transition-colors cursor-pointer border-b border-border/40"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: group.taskColor }}
                          />
                          <span className="font-semibold text-xs text-foreground truncate">
                            {group.taskTitle}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            ({group.blocks.length} {group.blocks.length === 1 ? 'session' : 'sessions'})
                          </span>
                        </div>
                        <div className="text-[11px] font-mono font-semibold text-foreground">
                          {formatDuration(group.totalDurationMs)}
                        </div>
                      </div>

                      {/* Grouped Sessions: Subtasks & General */}
                      <div className="divide-y divide-border/30">
                        {group.blocks.map((b) => (
                          <div
                            key={b.id}
                            onClick={() => handleScrollToTask(b.taskId)}
                            className="flex items-center justify-between p-2 pl-4 sm:pl-5 hover:bg-muted/30 text-xs transition-colors cursor-pointer"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span
                                className="w-2 h-2 rounded-full shrink-0"
                                style={{ backgroundColor: b.color }}
                              />
                              {b.isSubtask ? (
                                <span className="font-medium text-xs text-foreground truncate flex items-center gap-1">
                                  <span className="text-muted-foreground/60">›</span>
                                  <span>{b.subtaskTitle}</span>
                                </span>
                              ) : (
                                <span className="text-xs text-muted-foreground truncate">General session</span>
                              )}
                              {b.subtaskComment && (
                                <span className="text-[10px] text-muted-foreground/80 italic truncate max-w-[140px] hidden sm:inline">
                                  ({b.subtaskComment})
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
                        ))}
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
