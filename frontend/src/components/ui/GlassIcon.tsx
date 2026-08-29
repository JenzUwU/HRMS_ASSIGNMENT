import Image from "next/image";
import { cn } from "@/lib/cn";

/**
 * Glassmorphism icon set. Source PNGs live in `public/icons/` and are owned /
 * maintained by the design side, do not edit them here. Use this component
 * wherever a semantic icon is shown (nav, section headers, stat tiles, list
 * adornments). Purely functional glyphs with no glass equivalent (chevrons,
 * arrows, ellipsis, close, sort) stay on the outline heroicon set.
 */
export const GLASS_ICON_NAMES = [
  "employees",
  "employee",
  "organization",
  "employee-details",
  "leave",
  "jobs",
  "documents",
  "files",
  "notifications",
  "email",
  "attendance",
  "analytics",
  "settings",
  "search",
  "filters",
  "add-employee",
  "employee-search",
  "tasks",
  "security",
  "messages",
  "phone_number",
  "upload",
  "download",
  "logout",
  "support",
] as const;

export type GlassIconName = (typeof GLASS_ICON_NAMES)[number];

export function GlassIcon({
  name,
  size = 24,
  className,
  alt = "",
}: {
  name: GlassIconName;
  size?: number;
  className?: string;
  alt?: string;
}) {
  return (
    <Image
      src={`/icons/${name}.png`}
      alt={alt}
      width={size}
      height={size}
      className={cn("shrink-0 select-none object-contain", className)}
      style={{ width: size, height: size }}
      aria-hidden={alt === "" || undefined}
      draggable={false}
    />
  );
}
