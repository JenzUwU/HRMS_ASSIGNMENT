"use client";

import { useState, type ComponentType } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRightIcon,
  ExclamationTriangleIcon,
  EyeIcon,
  EyeSlashIcon,
} from "@heroicons/react/24/solid";
import { cn } from "@/lib/cn";

/** Glassy input row matching the login page fields. */
export function Field({
  label,
  name,
  type = "text",
  value,
  onChange,
  placeholder,
  error,
  autoComplete,
  iconSrc,
  iconWidth = 36,
  icon: Icon,
  password = false,
}: {
  label: string;
  name: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  error?: string;
  autoComplete?: string;
  iconSrc?: string;
  iconWidth?: number;
  icon?: ComponentType<{ className?: string }>;
  password?: boolean;
}) {
  const [reveal, setReveal] = useState(false);
  const inputType = password ? (reveal ? "text" : "password") : type;

  return (
    <div>
      <label htmlFor={name} className="text-sm font-bold text-charcoal">
        {label}
      </label>
      <div
        className={cn(
          "mt-2 flex items-center gap-3 rounded-2xl border bg-white/90 px-3 py-2.5 shadow-[0_1px_2px_rgba(41,41,41,0.06),inset_0_1px_0_rgba(255,255,255,0.7)] backdrop-blur-md transition-colors focus-within:bg-white",
          error
            ? "border-coral/70 focus-within:border-coral"
            : "border-charcoal/15 focus-within:border-orange/70",
        )}
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center">
          {iconSrc ? (
            <Image
              src={iconSrc}
              alt=""
              width={96}
              height={80}
              style={{ width: iconWidth, height: "auto" }}
              className="object-contain"
            />
          ) : Icon ? (
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange/10 text-orange">
              <Icon className="h-[18px] w-[18px]" />
            </span>
          ) : null}
        </span>
        <input
          id={name}
          name={name}
          type={inputType}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className="w-full bg-transparent text-sm text-charcoal outline-none placeholder:text-text-secondary"
        />
        {password && (
          <button
            type="button"
            onClick={() => setReveal((s) => !s)}
            aria-label={reveal ? "Hide password" : "Show password"}
            className="cursor-pointer text-text-secondary"
          >
            {reveal ? (
              <EyeSlashIcon className="h-5 w-5" />
            ) : (
              <EyeIcon className="h-5 w-5" />
            )}
          </button>
        )}
      </div>
      {error && (
        <p className="mt-1.5 text-xs font-medium text-coral">{error}</p>
      )}
    </div>
  );
}

/** Inline, professional error banner for failed submissions. */
export function FormError({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-xl border border-coral/30 bg-coral/10 px-3.5 py-2.5 text-sm font-medium text-coral"
    >
      <ExclamationTriangleIcon className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

/** Inline success banner (e.g. after registration or reset request). */
export function FormSuccess({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return (
    <div className="rounded-xl border border-teal/30 bg-teal/10 px-3.5 py-2.5 text-sm font-medium text-teal">
      {children}
    </div>
  );
}

/** Primary submit button, matches the login button, adds a loading state. */
export function SubmitButton({
  loading,
  children,
}: {
  loading?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="btn-border-spark flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border border-transparent bg-gradient-to-r from-[#ffa24d] to-orange py-4 text-[15px] font-bold text-white shadow-[0_16px_32px_-10px_rgba(252,128,25,0.6)] transition-transform duration-150 hover:-translate-y-px active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0"
    >
      {loading ? (
        <>
          <span
            aria-hidden="true"
            className="h-[18px] w-[18px] animate-spin rounded-full border-2 border-current border-t-transparent"
          />
          Please wait&hellip;
        </>
      ) : (
        <>
          {children}
          <ArrowRightIcon className="h-[18px] w-[18px]" />
        </>
      )}
    </button>
  );
}

/** Secondary link line under the card body ("Don't have an account?" etc.). */
export function AuthAltAction({
  prompt,
  href,
  action,
}: {
  prompt: string;
  href: string;
  action: string;
}) {
  return (
    <p className="mt-5 text-center text-sm text-text-secondary">
      {prompt}{" "}
      <Link href={href} className="font-bold text-orange hover:underline">
        {action}
      </Link>
    </p>
  );
}
