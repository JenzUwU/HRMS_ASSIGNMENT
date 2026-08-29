import Image from "next/image";
import { cn } from "@/lib/cn";

export function Logo({
  size = 44,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <Image
      src="/brand-mark.png"
      alt="HRMS logo"
      width={size}
      height={size}
      priority
      className={cn("shrink-0 object-contain", className)}
      style={{ width: size, height: size, maxWidth: "100%" }}
    />
  );
}
