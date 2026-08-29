/**
 * Minimal toast bus. A single <Toaster /> (mounted in AppShell) registers the
 * handler; anything can call `toast(...)` without prop drilling. Mock-friendly:
 * used for export success, clipboard copy, mock "sent" confirmations, etc.
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
