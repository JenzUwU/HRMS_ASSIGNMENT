import {
  CalendarDaysIcon,
  CheckIcon,
  DocumentTextIcon,
  FlagIcon,
  UserIcon,
} from "@heroicons/react/24/solid";
import { cn } from "@/lib/cn";

export type StepStatus = "completed" | "in_progress" | "pending";

const icons = [CheckIcon, CheckIcon, DocumentTextIcon, UserIcon, CalendarDaysIcon, FlagIcon];

export interface JourneyStep {
  label: string;
  date: string;
  status: StepStatus;
  statusLabel?: string;
}

export function JourneyStepper({ steps }: { steps: JourneyStep[] }) {
  return (
    <div className="flex items-start justify-between gap-2">
      {steps.map((step, i) => {
        const Icon = icons[i] ?? CheckIcon;
        return (
          <div key={step.label} className="relative flex flex-1 flex-col items-center text-center">
            {i < steps.length - 1 && (
              <span
                className={cn(
                  "absolute left-1/2 top-5 h-0.5 w-full",
                  step.status === "completed" ? "bg-teal" : "bg-border",
                )}
              />
            )}
            <span
              className={cn(
                "relative z-10 flex h-10 w-10 items-center justify-center rounded-full",
                step.status === "completed" && "bg-teal text-white",
                step.status === "in_progress" && "bg-orange text-white",
                step.status === "pending" && "bg-border text-text-secondary",
              )}
            >
              <Icon className="h-4 w-4" />
            </span>
            <span className="mt-2 text-xs font-semibold text-charcoal">
              {step.label}
            </span>
            <span className="text-[11px] text-text-secondary">{step.date}</span>
            {step.statusLabel && (
              <span
                className={cn(
                  "text-[11px] font-medium",
                  step.status === "in_progress" ? "text-orange" : "text-text-secondary",
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
