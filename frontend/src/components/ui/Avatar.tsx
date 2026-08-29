import { cn } from "@/lib/cn";

const sizes = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-14 w-14 text-lg",
  xl: "h-24 w-24 text-3xl",
};

interface AvatarProps {
  initials: string;
  size?: keyof typeof sizes;
  online?: boolean;
  className?: string;
  tone?: "orange" | "peach";
}

export function Avatar({
  initials,
  size = "md",
  online,
  className,
  tone = "orange",
}: AvatarProps) {
  return (
    <span className={cn("relative inline-flex shrink-0", className)}>
      <span
        className={cn(
          "inline-flex items-center justify-center rounded-full font-semibold",
          sizes[size],
          tone === "orange"
            ? "bg-orange/15 text-orange"
            : "bg-peach text-orange",
        )}
      >
        {initials}
      </span>
      {online != null && (
        <span
          className={cn(
            "absolute bottom-0 right-0 block rounded-full ring-2 ring-white",
            size === "xl" ? "h-4 w-4" : "h-2.5 w-2.5",
            online ? "bg-teal" : "bg-text-secondary/40",
          )}
        />
      )}
    </span>
  );
}
