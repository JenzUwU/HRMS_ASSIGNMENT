"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AuthScreen } from "@/components/auth/AuthScreen";
import {
  AuthAltAction,
  Field,
  FormError,
  SubmitButton,
} from "@/components/auth/AuthForm";
import { EMAIL_RE, MIN_PASSWORD } from "@/lib/auth-validation";
import { apiFetch, ApiError } from "@/lib/api-client";
import { supabaseBrowser } from "@/lib/supabase/client";

type Errors = Partial<
  Record<"fullName" | "email" | "password" | "confirm", string>
>;

export default function SignupPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState("");
  const [errors, setErrors] = useState<Errors>({});

  function validate() {
    const next: Errors = {};
    if (!fullName.trim()) next.fullName = "Full name is required.";
    if (!email.trim()) next.email = "Email is required.";
    else if (!EMAIL_RE.test(email.trim()))
      next.email = "Enter a valid email address.";
    if (!password) next.password = "Password is required.";
    else if (password.length < MIN_PASSWORD)
      next.password = `Use at least ${MIN_PASSWORD} characters.`;
    if (!confirm) next.confirm = "Confirm your password.";
    else if (confirm !== password) next.confirm = "Passwords do not match.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    if (loading || !validate()) return;

    setLoading(true);
    try {
      // Backend creates the Supabase Auth user with role = HR and provisions
      // the recruiter profile (server-side, with the secret key).
      await apiFetch("/auth/signup", {
        method: "POST",
        body: {
          full_name: fullName.trim(),
          email: email.trim().toLowerCase(),
          password,
        },
      });
      // Then sign in from the browser to establish the session.
      const { error } = await supabaseBrowser().auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (error) {
        router.push("/login?registered=1");
        return;
      }
      router.replace("/dashboard");
      router.refresh();
    } catch (err) {
      setFormError(
        err instanceof ApiError
          ? err.message
          : "Could not create your account. Please try again.",
      );
      setLoading(false);
    }
  }

  return (
    <AuthScreen subtitle="Create your HR account">
      <form onSubmit={submit} noValidate className="mt-8 space-y-4">
        <FormError>{formError}</FormError>

        <Field
          label="Full Name"
          name="fullName"
          value={fullName}
          onChange={setFullName}
          placeholder="Jane Doe"
          autoComplete="name"
          iconSrc="/brand_user.png"
          iconWidth={34}
          error={errors.fullName}
        />
        <Field
          label="Email"
          name="email"
          type="email"
          value={email}
          onChange={setEmail}
          placeholder="jane@company.com"
          autoComplete="email"
          iconSrc="/brand_email.png"
          iconWidth={38}
          error={errors.email}
        />
        <Field
          label="Password"
          name="password"
          value={password}
          onChange={setPassword}
          placeholder="At least 8 characters"
          autoComplete="new-password"
          iconSrc="/brand_lock.png"
          iconWidth={34}
          password
          error={errors.password}
        />
        <Field
          label="Confirm Password"
          name="confirm"
          value={confirm}
          onChange={setConfirm}
          placeholder="Re-enter your password"
          autoComplete="new-password"
          iconSrc="/brand_lock.png"
          iconWidth={34}
          password
          error={errors.confirm}
        />

        <div className="pt-1">
          <SubmitButton loading={loading}>Create Account</SubmitButton>
        </div>
      </form>

      <AuthAltAction
        prompt="Already have an account?"
        href="/login"
        action="Sign in"
      />
    </AuthScreen>
  );
}
