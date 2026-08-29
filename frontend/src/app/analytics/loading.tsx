import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/Card";

export default function Loading() {
  return (
    <AppShell title="Analytics Dashboard">
      <div className="mb-5 h-4 w-72 animate-pulse rounded bg-border" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i} className="space-y-3">
            <div className="h-11 w-11 animate-pulse rounded-full bg-border" />
            <div className="h-6 w-20 animate-pulse rounded bg-border" />
            <div className="h-3 w-full animate-pulse rounded bg-border" />
          </Card>
        ))}
      </div>
      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        {[0, 1].map((i) => (
          <Card key={i} className="space-y-3">
            <div className="h-4 w-48 animate-pulse rounded bg-border" />
            {Array.from({ length: 5 }).map((_, r) => (
              <div key={r} className="h-3 w-full animate-pulse rounded bg-border" />
            ))}
          </Card>
        ))}
      </div>
      <div className="mt-5 h-64 animate-pulse rounded-2xl border border-border bg-border/40" />
    </AppShell>
  );
}
