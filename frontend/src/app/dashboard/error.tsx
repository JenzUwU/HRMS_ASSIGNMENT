"use client";

import { ExclamationTriangleIcon } from "@heroicons/react/24/solid";
import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/Card";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <AppShell title="Dashboard">
      <Card className="mx-auto max-w-md text-center">
        <div className="flex justify-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-coral/12 text-coral">
            <ExclamationTriangleIcon className="h-6 w-6" />
          </span>
        </div>
        <h2 className="mt-4 font-heading text-lg font-semibold text-charcoal">
          Could not load the dashboard
        </h2>
        <p className="mt-1 text-sm text-text-secondary">
          {error.message ||
            "The API request failed. Check that the backend is running on port 8000."}
        </p>
        <button
          onClick={reset}
          className="mt-5 inline-flex items-center justify-center rounded-xl bg-orange px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange/90"
        >
          Try again
        </button>
      </Card>
    </AppShell>
  );
}
