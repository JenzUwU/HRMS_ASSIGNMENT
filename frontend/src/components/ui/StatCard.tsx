import { ArrowDownIcon, ArrowUpIcon } from "@heroicons/react/24/solid";
import { Card, HoverUnderline } from "@/components/ui/Card";
import { GlassIcon, type GlassIconName } from "@/components/ui/GlassIcon";
import { cn } from "@/lib/cn";

export function StatCard({
  label,
  value,
  delta,
  deltaDir = "flat",
  sub,
  icon: Icon,
  glassIcon,
  iconTone = "orange",
}: {
  label: string;
  value: string;
  delta?: string;
  deltaDir?: "up" | "down" | "flat";
  sub?: string;
  icon?: React.ComponentType<{ className?: string }>;
  glassIcon?: GlassIconName;
  iconTone?: "orange" | "teal" | "coral" | "peach";
}) {
  const toneBg = {
    orange: "bg-orange/12 text-orange",
    teal: "bg-teal/12 text-teal",
    coral: "bg-coral/12 text-coral",
    peach: "bg-peach text-orange",
  }[iconTone];

  return (
    <Card className="flex flex-col items-start gap-3">
      {glassIcon ? (
        <GlassIcon name={glassIcon} size={52} />
      ) : (
        <span className={cn("flex h-11 w-11 items-center justify-center rounded-full", toneBg)}>
          {Icon ? <Icon className="h-5 w-5" /> : null}
        </span>
      )}
      <HoverUnderline className="text-sm font-medium text-text-secondary">
        {label}
      </HoverUnderline>
      <p className="font-heading text-3xl font-semibold text-charcoal transition-transform duration-200 group-hover/card:-translate-y-0.5">
        {value}
      </p>
      <div className="flex items-center gap-1.5 text-xs">
        {delta && deltaDir !== "flat" && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 font-semibold",
              deltaDir === "up" ? "text-teal" : "text-coral",
            )}
          >
            {deltaDir === "up" ? (
              <ArrowUpIcon className="h-3 w-3" />
            ) : (
              <ArrowDownIcon className="h-3 w-3" />
            )}
            {delta}
          </span>
        )}
        {sub && <span className="text-text-secondary">{sub}</span>}
      </div>
    </Card>
  );
}
