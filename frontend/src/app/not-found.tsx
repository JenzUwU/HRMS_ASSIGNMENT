"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeftIcon, HomeIcon } from "@heroicons/react/24/solid";
import { Logo } from "@/components/layout/Logo";

export default function NotFound() {
  const router = useRouter();

  return (
    <main className="flex min-h-screen items-center justify-center bg-cream px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-8 text-center shadow-[0_1px_2px_rgba(41,41,41,0.04),0_8px_24px_rgba(41,41,41,0.05)] sm:p-10">
        <div className="flex justify-center">
          <Logo size={56} />
        </div>

        <p className="mt-6 font-heading text-6xl font-bold leading-none text-orange sm:text-7xl">
          404
        </p>

        <h1 className="mt-4 font-heading text-xl font-semibold text-charcoal sm:text-2xl">
          Page not found
        </h1>

        <p className="mx-auto mt-2 max-w-xs text-sm text-text-secondary">
          The page you are looking for does not exist, was moved, or the link is
          no longer valid.
        </p>

        <div className="mt-7 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-orange/90"
          >
            <HomeIcon className="h-4 w-4" />
            Back to Dashboard
          </Link>
          <button
            onClick={() => router.back()}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-surface px-5 py-2.5 text-sm font-semibold text-charcoal transition-colors hover:bg-cream"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            Go Back
          </button>
        </div>
      </div>
    </main>
  );
}
