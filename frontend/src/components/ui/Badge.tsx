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
  title,
}: {
  children: React.ReactNode;
  tone?: Tone;
  dot?: boolean;
  className?: string;
  title?: string;
}) {
  return (
    <span
      title={title}
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

const riskHint: Record<RiskLevel, string> = {
  High: "High risk — reach out now to avoid drop-off",
  Medium: "Medium risk — keep engagement steady",
  Low: "Low risk — engagement looks healthy",
};

/**
 * Risk indicator. High risk gets a restrained, slow "attention" pulse (soft
 * breathing halo, never a flash) that intensifies slightly on hover. Other
 * levels stay calm. Hovering any level shows a plain-language explanation.
 */
export function RiskBadge({ level }: { level: RiskLevel }) {
  return (
    <Badge
      tone={riskTone[level]}
      dot
      title={riskHint[level]}
      className={cn(
        "cursor-help transition-shadow duration-200",
        level === "High"
          ? "risk-pulse hover:shadow-[0_0_0_5px_rgba(232,93,74,0.18)]"
          : "hover:shadow-[0_0_0_4px_rgba(41,41,41,0.06)]",
      )}
    >
      {level}
    </Badge>
  );
}
