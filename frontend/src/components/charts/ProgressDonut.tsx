"use client";

import { colors } from "@/lib/design-tokens";

export function ProgressDonut({
  percent,
  label = "Journey Completed",
}: {
  percent: number;
  label?: string;
}) {
  const r = 46;
  const c = 2 * Math.PI * r;
  const done = c * (percent / 100);

  return (
    <div className="relative h-32 w-32">
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
        <circle cx="60" cy="60" r={r} fill="none" stroke={colors.border} strokeWidth={12} />
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke={colors.orange}
          strokeWidth={12}
          strokeLinecap="round"
          strokeDasharray={`${done} ${c - done}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-heading text-xl font-bold text-charcoal">
          {percent}%
        </span>
        <span className="px-4 text-center text-[10px] leading-tight text-text-secondary">
          {label}
        </span>
      </div>
    </div>
  );
}
