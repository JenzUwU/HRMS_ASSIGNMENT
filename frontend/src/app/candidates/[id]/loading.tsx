import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/Card";

function Bar({ w = "w-full" }: { w?: string }) {
  return <div className={`h-3 ${w} animate-pulse rounded bg-border`} />;
}

export default function Loading() {
  return (
    <AppShell title="Candidate Details">
      <div className="mb-5 h-4 w-48 animate-pulse rounded bg-border" />
      <div className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <Card>
            <div className="flex gap-5">
              <div className="h-24 w-24 shrink-0 animate-pulse rounded-full bg-border" />
              <div className="flex-1 space-y-3 py-2">
                <Bar w="w-40" />
                <Bar w="w-56" />
                <Bar w="w-72" />
              </div>
            </div>
          </Card>
          <Card>
            <div className="space-y-4">
              <Bar w="w-48" />
              <Bar />
            </div>
          </Card>
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <div className="space-y-3">
                <Bar w="w-40" />
                <Bar />
                <Bar />
              </div>
            </Card>
            <Card>
              <div className="space-y-3">
                <Bar w="w-40" />
                <Bar />
                <Bar />
              </div>
            </Card>
          </div>
        </div>
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <Card key={i}>
              <div className="space-y-3">
                <Bar w="w-32" />
                <Bar />
                <Bar w="w-3/4" />
              </div>
            </Card>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
