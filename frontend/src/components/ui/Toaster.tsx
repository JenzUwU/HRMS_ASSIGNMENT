"use client";

import { useEffect, useState } from "react";
import { CheckCircleIcon, ExclamationTriangleIcon } from "@heroicons/react/24/solid";
import { registerToastHandler, type ToastTone } from "@/lib/toast";
import { cn } from "@/lib/cn";

interface Item {
  id: number;
  message: string;
  tone: ToastTone;
}

let seq = 0;

export function Toaster() {
  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => {
    registerToastHandler((message, tone) => {
      const id = ++seq;
      setItems((cur) => [...cur, { id, message, tone }]);
      window.setTimeout(() => {
        setItems((cur) => cur.filter((i) => i.id !== id));
      }, 2600);
    });
    return () => registerToastHandler(null);
  }, []);

  if (items.length === 0) return null;

  return (
    <div
      className="pointer-events-none fixed bottom-5 right-5 z-[100] flex flex-col items-end gap-2"
      role="status"
      aria-live="polite"
    >
      {items.map((i) => (
        <div
          key={i.id}
          className={cn(
            "animate-menu-in pointer-events-auto flex items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-sm font-medium",
            "shadow-[0_18px_44px_-12px_rgba(41,41,41,0.28)] ring-1 ring-black/5 backdrop-blur-xl backdrop-saturate-150",
            i.tone === "success" &&
              "border-teal/30 bg-teal/10 text-teal",
            i.tone === "error" && "border-coral/30 bg-coral/10 text-coral",
            i.tone === "default" &&
              "border-white/70 bg-white/85 text-charcoal",
          )}
        >
          {i.tone === "success" && (
            <CheckCircleIcon className="h-4 w-4 shrink-0" />
          )}
          {i.tone === "error" && (
            <ExclamationTriangleIcon className="h-4 w-4 shrink-0" />
          )}
          {i.message}
        </div>
      ))}
    </div>
  );
}
