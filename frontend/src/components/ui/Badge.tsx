import { cn } from "@/lib/cn";
import type { RiskLevel } from "@/types";

type Tone = "orange" | "teal" | "coral" | "amber" | "neutral" | "peach";

const toneClasses: Record<Tone, string> = {
  orange: "bg-orange/15 text-orange",
  teal: "bg-teal/15 text-teal",
  coral: "bg-coral/15 text-coral",
  amber: "bg-warning/15 text-warning",
  neutral: "bg-text-secondary/12 text-text-secondary",
  peach: "bg-peach text-orange",
};

export function Badge({
  children,
  tone = "neutral",
  dot,
  className,
}: {
  children: React.ReactNode;
  tone?: Tone;
  dot?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
        toneClasses[tone],
        className,
      )}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

const riskTone: Record<RiskLevel, Tone> = {
  High: "coral",
  Medium: "amber",
  Low: "teal",
};

export function RiskBadge({ level }: { level: RiskLevel }) {
  return (
    <Badge tone={riskTone[level]} dot>
      {level}
    </Badge>
  );
}
