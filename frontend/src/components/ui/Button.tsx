import Link from "next/link";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost";

const variants: Record<Variant, string> = {
  primary: "bg-orange text-white hover:bg-orange/90",
  secondary:
    "border border-border bg-surface text-charcoal hover:bg-cream",
  ghost: "text-orange hover:bg-peach/50",
};

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
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors",
        variants[variant],
        className,
      )}
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
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors",
        variants[variant],
        className,
      )}
    >
      {children}
    </Link>
  );
}
