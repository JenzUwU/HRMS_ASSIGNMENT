import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";

export function AppShell({
  title,
  searchPlaceholder,
  children,
}: {
  title: string;
  searchPlaceholder?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-cream">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar title={title} searchPlaceholder={searchPlaceholder} />
        <main className="flex-1 px-6 py-6">{children}</main>
      </div>
    </div>
  );
}
