"use client";

import { useEffect, useState } from "react";
import {
  CalendarDaysIcon,
  CheckIcon,
  DocumentTextIcon,
  FlagIcon,
  UserIcon,
} from "@heroicons/react/24/solid";
import { cn } from "@/lib/cn";
import { prefersReducedMotion } from "@/lib/motion";

export type StepStatus = "completed" | "in_progress" | "pending";

const icons = [
  CheckIcon,
  CheckIcon,
  DocumentTextIcon,
  UserIcon,
  CalendarDaysIcon,
  FlagIcon,
];

export interface JourneyStep {
  label: string;
  date: string;
  status: StepStatus;
  statusLabel?: string;
}

export function JourneyStepper({ steps }: { steps: JourneyStep[] }) {
  // Reveal nodes one-by-one and grow the connecting line on mount.
  const [shown, setShown] = useState(() =>
    prefersReducedMotion() ? steps.length : 0,
  );

  useEffect(() => {
    if (prefersReducedMotion()) return;
    let n = 0;
    const id = window.setInterval(() => {
      n += 1;
      setShown(n);
      if (n >= steps.length) window.clearInterval(id);
    }, 180);
    return () => window.clearInterval(id);
  }, [steps.length]);

  return (
    <div className="flex items-start justify-between gap-2">
      {steps.map((step, i) => {
        const Icon = icons[i] ?? CheckIcon;
        const revealed = i < shown;
        return (
          <div
            key={step.label}
            title={`${step.label}${step.date ? ` · ${step.date}` : ""}${
              step.statusLabel ? ` · ${step.statusLabel}` : ""
            }`}
            className="group relative flex flex-1 cursor-help flex-col items-center text-center"
          >
            {i < steps.length - 1 && (
              <span className="absolute left-1/2 top-5 h-0.5 w-full bg-border">
                <span
                  className={cn(
                    "block h-full origin-left bg-teal transition-transform duration-500 ease-out",
                    step.status === "completed" && revealed
                      ? "scale-x-100"
                      : "scale-x-0",
                  )}
                />
              </span>
            )}
            <span
              className={cn(
                "relative z-10 flex h-10 w-10 items-center justify-center rounded-full transition-all duration-300 ease-out",
                "group-hover:scale-105 group-hover:shadow-[0_6px_16px_-6px_rgba(41,41,41,0.25)]",
                revealed ? "scale-100 opacity-100" : "scale-75 opacity-0",
                step.status === "completed" && "bg-teal text-white",
                step.status === "in_progress" &&
                  "bg-orange text-white ring-4 ring-orange/20",
                step.status === "pending" && "bg-border text-text-secondary",
              )}
            >
              <Icon className="h-4 w-4" />
            </span>
            <span className="mt-2 text-xs font-semibold text-charcoal transition-colors group-hover:text-orange">
              {step.label}
            </span>
            <span className="text-[11px] text-text-secondary">{step.date}</span>
            {step.statusLabel && (
              <span
                className={cn(
                  "text-[11px] font-medium",
                  step.status === "in_progress"
                    ? "text-orange"
                    : "text-text-secondary",
                )}
              >
                {step.statusLabel}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
