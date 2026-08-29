"use client";

import Link from "next/link";
import { ArrowLeftIcon, ExclamationTriangleIcon } from "@heroicons/react/24/solid";
import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/Card";

export default function CandidateDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <AppShell title="Candidate Details">
      <Card className="mx-auto max-w-md text-center">
        <div className="flex justify-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-coral/12 text-coral">
            <ExclamationTriangleIcon className="h-6 w-6" />
          </span>
        </div>
        <h2 className="mt-4 font-heading text-lg font-semibold text-charcoal">
          Could not load this candidate
        </h2>
        <p className="mt-1 text-sm text-text-secondary">
          {error.message ||
            "The API request failed. Check that the backend is running on port 8000."}
        </p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <button
            onClick={reset}
            className="inline-flex items-center justify-center rounded-xl bg-orange px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange/90"
          >
            Try again
          </button>
          <Link
            href="/candidates"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-surface px-5 py-2.5 text-sm font-semibold text-charcoal hover:bg-cream"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            Back to Candidates
          </Link>
        </div>
      </Card>
    </AppShell>
  );
}
