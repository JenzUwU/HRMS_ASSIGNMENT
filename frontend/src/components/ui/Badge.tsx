import { cn } from "@/lib/cn";
import type { RiskLevel } from "@/types";

type Tone = "orange" | "teal" | "coral" | "amber" | "neutral" | "peach";

// Liquid-glass pills: tinted translucent fill + matching hairline ring, a soft
// blur behind, and an inset top highlight (added in the base class) for the
// glossy lip. Colours are unchanged from the flat version.
const toneClasses: Record<Tone, string> = {
  orange: "bg-orange/15 text-orange ring-orange/25",
  teal: "bg-teal/15 text-teal ring-teal/25",
  coral: "bg-coral/18 text-coral ring-coral/30",
  amber: "bg-warning/15 text-warning ring-warning/30",
  neutral: "bg-text-secondary/12 text-text-secondary ring-text-secondary/20",
  peach: "bg-peach text-orange ring-orange/20",
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
        "ring-1 backdrop-blur-sm ring-inset",
        "shadow-[0_1px_2px_rgba(41,41,41,0.06),inset_0_1px_0_rgba(255,255,255,0.55)]",
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
  High: "High risk: reach out now to avoid drop-off",
  Medium: "Medium risk: keep engagement steady",
  Low: "Low risk: engagement looks healthy",
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
