"use client";

import { motion } from "framer-motion";

interface ProgressBarProps {
  value: number; // 0 to 100
  color?: "green" | "amber" | "red";
  className?: string;
}

export function ProgressBar({ value, color = "green", className = "" }: ProgressBarProps) {
  const clampedValue = Math.min(Math.max(value, 0), 100);
  
  const colors = {
    green: "bg-success",
    amber: "bg-warning",
    red: "bg-destructive",
  };

  const bgColor = colors[color] || colors.green;

  return (
    <div className={`w-full h-2 bg-muted rounded-full overflow-hidden ${className}`} role="progressbar" aria-valuenow={clampedValue} aria-valuemin={0} aria-valuemax={100}>
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${clampedValue}%` }}
        transition={{ duration: 0.5, ease: "easeInOut" }}
        className={`h-full ${bgColor} rounded-full`}
      />
    </div>
  );
}
