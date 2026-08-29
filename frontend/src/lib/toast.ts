/**
 * Minimal toast bus. A single <Toaster /> (mounted in AppShell) registers the
 * handler; anything can call `toast(...)` without prop drilling. Used for
 * mutation success/failure feedback, export success, clipboard copy, etc.
 */
export type ToastTone = "default" | "success" | "error";

type ToastHandler = (message: string, tone: ToastTone) => void;

let handler: ToastHandler | null = null;

export function registerToastHandler(fn: ToastHandler | null) {
  handler = fn;
}

export function toast(message: string, tone: ToastTone = "default") {
  handler?.(message, tone);
}
