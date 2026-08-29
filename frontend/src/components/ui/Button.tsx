import Link from "next/link";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost";

const variants: Record<Variant, string> = {
  primary:
    "bg-orange text-white hover:-translate-y-px hover:bg-orange/90 hover:shadow-[0_10px_24px_-10px_rgba(252,128,25,0.6)]",
  secondary:
    "border border-border bg-surface text-charcoal hover:-translate-y-px hover:border-orange/40 hover:bg-cream",
  ghost: "text-orange hover:bg-peach/50",
};

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-150 active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange/40 disabled:pointer-events-none disabled:opacity-50";

interface BaseProps {
  variant?: Variant;
  className?: string;
  children: React.ReactNode;
}

export function Button({
  variant = "primary",
  className,
  children,
  ...rest
}: BaseProps & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(BASE, variants[variant], className)}
      {...rest}
    >
      {children}
    </button>
  );
}

export function ButtonLink({
  variant = "primary",
  className,
  children,
  href,
}: BaseProps & { href: string }) {
  return (
    <Link
      href={href}
      className={cn(BASE, variants[variant], className)}
    >
      {children}
    </Link>
  );
}
