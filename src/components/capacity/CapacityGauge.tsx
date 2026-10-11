"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { useUserSettings } from '@/hooks/useData';
import { Task } from '@/lib/db/types';
import { formatMinutes } from '@/lib/utils/duration';
import { BatteryCharging, AlertTriangle, CheckCircle, ChevronDown, ChevronUp, Settings } from 'lucide-react';

interface CapacityGaugeProps {
  tasks: Task[];
}

export function CapacityGauge({ tasks }: CapacityGaugeProps) {
  const settings = useUserSettings();
  const [isExpanded, setIsExpanded] = useState(false);

  const capacityHours = settings?.dailyCapacityHours || 6;
  const capacityMinutes = capacityHours * 60;

  // Sum planned time (use calibrated if available, else nominal)
  const plannedMinutes = tasks.reduce(
    (acc, t) => acc + (t.calibratedMinutes || t.nominalMinutes || 30),
    0
  );

  const completedMinutes = tasks
    .filter((t) => t.status === 'completed')
    .reduce((acc, t) => acc + (t.calibratedMinutes || t.nominalMinutes || 30), 0);

  const percentage = capacityMinutes > 0 ? Math.round((plannedMinutes / capacityMinutes) * 100) : 0;
  const isOverCapacity = plannedMinutes > capacityMinutes;
  const overMinutes = plannedMinutes - capacityMinutes;

  // Colors
  const getStatusColor = () => {
    if (percentage > 100) return 'text-rose-600 dark:text-rose-400';
    if (percentage >= 85) return 'text-amber-600 dark:text-amber-400';
    return 'text-emerald-600 dark:text-emerald-400';
  };

  const getBarColor = () => {
    if (percentage > 100) return 'bg-rose-500';
    if (percentage >= 85) return 'bg-amber-500';
    return 'bg-emerald-500';
  };

  return (
    <div className="p-3.5 rounded-xl border border-border bg-card shadow-xs text-xs space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <BatteryCharging className="w-4 h-4 text-primary shrink-0" />
          <span className="font-semibold text-foreground">Daily Capacity</span>
          <span className={`font-mono font-bold ${getStatusColor()}`}>
            {formatMinutes(plannedMinutes)} / {capacityHours}h ({percentage}%)
          </span>
        </div>

        <div className="flex items-center gap-2">
          {isOverCapacity && (
            <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-600 dark:text-rose-400 font-semibold text-[11px]">
              <AlertTriangle className="w-3 h-3 shrink-0" />
              <span>Over by +{formatMinutes(overMinutes)}</span>
            </span>
          )}

          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground cursor-pointer"
            aria-label="Toggle capacity details"
          >
            <span>{isExpanded ? 'Less' : 'Details'}</span>
            {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>
      </div>

      {/* Capacity Progress Bar */}
      <div className="relative w-full h-2 rounded-full bg-muted overflow-hidden">
        <div
          style={{ width: `${Math.min(percentage, 100)}%` }}
          className={`h-full rounded-full transition-all duration-500 ${getBarColor()}`}
        />
      </div>

      {/* Expanded Breakdown */}
      {isExpanded && (
        <div className="pt-2 border-t border-border/70 space-y-2 text-[11px] text-muted-foreground">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div>
              <span className="block text-[10px] uppercase font-semibold text-muted-foreground">Target Capacity</span>
              <span className="font-medium text-foreground">{capacityHours} hours ({capacityMinutes}m)</span>
            </div>
            <div>
              <span className="block text-[10px] uppercase font-semibold text-muted-foreground">Planned Calibrated</span>
              <span className="font-medium text-foreground">{formatMinutes(plannedMinutes)}</span>
            </div>
            <div>
              <span className="block text-[10px] uppercase font-semibold text-muted-foreground">Completed Today</span>
              <span className="font-medium text-foreground">{formatMinutes(completedMinutes)}</span>
            </div>
            <div>
              <span className="block text-[10px] uppercase font-semibold text-muted-foreground">Remaining Room</span>
              <span className={`font-medium ${isOverCapacity ? 'text-rose-500 font-semibold' : 'text-foreground'}`}>
                {isOverCapacity ? `-${formatMinutes(overMinutes)} overload` : formatMinutes(capacityMinutes - plannedMinutes)}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="italic">
              Estimates include automatic pace calibration based on historical completion ratios.
            </span>
            <Link
              href="/settings"
              className="text-primary hover:underline inline-flex items-center gap-1 font-medium"
            >
              <Settings className="w-3 h-3" />
              <span>Change capacity limit</span>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
