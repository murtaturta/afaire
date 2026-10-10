"use client";

import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { formatMinutes } from '@/lib/utils/duration';

interface OutlierPromptProps {
  isOpen: boolean;
  taskTitle: string;
  nominalMinutes: number;
  actualMinutes: number;
  onAccept: () => void;
  onAdjust: (adjustedMinutes: number) => void;
  onExclude: () => void;
}

export function OutlierPrompt({
  isOpen,
  taskTitle,
  nominalMinutes,
  actualMinutes,
  onAccept,
  onAdjust,
  onExclude
}: OutlierPromptProps) {
  const [adjustedVal, setAdjustedVal] = useState<number>(nominalMinutes);

  useEffect(() => {
    if (isOpen) {
      setAdjustedVal(nominalMinutes);
    }
  }, [isOpen, nominalMinutes]);

  const handleAdjustSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (adjustedVal > 0) {
      onAdjust(adjustedVal);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onAccept} title="Unusually Long Session Detected">
      <div className="space-y-6 pt-2">
        <p className="text-muted-foreground text-sm leading-relaxed">
          This session for <span className="font-medium text-foreground">"{taskTitle}"</span> took {formatMinutes(actualMinutes)}, but you estimated {formatMinutes(nominalMinutes)}. 
          Did you leave the timer running by accident?
        </p>

        <div className="flex flex-col gap-3">
          <button
            onClick={onAccept}
            className="w-full py-2.5 px-4 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 dark:text-emerald-400 font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            Log Full Duration ({formatMinutes(actualMinutes)})
          </button>

          <form onSubmit={handleAdjustSubmit} className="w-full flex gap-2">
            <div className="relative flex-1">
              <input
                type="number"
                min="1"
                step="1"
                value={adjustedVal}
                onChange={(e) => setAdjustedVal(Number(e.target.value))}
                className="w-full h-10 px-3 py-2 bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="Minutes"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
                min
              </span>
            </div>
            <button
              type="submit"
              className="h-10 px-4 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/90 transition-colors whitespace-nowrap"
            >
              Adjust
            </button>
          </form>

          <button
            onClick={onExclude}
            className="w-full py-2.5 px-4 bg-background border border-border text-muted-foreground hover:bg-muted hover:text-foreground font-medium rounded-lg transition-colors"
          >
            Exclude from History
          </button>
        </div>
      </div>
    </Modal>
  );
}
