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
import { EMAIL_RE, MIN_PASSWORD, registerAccount } from "@/lib/mock-auth";

type Errors = Partial<
  Record<"fullName" | "email" | "company" | "password" | "confirm", string>
>;

export default function SignupPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState("");
  const [errors, setErrors] = useState<Errors>({});

  function validate() {
    const next: Errors = {};
    if (!fullName.trim()) next.fullName = "Full name is required.";
    if (!email.trim()) next.email = "Work email is required.";
    else if (!EMAIL_RE.test(email.trim()))
      next.email = "Enter a valid email address.";
    if (!company.trim()) next.company = "Company name is required.";
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
    const res = await registerAccount({ fullName, email, company, password });
    if (res.ok) {
      router.push("/login?registered=1");
      return;
    }
    setFormError(res.error);
    setLoading(false);
  }

  return (
    <AuthScreen subtitle="Create your HRMS workspace account">
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
          label="Work Email"
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
          label="Company Name"
          name="company"
          value={company}
          onChange={setCompany}
          placeholder="Acme Inc."
          autoComplete="organization"
          iconSrc="/brand_company.png"
          iconWidth={22}
          error={errors.company}
        />
        <Field
          label="Password"
          name="password"
          value={password}
          onChange={setPassword}
          placeholder="At least 6 characters"
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
