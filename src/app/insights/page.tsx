"use client";

import React, { useState, useMemo } from 'react';
import { useAllSessions, useAllTasks, useAllCompletionRecords } from '@/hooks/useData';
import { formatMinutes, formatDuration } from '@/lib/utils/duration';
import { DEFAULT_TASK_COLOR } from '@/lib/constants/colors';
import {
  Clock,
  Coffee,
  Zap,
  PauseCircle,
  BarChart3,
  TrendingUp,
  CheckCircle2,
  Calendar,
  AlertCircle
} from 'lucide-react';

export default function InsightsPage() {
  const [timeframe, setTimeframe] = useState<'today' | '7days' | 'all'>('today');

  const rawSessions = useAllSessions() || [];
  const rawTasks = useAllTasks() || [];
  const rawRecords = useAllCompletionRecords() || [];

  const taskMap = useMemo(() => {
    const map = new Map<string, { title: string; color: string; nominalMinutes: number }>();
    for (const t of rawTasks) {
      map.set(t.id, {
        title: t.title,
        color: t.color || DEFAULT_TASK_COLOR,
        nominalMinutes: t.nominalMinutes,
      });
    }
    return map;
  }, [rawTasks]);

  // Filter sessions based on selected timeframe
  const filteredSessions = useMemo(() => {
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    return rawSessions.filter((s) => {
      if (s.excludeFromHistory) return false;
      const sessionDate = new Date(s.startedAt);
      if (timeframe === 'today') {
        const sDateStr = `${sessionDate.getFullYear()}-${String(sessionDate.getMonth() + 1).padStart(2, '0')}-${String(sessionDate.getDate()).padStart(2, '0')}`;
        return sDateStr === todayStr;
      }
      if (timeframe === '7days') {
        return sessionDate >= sevenDaysAgo;
      }
      return true;
    });
  }, [rawSessions, timeframe]);

  // 1. Idle Time vs Task Time Analysis
  const { totalTaskMs, idleMs, workdaySpanMs, focusRatio, idleRatio } = useMemo(() => {
    if (filteredSessions.length === 0) {
      return { totalTaskMs: 0, idleMs: 0, workdaySpanMs: 0, focusRatio: 0, idleRatio: 0 };
    }

    const taskMs = filteredSessions.reduce(
      (acc, s) => acc + (s.adjustedDurationMs ?? s.activeDurationMs),
      0
    );

    const starts = filteredSessions.map((s) => new Date(s.startedAt).getTime());
    const ends = filteredSessions.map((s) =>
      s.endedAt
        ? new Date(s.endedAt).getTime()
        : new Date(s.startedAt).getTime() + s.activeDurationMs
    );

    const earliest = Math.min(...starts);
    const latest = Math.max(...ends);
    const span = Math.max(latest - earliest, taskMs);
    const idle = Math.max(0, span - taskMs);

    const focusPct = span > 0 ? Math.round((taskMs / span) * 100) : 100;
    const idlePct = 100 - focusPct;

    return {
      totalTaskMs: taskMs,
      idleMs: idle,
      workdaySpanMs: span,
      focusRatio: focusPct,
      idleRatio: idlePct,
    };
  }, [filteredSessions]);

  // 2. Task Completion & Time Comparison
  const completedTaskComparisons = useMemo(() => {
    // Map sessions by task
    const taskSessionMap = new Map<string, number>();
    for (const s of filteredSessions) {
      const ms = s.adjustedDurationMs ?? s.activeDurationMs;
      taskSessionMap.set(s.taskId, (taskSessionMap.get(s.taskId) || 0) + ms);
    }

    const list: {
      taskId: string;
      title: string;
      color: string;
      actualMinutes: number;
      nominalMinutes: number;
      ratio: number;
    }[] = [];

    // Consider completed tasks or tasks with active time
    for (const [taskId, ms] of taskSessionMap.entries()) {
      const task = rawTasks.find((t) => t.id === taskId);
      const taskInfo = taskMap.get(taskId);
      const actualMins = ms / 60000;
      const nominalMins = task?.nominalMinutes || taskInfo?.nominalMinutes || 30;
      const ratio = nominalMins > 0 ? actualMins / nominalMins : 1;

      list.push({
        taskId,
        title: task?.title || taskInfo?.title || 'Unknown Task',
        color: task?.color || taskInfo?.color || DEFAULT_TASK_COLOR,
        actualMinutes: actualMins,
        nominalMinutes: nominalMins,
        ratio,
      });
    }

    // Sort by actual time spent descending
    return list.sort((a, b) => b.actualMinutes - a.actualMinutes);
  }, [filteredSessions, rawTasks, taskMap]);

  // 3. Breaks Taken Analysis
  const { totalBreaksCount, totalBreakMs, avgBreakMs, taskBreaksList } = useMemo(() => {
    let count = 0;
    let totalPauseDuration = 0;
    const taskBreakMap = new Map<
      string,
      { pauseCount: number; pauseDurationMs: number }
    >();

    for (const s of filteredSessions) {
      const pauses = s.pausedDurations || [];
      const pCount = pauses.length;
      const pDuration = pauses.reduce((acc, p) => acc + p, 0);

      count += pCount;
      totalPauseDuration += pDuration;

      const current = taskBreakMap.get(s.taskId) || {
        pauseCount: 0,
        pauseDurationMs: 0,
      };
      taskBreakMap.set(s.taskId, {
        pauseCount: current.pauseCount + pCount,
        pauseDurationMs: current.pauseDurationMs + pDuration,
      });
    }

    const avg = count > 0 ? totalPauseDuration / count : 0;

    const list: {
      taskId: string;
      title: string;
      color: string;
      pauseCount: number;
      pauseDurationMs: number;
    }[] = [];

    for (const [taskId, data] of taskBreakMap.entries()) {
      const taskInfo = taskMap.get(taskId);
      list.push({
        taskId,
        title: taskInfo?.title || 'Unknown Task',
        color: taskInfo?.color || DEFAULT_TASK_COLOR,
        pauseCount: data.pauseCount,
        pauseDurationMs: data.pauseDurationMs,
      });
    }

    list.sort((a, b) => b.pauseCount - a.pauseCount);

    return {
      totalBreaksCount: count,
      totalBreakMs: totalPauseDuration,
      avgBreakMs: avg,
      taskBreaksList: list,
    };
  }, [filteredSessions, taskMap]);

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8 pb-32">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Productivity Insights
          </h1>
          <p className="text-muted-foreground mt-1">
            Focus efficiency, task completion accuracy, and break patterns
          </p>
        </div>

        {/* Timeframe Switcher */}
        <div className="flex items-center gap-1 bg-muted p-1 rounded-xl border border-border w-fit">
          <button
            type="button"
            onClick={() => setTimeframe('today')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              timeframe === 'today'
                ? 'bg-card text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => setTimeframe('7days')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              timeframe === '7days'
                ? 'bg-card text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Last 7 Days
          </button>
          <button
            type="button"
            onClick={() => setTimeframe('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              timeframe === 'all'
                ? 'bg-card text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            All Time
          </button>
        </div>
      </header>

      {/* Top Metrics Banner */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-border bg-card shadow-xs space-y-1">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>Total Task Time</span>
            <Clock className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-bold text-foreground">
            {formatDuration(totalTaskMs)}
          </p>
          <p className="text-[11px] text-muted-foreground">Active tracked work</p>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card shadow-xs space-y-1">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>Idle Time</span>
            <Coffee className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-bold text-foreground">
            {formatDuration(idleMs)}
          </p>
          <p className="text-[11px] text-muted-foreground">Unworked gap time</p>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card shadow-xs space-y-1">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>Focus Ratio</span>
            <Zap className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-2xl font-bold text-foreground">
            {workdaySpanMs > 0 ? `${focusRatio}%` : '—'}
          </p>
          <p className="text-[11px] text-muted-foreground">Work vs idle balance</p>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card shadow-xs space-y-1">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>Breaks Taken</span>
            <PauseCircle className="w-4 h-4 text-purple-500" />
          </div>
          <p className="text-2xl font-bold text-foreground">
            {totalBreaksCount}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {formatDuration(totalBreakMs)} total paused
          </p>
        </div>
      </div>

      {/* SECTION 1: Idle Time vs. Total Task Time */}
      <section className="p-6 rounded-2xl border border-border bg-card shadow-xs space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary" />
              <span>Time Distribution: Focus vs. Idle</span>
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Comparison between dedicated task sessions and unrecorded downtime
            </p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-primary/10 text-primary">
            Span: {formatDuration(workdaySpanMs)}
          </span>
        </div>

        {filteredSessions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm italic">
            No session activity found for this period
          </div>
        ) : (
          <div className="space-y-4">
            {/* Split Progress Bar */}
            <div className="h-4 w-full rounded-full bg-muted overflow-hidden flex shadow-inner">
              <div
                style={{ width: `${focusRatio}%` }}
                className="h-full bg-emerald-500 transition-all duration-500"
                title={`Focused Task Time: ${focusRatio}%`}
              />
              <div
                style={{ width: `${idleRatio}%` }}
                className="h-full bg-amber-400 dark:bg-amber-500/80 transition-all duration-500"
                title={`Idle Gap Time: ${idleRatio}%`}
              />
            </div>

            {/* Legend & Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="p-3.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="w-3 h-3 rounded-full bg-emerald-500" />
                  <div>
                    <h4 className="text-xs font-semibold text-foreground">
                      Task Focus Time
                    </h4>
                    <p className="text-[11px] text-muted-foreground">
                      Active recorded timers
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-sm font-bold text-foreground">
                    {formatDuration(totalTaskMs)}
                  </span>
                  <span className="block text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                    {focusRatio}% of day
                  </span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl border border-amber-500/20 bg-amber-500/5 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="w-3 h-3 rounded-full bg-amber-500" />
                  <div>
                    <h4 className="text-xs font-semibold text-foreground">
                      Idle / Untracked Time
                    </h4>
                    <p className="text-[11px] text-muted-foreground">
                      Lulls between sessions
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-sm font-bold text-foreground">
                    {formatDuration(idleMs)}
                  </span>
                  <span className="block text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                    {idleRatio}% of day
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* SECTION 2: Tasks by Time to Complete & Accuracy */}
      <section className="p-6 rounded-2xl border border-border bg-card shadow-xs space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            <span>Task Completion Time vs. Estimate</span>
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            How actual duration compares to original estimates for each task
          </p>
        </div>

        {completedTaskComparisons.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm italic">
            No completed task records available for this period
          </div>
        ) : (
          <div className="space-y-4">
            {completedTaskComparisons.map((item) => {
              const maxScale = Math.max(
                item.actualMinutes,
                item.nominalMinutes,
                1
              );
              const actualPct = Math.min((item.actualMinutes / maxScale) * 100, 100);
              const nominalPct = Math.min((item.nominalMinutes / maxScale) * 100, 100);

              const isOverEstimate = item.actualMinutes > item.nominalMinutes;
              const diffPercent = Math.round(
                Math.abs((item.actualMinutes - item.nominalMinutes) / item.nominalMinutes) * 100
              );

              return (
                <div
                  key={item.taskId}
                  className="p-3.5 rounded-xl border border-border/80 bg-card/60 space-y-2.5"
                >
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="font-semibold text-foreground truncate max-w-sm">
                        {item.title}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 font-mono shrink-0">
                      <span>
                        Actual: <strong>{formatMinutes(item.actualMinutes)}</strong>
                      </span>
                      <span className="text-muted-foreground">vs</span>
                      <span className="text-muted-foreground">
                        Est: {formatMinutes(item.nominalMinutes)}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                          isOverEstimate
                            ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                            : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                        }`}
                      >
                        {isOverEstimate ? `+${diffPercent}%` : `-${diffPercent}%`}
                      </span>
                    </div>
                  </div>

                  {/* Dual Bar (Actual vs Estimate) */}
                  <div className="space-y-1">
                    <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden flex items-center">
                      <div
                        style={{
                          width: `${actualPct}%`,
                          backgroundColor: item.color,
                        }}
                        className="h-full rounded-full transition-all duration-500"
                        title={`Actual: ${formatMinutes(item.actualMinutes)}`}
                      />
                    </div>
                    {/* Dotted estimate benchmark */}
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground px-0.5">
                      <span className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full border border-muted-foreground" />
                        Target: {item.nominalMinutes}m
                      </span>
                      <span>
                        Ratio: {item.ratio.toFixed(2)}x
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* SECTION 3: Breaks Taken & Interruption Analysis */}
      <section className="p-6 rounded-2xl border border-border bg-card shadow-xs space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <PauseCircle className="w-5 h-5 text-purple-500" />
              <span>Breaks & Pauses Analysis</span>
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Break counts, total pause durations, and task interruption patterns
            </p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400">
            Avg Break: {formatDuration(avgBreakMs)}
          </span>
        </div>

        {taskBreaksList.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm italic">
            No break records found for this period
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {taskBreaksList.map((item) => (
              <div
                key={item.taskId}
                className="p-3.5 rounded-xl border border-border/80 bg-card/60 flex items-center justify-between gap-3 text-xs"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: item.color }}
                  />
                  <div className="truncate">
                    <h4 className="font-semibold text-foreground truncate">
                      {item.title}
                    </h4>
                    <p className="text-[11px] text-muted-foreground">
                      {item.pauseCount} {item.pauseCount === 1 ? 'pause' : 'pauses'} recorded
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="font-bold text-foreground font-mono">
                    {formatDuration(item.pauseDurationMs)}
                  </span>
                  <span className="block text-[10px] text-muted-foreground">
                    total paused
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
