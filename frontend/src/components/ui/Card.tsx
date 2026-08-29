import Link from "next/link";
import { ArrowRightIcon } from "@heroicons/react/24/solid";
import { cn } from "@/lib/cn";

export function Card({
  children,
  className,
  as: Tag = "div",
}: {
  children: React.ReactNode;
  className?: string;
  as?: React.ElementType;
}) {
  return (
    <Tag
      className={cn(
        "rounded-2xl border border-border bg-surface p-5 shadow-[0_1px_2px_rgba(41,41,41,0.04),0_8px_24px_rgba(41,41,41,0.05)]",
        className,
      )}
    >
      {children}
    </Tag>
  );
}

export function SectionCard({
  title,
  action,
  actionHref,
  children,
  className,
  bodyClassName,
  footer,
}: {
  title: string;
  action?: string;
  actionHref?: string;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  footer?: { label: string; href: string };
}) {
  return (
    <Card className={cn("flex flex-col p-0", className)}>
      <div className="flex items-center justify-between px-5 pt-5">
        <h3 className="font-heading text-base font-semibold text-charcoal">
          {title}
        </h3>
        {action && actionHref && (
          <Link
            href={actionHref}
            className="text-sm font-semibold text-orange hover:underline"
          >
            {action}
          </Link>
        )}
      </div>
      <div className={cn("flex-1 px-5 py-4", bodyClassName)}>{children}</div>
      {footer && (
        <Link
          href={footer.href}
          className="flex items-center justify-center gap-2 rounded-b-2xl bg-cream/70 py-3 text-sm font-semibold text-orange hover:bg-peach/60"
        >
          {footer.label}
          <ArrowRightIcon className="h-4 w-4" />
        </Link>
      )}
    </Card>
  );
}
