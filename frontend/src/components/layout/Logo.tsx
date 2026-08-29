import Image from "next/image";
import { cn } from "@/lib/cn";

// Intrinsic pixel size of /public/brand-mark.png, used only to lock the
// aspect ratio. The asset itself is never processed; `size` controls the
// rendered height in CSS and width follows the ratio.
const INTRINSIC = { width: 1536, height: 1024 };

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
      width={INTRINSIC.width}
      height={INTRINSIC.height}
      priority
      className={cn("shrink-0", className)}
      style={{ height: size, width: "auto", maxWidth: "100%" }}
    />
  );
}
