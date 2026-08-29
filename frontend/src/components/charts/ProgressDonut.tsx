"use client";

import { useEffect, useState } from "react";
import { colors } from "@/lib/design-tokens";
import { useCountUp } from "@/lib/use-count-up";
import { prefersReducedMotion } from "@/lib/motion";

export function ProgressDonut({
  percent,
  label = "Journey Completed",
}: {
  percent: number;
  label?: string;
}) {
  const r = 46;
  const c = 2 * Math.PI * r;
  const target = c * (1 - percent / 100);

  const [offset, setOffset] = useState(() =>
    prefersReducedMotion() ? target : c,
  );
  const shown = useCountUp(percent);

  useEffect(() => {
    const id = requestAnimationFrame(() => setOffset(target));
    return () => cancelAnimationFrame(id);
  }, [target]);

  return (
    <div className="relative h-32 w-32">
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke={colors.border}
          strokeWidth={12}
        />
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke={colors.orange}
          strokeWidth={12}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{
            transition: "stroke-dashoffset 1.4s cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-heading text-xl font-bold text-charcoal">
          {shown}%
        </span>
        <span className="px-4 text-center text-[10px] leading-tight text-text-secondary">
          {label}
        </span>
      </div>
    </div>
  );
}
