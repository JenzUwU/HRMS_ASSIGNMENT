"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChartBarIcon,
  ChevronLeftIcon,
  HomeIcon,
  MegaphoneIcon,
  Squares2X2Icon,
  UsersIcon,
} from "@heroicons/react/24/solid";
import { Logo } from "@/components/layout/Logo";
import { cn } from "@/lib/cn";

const nav = [
  { label: "Dashboard", href: "/dashboard", icon: HomeIcon },
  { label: "Candidates", href: "/candidates", icon: UsersIcon },
  { label: "Engagement Journey", href: "/engagement-journey", icon: Squares2X2Icon },
  { label: "Communication", href: "/communication", icon: MegaphoneIcon },
  { label: "Analytics", href: "/analytics", icon: ChartBarIcon },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-surface lg:flex">
      <div className="flex items-center gap-3 px-6 py-6">
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
              <item.icon className="h-5 w-5" />
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
