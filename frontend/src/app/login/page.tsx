"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  EnvelopeIcon,
  EyeIcon,
  EyeSlashIcon,
  LockClosedIcon,
} from "@heroicons/react/24/solid";
import { Logo } from "@/components/layout/Logo";

export default function LoginPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("admin@hrms.com");
  const [password, setPassword] = useState("password");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    router.push("/dashboard");
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-peach/40 px-4">
      <div className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-peach/70" />
      <div className="pointer-events-none absolute -bottom-32 -right-16 h-96 w-96 rounded-full bg-peach/60" />
      <div className="pointer-events-none absolute right-24 top-16 grid grid-cols-6 gap-2 opacity-40">
        {Array.from({ length: 36 }).map((_, i) => (
          <span key={i} className="h-1.5 w-1.5 rounded-full bg-orange/40" />
        ))}
      </div>
      <div className="pointer-events-none absolute bottom-16 left-16 grid grid-cols-6 gap-2 opacity-40">
        {Array.from({ length: 36 }).map((_, i) => (
          <span key={i} className="h-1.5 w-1.5 rounded-full bg-orange/40" />
        ))}
      </div>

      <div className="relative z-10 w-full max-w-lg rounded-3xl bg-surface p-10 shadow-[0_20px_60px_rgba(41,41,41,0.12)]">
        <div className="flex flex-col items-center pt-6 text-center">
          <Logo size={80} />
          <p className="mt-4 font-heading text-lg font-medium text-[#9A5A30]">
            Post Offer Engagement
          </p>
          <h1 className="mt-1 font-heading text-3xl font-bold text-charcoal">
            HRMS
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            Sign in to access your account
          </p>
        </div>

        <form onSubmit={submit} className="mt-8 space-y-5">
          <div>
            <label className="text-sm font-semibold text-charcoal">
              Email ID
            </label>
            <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-border px-3 py-3 focus-within:border-orange">
              <EnvelopeIcon className="h-5 w-5 text-text-secondary" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email ID"
                className="w-full bg-transparent text-sm outline-none placeholder:text-text-secondary"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold text-charcoal">
              Password
            </label>
            <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-border px-3 py-3 focus-within:border-orange">
              <LockClosedIcon className="h-5 w-5 text-text-secondary" />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full bg-transparent text-sm outline-none placeholder:text-text-secondary"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="text-text-secondary"
              >
                {showPassword ? (
                  <EyeSlashIcon className="h-5 w-5" />
                ) : (
                  <EyeIcon className="h-5 w-5" />
                )}
              </button>
            </div>
            <div className="mt-2 text-right">
              <button type="button" className="text-sm font-semibold text-orange">
                Forgot Password?
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="w-full rounded-xl bg-orange py-3.5 text-sm font-semibold text-white transition-colors hover:bg-orange/90"
          >
            Login
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-text-secondary">
          2026 HRMS. All rights reserved.
        </p>
      </div>
    </div>
  );
}
