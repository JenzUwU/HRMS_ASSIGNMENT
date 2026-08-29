import { cn } from "@/lib/cn";

const shades = [
  "bg-peach",
  "bg-teal/25",
  "bg-warning/25",
  "bg-orange/20",
  "bg-coral/20",
  "bg-charcoal/10",
];

export function EngagementFunnel({
  data,
}: {
  data: { label: string; value: number; pct: number }[];
}) {
  return (
    <div className="space-y-1.5">
      {data.map((row, i) => {
        const width = 55 + (row.pct / 100) * 45;
        return (
          // Each row is its own hover parent (named group so it does not collide
          // with the parent Card's unnamed group). group-active covers tap.
          <div
            key={row.label}
            className="group/stage flex items-center gap-3"
          >
            <div
              className={cn(
                "relative flex cursor-default select-none items-center justify-center overflow-hidden rounded-md py-2.5 text-xs font-semibold text-charcoal",
                // lift + depth + a white edge highlight that follows the radius.
                // transform + box-shadow + ring only, so there is no layout shift.
                "transition-[transform,box-shadow] duration-300 ease-out",
                "ring-1 ring-inset ring-white/0",
                "group-hover/stage:-translate-y-0.5 group-hover/stage:shadow-[0_6px_16px_-6px_rgba(41,41,41,0.18)] group-hover/stage:ring-white/70",
                "group-active/stage:-translate-y-0.5 group-active/stage:shadow-[0_6px_16px_-6px_rgba(41,41,41,0.18)] group-active/stage:ring-white/70",
                // glass sweep: a soft diagonal white band driven across the bar
                // via background-position, contained by the bar bounds.
                "before:pointer-events-none before:absolute before:inset-0 before:z-0",
                "before:bg-[linear-gradient(110deg,transparent_38%,rgba(255,255,255,0.6)_50%,transparent_62%)]",
                "before:bg-[length:220%_100%] before:bg-[position:160%_0]",
                "before:transition-[background-position] before:duration-[700ms] before:ease-out",
                "group-hover/stage:before:bg-[position:-60%_0] group-active/stage:before:bg-[position:-60%_0]",
                shades[i],
              )}
              style={{ width: `${width}%` }}
            >
              <span className="relative z-10">{row.label}</span>
            </div>
            <div className="whitespace-nowrap text-sm font-semibold text-charcoal transition-transform duration-300 ease-out group-hover/stage:-translate-y-0.5 group-active/stage:-translate-y-0.5">
              {row.value}
              {i > 0 && (
                <span className="ml-1 text-xs font-medium text-text-secondary">
                  ({row.pct}%)
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
