"use client";

import { colors } from "@/lib/design-tokens";

export function RiskGauge({ score }: { score: number }) {
  const clamped = Math.max(0, Math.min(100, score));
  const radius = 52;
  const circumference = Math.PI * radius;
  const offset = circumference * (1 - clamped / 100);
  const color =
    clamped >= 66 ? colors.coral : clamped >= 40 ? colors.warning : colors.teal;

  return (
    <div className="relative h-[74px] w-[132px]">
      <svg viewBox="0 0 132 74" className="h-full w-full">
        <path
          d="M 14 66 A 52 52 0 0 1 118 66"
          fill="none"
          stroke={colors.border}
          strokeWidth={12}
          strokeLinecap="round"
        />
        <path
          d="M 14 66 A 52 52 0 0 1 118 66"
          fill="none"
          stroke={color}
          strokeWidth={12}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
    </div>
  );
}
