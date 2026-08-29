import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/Card";

function Bar({ w = "w-full" }: { w?: string }) {
  return <div className={`h-3 ${w} animate-pulse rounded bg-border`} />;
}

export default function Loading() {
  return (
    <AppShell title="Engagement Journey">
      <div className="mb-5 h-4 w-64 animate-pulse rounded bg-border" />
      <Card className="mb-4">
        <div className="flex gap-4">
          <div className="h-14 w-14 shrink-0 animate-pulse rounded-full bg-border" />
          <div className="flex-1 space-y-3 py-1">
            <Bar w="w-48" />
            <Bar w="w-64" />
          </div>
        </div>
      </Card>
      <Card className="mb-4">
        <Bar />
      </Card>
      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="space-y-3 xl:col-span-2">
          <Bar w="w-56" />
          <Bar />
          <Bar />
          <Bar w="w-3/4" />
        </Card>
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <Card key={i} className="space-y-3">
              <Bar w="w-32" />
              <Bar />
            </Card>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
