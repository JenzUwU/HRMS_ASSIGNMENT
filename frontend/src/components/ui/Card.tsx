import Link from "next/link";
import { ArrowRightIcon } from "@heroicons/react/24/solid";
import { cn } from "@/lib/cn";

/**
 * Frosted-glass surface: translucent white over a blur, tighter corner radius,
 * a soft lift on hover. Used for every card across the app.
 */
export function Card({
  children,
  className,
  as: Tag = "div",
}: {
  children?: React.ReactNode;
  className?: string;
  as?: React.ElementType;
}) {
  return (
    <Tag
      className={cn(
        "group rounded-xl border border-white/70 bg-white/65 p-5",
        "shadow-[0_1px_2px_rgba(41,41,41,0.04),0_10px_30px_-8px_rgba(41,41,41,0.10)]",
        "ring-1 ring-black/[0.03] backdrop-blur-xl backdrop-saturate-150",
        "transition duration-200 hover:bg-white/80",
        "hover:shadow-[0_2px_8px_rgba(41,41,41,0.05),0_22px_48px_-12px_rgba(203,110,40,0.18)]",
        className,
      )}
    >
      {children}
    </Tag>
  );
}

/**
 * Text with an orange underline that wipes in from the left. The trigger is the
 * parent Card (which carries `group`), so the effect fires from anywhere inside
 * the card, and `group-active` covers tap on touch devices. The animation itself
 * is unchanged from the original text-hover version.
 */
export function HoverUnderline({
  children,
  as: Tag = "span",
  className,
}: {
  children: React.ReactNode;
  as?: React.ElementType;
  className?: string;
}) {
  return (
    <Tag
      className={cn(
        "relative inline-block w-fit transition-colors duration-200 group-hover:text-orange group-active:text-orange",
        "after:absolute after:-bottom-[3px] after:left-0 after:h-[2px] after:w-full after:origin-left",
        "after:scale-x-0 after:rounded-full after:bg-orange after:transition-transform after:duration-300 after:ease-out",
        "group-hover:after:scale-x-100 group-active:after:scale-x-100",
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
        <HoverUnderline
          as="h3"
          className="font-heading text-base font-semibold text-charcoal"
        >
          {title}
        </HoverUnderline>
        {action && actionHref && (
          <Link
            href={actionHref}
            className="group/act flex items-center gap-1 text-sm font-semibold text-orange transition-colors hover:text-orange/80"
          >
            {action}
            <ArrowRightIcon className="h-3.5 w-3.5 transition-transform duration-200 group-hover/act:translate-x-0.5" />
          </Link>
        )}
      </div>
      <div className={cn("flex-1 px-5 py-4", bodyClassName)}>{children}</div>
      {footer && (
        <Link
          href={footer.href}
          className="group/ft flex items-center justify-center gap-2 rounded-b-xl bg-cream/70 py-3 text-sm font-semibold text-orange transition-colors hover:bg-peach/60"
        >
          {footer.label}
          <ArrowRightIcon className="h-4 w-4 transition-transform duration-200 group-hover/ft:translate-x-0.5" />
        </Link>
      )}
    </Card>
  );
}
