"use client";

import { Suspense, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { EyeIcon, EyeSlashIcon } from "@heroicons/react/24/solid";
import { AuthScreen } from "@/components/auth/AuthScreen";
import {
  AuthAltAction,
  FormError,
  FormSuccess,
  SubmitButton,
} from "@/components/auth/AuthForm";
import { EMAIL_RE, MIN_PASSWORD } from "@/lib/auth-validation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { cn } from "@/lib/cn";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const justRegistered = params.get("registered") === "1";
  const nextPath = params.get("next") || "/dashboard";

  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{
    email?: string;
    password?: string;
  }>({});

  function validate() {
    const next: { email?: string; password?: string } = {};
    if (!email.trim()) next.email = "Email is required.";
    else if (!EMAIL_RE.test(email.trim()))
      next.email = "Enter a valid email address.";
    if (!password) next.password = "Password is required.";
    else if (password.length < MIN_PASSWORD)
      next.password = `Password must be at least ${MIN_PASSWORD} characters.`;
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    if (loading || !validate()) return;

    setLoading(true);
    const { error } = await supabaseBrowser().auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) {
      setFormError(
        /invalid login credentials/i.test(error.message)
          ? "Invalid email or password. Please try again."
          : error.message,
      );
      setLoading(false);
      return;
    }
    // Full navigation so the middleware re-runs with the new session cookie.
    router.replace(nextPath.startsWith("/") ? nextPath : "/dashboard");
    router.refresh();
  }

  const fieldWrap = (invalid?: string) =>
    cn(
      "mt-2 flex items-center gap-3 rounded-2xl border bg-white/90 px-3 py-2.5 shadow-[0_1px_2px_rgba(41,41,41,0.06),inset_0_1px_0_rgba(255,255,255,0.7)] backdrop-blur-md transition-colors focus-within:bg-white",
      invalid
        ? "border-coral/70 focus-within:border-coral"
        : "border-charcoal/15 focus-within:border-orange/70",
    );

  return (
    <>
      <form onSubmit={submit} noValidate className="mt-8 space-y-5">
        {justRegistered && (
          <FormSuccess>
            Account created. Sign in with your new credentials.
          </FormSuccess>
        )}
        <FormError>{formError}</FormError>

        <div>
          <label htmlFor="email" className="text-sm font-bold text-charcoal">
            Email ID
          </label>
          <div className={fieldWrap(fieldErrors.email)}>
            <span className="flex h-11 w-11 shrink-0 items-center justify-center">
              <Image
                src="/brand_email.png"
                alt=""
                width={96}
                height={64}
                className="h-auto w-[40px] object-contain"
              />
            </span>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email ID"
              className="w-full bg-transparent text-sm text-charcoal outline-none placeholder:text-text-secondary"
            />
          </div>
          {fieldErrors.email && (
            <p className="mt-1.5 text-xs font-medium text-coral">
              {fieldErrors.email}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="password" className="text-sm font-bold text-charcoal">
            Password
          </label>
          <div className={fieldWrap(fieldErrors.password)}>
            <span className="flex h-11 w-11 shrink-0 items-center justify-center">
              <Image
                src="/brand_lock.png"
                alt=""
                width={88}
                height={80}
                className="h-auto w-[38px] object-contain"
              />
            </span>
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className="w-full bg-transparent text-sm text-charcoal outline-none placeholder:text-text-secondary"
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="cursor-pointer text-text-secondary"
            >
              {showPassword ? (
                <EyeSlashIcon className="h-5 w-5" />
              ) : (
                <EyeIcon className="h-5 w-5" />
              )}
            </button>
          </div>
          {fieldErrors.password && (
            <p className="mt-1.5 text-xs font-medium text-coral">
              {fieldErrors.password}
            </p>
          )}
          <div className="mt-3 text-right">
            <Link
              href="/forgot-password"
              className="cursor-pointer text-sm font-bold text-orange hover:underline"
            >
              Forgot Password?
            </Link>
          </div>
        </div>

        <SubmitButton loading={loading}>Sign In</SubmitButton>
      </form>

      <AuthAltAction
        prompt="Don't have an account?"
        href="/signup"
        action="Create Account"
      />
    </>
  );
}

export default function LoginPage() {
  return (
    <AuthScreen subtitle="Sign in to access your account">
      <Suspense fallback={<div className="mt-8 h-[420px]" />}>
        <LoginForm />
      </Suspense>
    </AuthScreen>
  );
}
