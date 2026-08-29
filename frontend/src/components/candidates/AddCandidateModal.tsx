"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { XMarkIcon } from "@heroicons/react/24/solid";
import { toast } from "@/lib/toast";
import { mutationErrorMessage } from "@/lib/ai-error";
import {
  createCandidate,
  type CreateCandidateBody,
  type Recruiter,
} from "@/lib/api";

const STATUS = [
  ["offer_accepted", "Offer Accepted"],
  ["active", "Active"],
] as const;

const STAGES = [
  ["offer_accepted", "Offer Accepted"],
  ["welcome_sent", "Welcome Sent"],
  ["documentation", "Documentation"],
  ["manager_intro", "Manager Introduction"],
  ["pre_joining", "Pre-Joining Check-in"],
] as const;

function todayPlus(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function AddCandidateModal({
  recruiters,
  onClose,
  onCreated,
}: {
  recruiters: Recruiter[];
  onClose: () => void;
  onCreated?: () => void;
}) {
  const router = useRouter();
  const [form, setForm] = useState<CreateCandidateBody>({
    full_name: "",
    email: "",
    phone: "",
    role: "",
    department: "",
    location: "",
    recruiter_id: recruiters[0]?.id ?? null,
    offer_date: todayPlus(-1),
    joining_date: todayPlus(14),
    status: "offer_accepted",
    current_stage: "offer_accepted",
    source: "other",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  function set<K extends keyof CreateCandidateBody>(
    key: K,
    value: CreateCandidateBody[K],
  ) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim());
  const valid =
    form.full_name.trim().length >= 2 &&
    emailOk &&
    form.role.trim().length >= 2 &&
    form.location.trim().length >= 2 &&
    !!form.joining_date;

  async function submit() {
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      const created = await createCandidate({
        ...form,
        phone: form.phone?.trim() || null,
        department: form.department?.trim() || null,
      });
      toast(`${created.full_name} added`, "success");
      onCreated?.();
      router.refresh();
      onClose();
      router.push(`/candidates/${created.slug}`);
    } catch (e) {
      setError(mutationErrorMessage(e, "Could not create the candidate."));
    } finally {
      setBusy(false);
    }
  }

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal/30 p-4 backdrop-blur-sm"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Add candidate"
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/70 bg-white/95 p-5 shadow-[0_30px_70px_-20px_rgba(41,41,41,0.35)] ring-1 ring-black/5 backdrop-blur-xl"
      >
        <div className="mb-4 flex items-start justify-between">
          <h3 className="font-heading text-base font-semibold text-charcoal">
            Add Candidate
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1 text-text-secondary hover:bg-cream hover:text-charcoal"
          >
            <XMarkIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Full name" span2>
            <input
              autoFocus
              value={form.full_name}
              onChange={(e) => set("full_name", e.target.value)}
              className={input}
            />
          </Field>
          <Field label="Email" span2 hint={!emailOk && form.email ? "Enter a valid email" : undefined}>
            <input
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              className={input}
            />
          </Field>
          <Field label="Phone">
            <input
              value={form.phone ?? ""}
              onChange={(e) => set("phone", e.target.value)}
              className={input}
            />
          </Field>
          <Field label="Role">
            <input
              value={form.role}
              onChange={(e) => set("role", e.target.value)}
              className={input}
            />
          </Field>
          <Field label="Department">
            <input
              value={form.department ?? ""}
              onChange={(e) => set("department", e.target.value)}
              className={input}
            />
          </Field>
          <Field label="Location">
            <input
              value={form.location}
              onChange={(e) => set("location", e.target.value)}
              placeholder="City, State"
              className={input}
            />
          </Field>
          <Field label="Recruiter" span2>
            <select
              value={form.recruiter_id ?? ""}
              onChange={(e) => set("recruiter_id", e.target.value || null)}
              className={input}
            >
              {recruiters.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.full_name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Offer date">
            <input
              type="date"
              value={form.offer_date ?? ""}
              onChange={(e) => set("offer_date", e.target.value)}
              className={input}
            />
          </Field>
          <Field label="Joining date">
            <input
              type="date"
              value={form.joining_date}
              onChange={(e) => set("joining_date", e.target.value)}
              className={input}
            />
          </Field>
          <Field label="Status">
            <select
              value={form.status}
              onChange={(e) =>
                set("status", e.target.value as CreateCandidateBody["status"])
              }
              className={input}
            >
              {STATUS.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Engagement stage">
            <select
              value={form.current_stage}
              onChange={(e) =>
                set(
                  "current_stage",
                  e.target.value as CreateCandidateBody["current_stage"],
                )
              }
              className={input}
            >
              {STAGES.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {error && <p className="mt-3 text-sm text-coral">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-border px-4 py-2 text-sm font-semibold text-charcoal hover:bg-cream"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!valid || busy}
            className="rounded-xl bg-orange px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange/90 disabled:opacity-50"
          >
            {busy ? "Adding…" : "Add Candidate"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

const input =
  "w-full rounded-xl border border-border bg-white/70 px-3 py-2 text-sm text-charcoal outline-none focus:border-orange";

function Field({
  label,
  children,
  span2,
  hint,
}: {
  label: string;
  children: ReactNode;
  span2?: boolean;
  hint?: string;
}) {
  return (
    <label className={span2 ? "col-span-2" : "col-span-1"}>
      <span className="mb-1 block text-xs font-semibold text-text-secondary">
        {label}
      </span>
      {children}
      {hint && <span className="mt-1 block text-xs text-coral">{hint}</span>}
    </label>
  );
}
