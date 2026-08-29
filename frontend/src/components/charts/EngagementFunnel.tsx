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
          <div key={row.label} className="flex items-center gap-3">
            <div
              className={cn(
                "flex items-center justify-center rounded-md py-2.5 text-xs font-semibold text-charcoal",
                shades[i],
              )}
              style={{ width: `${width}%` }}
            >
              {row.label}
            </div>
            <div className="whitespace-nowrap text-sm font-semibold text-charcoal">
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
