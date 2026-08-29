import { cn } from "@/lib/cn";

export function ProgressBar({
  value,
  max = 5,
  tone = "teal",
  className,
}: {
  value: number;
  max?: number;
  tone?: "teal" | "orange" | "amber" | "coral";
  className?: string;
}) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  const toneClass = {
    teal: "bg-teal",
    orange: "bg-orange",
    amber: "bg-warning",
    coral: "bg-coral",
  }[tone];
  return (
    <div className={cn("h-1.5 w-full rounded-full bg-border", className)}>
      <div
        className={cn("h-full rounded-full", toneClass)}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
