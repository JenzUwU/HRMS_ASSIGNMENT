"use client";

import { useState } from "react";
import { AuthScreen } from "@/components/auth/AuthScreen";
import {
  AuthAltAction,
  Field,
  FormError,
  FormSuccess,
  SubmitButton,
} from "@/components/auth/AuthForm";
import { EMAIL_RE } from "@/lib/auth-validation";
import { supabaseBrowser } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [fieldError, setFieldError] = useState("");
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setFieldError("");
    if (loading) return;
    if (!EMAIL_RE.test(email.trim())) {
      setFieldError("Enter a valid email address.");
      return;
    }
    setLoading(true);
    // Fire and forget: the UI never reveals whether the email is registered.
    await supabaseBrowser()
      .auth.resetPasswordForEmail(email.trim(), {
        redirectTo:
          typeof window !== "undefined"
            ? `${window.location.origin}/login`
            : undefined,
      })
      .catch(() => {});
    setLoading(false);
    setSent(true);
  }

  return (
    <AuthScreen subtitle="Reset your HRMS password">
      {sent ? (
        <div className="mt-8 space-y-5">
          <FormSuccess>
            If an account exists for <strong>{email.trim()}</strong>, a
            password-reset link is on its way. This is a prototype, so no email
            is actually sent.
          </FormSuccess>
          <AuthAltAction
            prompt="Remembered it?"
            href="/login"
            action="Back to sign in"
          />
        </div>
      ) : (
        <>
          <form onSubmit={submit} noValidate className="mt-8 space-y-5">
            <FormError>{fieldError}</FormError>
            <p className="text-sm text-text-secondary">
              Enter the email tied to your account and we&apos;ll send
              instructions to reset your password.
            </p>
            <Field
              label="Work Email"
              name="email"
              type="email"
              value={email}
              onChange={setEmail}
              placeholder="jane@company.com"
              autoComplete="email"
              iconSrc="/brand_email.png"
              iconWidth={38}
              error={fieldError || undefined}
            />
            <SubmitButton loading={loading}>Send Reset Link</SubmitButton>
          </form>

          <AuthAltAction
            prompt="Remembered it?"
            href="/login"
            action="Back to sign in"
          />
        </>
      )}
    </AuthScreen>
  );
}
