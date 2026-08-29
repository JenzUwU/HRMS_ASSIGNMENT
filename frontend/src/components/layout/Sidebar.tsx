"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeftIcon } from "@heroicons/react/24/solid";
import { Logo } from "@/components/layout/Logo";
import { GlassIcon, type GlassIconName } from "@/components/ui/GlassIcon";
import { cn } from "@/lib/cn";

const nav: { label: string; href: string; icon: GlassIconName }[] = [
  { label: "Dashboard", href: "/dashboard", icon: "organization" },
  { label: "Candidates", href: "/candidates", icon: "employees" },
  { label: "Engagement Journey", href: "/engagement-journey", icon: "tasks" },
  { label: "Communication", href: "/communication", icon: "messages" },
  { label: "Analytics", href: "/analytics", icon: "analytics" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-surface lg:flex">
      <div className="flex h-16 items-center gap-3 border-b border-border px-6">
        <Logo size={44} />
        <div className="leading-tight">
          <p className="text-xs font-medium text-text-secondary">
            Post Offer Engagement
          </p>
          <p className="font-heading text-lg font-bold text-charcoal">HRMS</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-2">
        {nav.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors",
                active
                  ? "bg-peach/70 text-orange"
                  : "text-text-secondary hover:bg-cream hover:text-charcoal",
              )}
            >
              <GlassIcon name={item.icon} size={20} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <button className="flex items-center gap-2 px-6 py-5 text-sm font-medium text-text-secondary hover:text-charcoal">
        <ChevronLeftIcon className="h-4 w-4" />
        Collapse
      </button>
    </aside>
  );
}
