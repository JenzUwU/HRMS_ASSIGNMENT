import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/Card";

export default function Loading() {
  return (
    <AppShell title="Dashboard">
      <div className="mb-6 h-8 w-56 animate-pulse rounded bg-border" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="space-y-3">
            <div className="h-11 w-11 animate-pulse rounded-full bg-border" />
            <div className="h-7 w-16 animate-pulse rounded bg-border" />
            <div className="h-3 w-full animate-pulse rounded bg-border" />
          </Card>
        ))}
      </div>
      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Card key={i} className="space-y-3">
            <div className="h-4 w-40 animate-pulse rounded bg-border" />
            {Array.from({ length: 4 }).map((_, r) => (
              <div key={r} className="h-3 w-full animate-pulse rounded bg-border" />
            ))}
          </Card>
        ))}
      </div>
    </AppShell>
  );
}
