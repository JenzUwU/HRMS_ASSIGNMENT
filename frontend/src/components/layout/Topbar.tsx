import {
  BellIcon,
  ChevronDownIcon,
  MagnifyingGlassIcon,
} from "@heroicons/react/24/solid";
import { Avatar } from "@/components/ui/Avatar";

export function Topbar({
  title,
  searchPlaceholder = "Search candidates, tasks, documents...",
}: {
  title: string;
  searchPlaceholder?: string;
}) {
  return (
    <header className="sticky top-0 z-20 flex items-center gap-4 border-b border-border bg-cream/80 px-6 py-4 backdrop-blur">
      <h1 className="font-heading text-2xl font-bold text-charcoal">{title}</h1>

      <div className="mx-auto hidden w-full max-w-xl items-center gap-2 rounded-full border border-border bg-surface px-4 py-2.5 text-sm text-text-secondary md:flex">
        <MagnifyingGlassIcon className="h-4 w-4" />
        <input
          className="w-full bg-transparent outline-none placeholder:text-text-secondary"
          placeholder={searchPlaceholder}
        />
      </div>

      <button className="relative flex h-10 w-10 items-center justify-center rounded-full text-charcoal hover:bg-peach/60">
        <BellIcon className="h-5 w-5" />
        <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-orange text-[10px] font-bold text-white">
          3
        </span>
      </button>

      <div className="flex items-center gap-2">
        <Avatar initials="AU" size="md" />
        <div className="hidden leading-tight sm:block">
          <p className="text-sm font-semibold text-charcoal">Admin User</p>
          <p className="text-xs text-text-secondary">Administrator</p>
        </div>
        <ChevronDownIcon className="h-4 w-4 text-text-secondary" />
      </div>
    </header>
  );
}
