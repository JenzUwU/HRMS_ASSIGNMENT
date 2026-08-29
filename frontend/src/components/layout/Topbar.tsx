import { NotificationBell } from "@/components/layout/NotificationBell";
import { GlobalSearch } from "@/components/layout/GlobalSearch";
import { UserMenu } from "@/components/layout/UserMenu";

export function Topbar({
  title,
  searchPlaceholder,
}: {
  title: string;
  searchPlaceholder?: string;
}) {
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-4 border-b border-border bg-cream/80 px-6 backdrop-blur">
      <h1 className="font-heading text-2xl font-bold text-charcoal">{title}</h1>

      <GlobalSearch placeholder={searchPlaceholder} />

      <NotificationBell />
      <UserMenu />
    </header>
  );
}
