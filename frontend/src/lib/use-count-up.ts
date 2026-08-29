"use client";

import { useEffect, useRef, useState } from "react";
import { prefersReducedMotion } from "@/lib/motion";

/**
 * Counts from 0 up to `target` once, on mount. Used for gauge / score numbers so
 * they animate in step with their ring. Honors prefers-reduced-motion.
 */
export function useCountUp(target: number, durationMs = 1400) {
  const [value, setValue] = useState(() =>
    prefersReducedMotion() ? target : 0,
  );
  const raf = useRef(0);

  useEffect(() => {
    if (prefersReducedMotion()) return;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(target * eased));
      if (t < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target, durationMs]);

  return value;
}
