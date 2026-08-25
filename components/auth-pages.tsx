"use client";

import { TextInput, TextArea } from "./form-controls";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AuthShell } from "./auth-shell";
import { Icon } from "./icons";
import { isValidEmail, PASSWORD_MIN_LENGTH, PASSWORD_RESET_COOLDOWN_SECONDS, getMockResetLinkState, requestPasswordReset, resetPassword } from "@/lib/auth-repository";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [resetPath, setResetPath] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (!cooldown) return;
    const timer = window.setInterval(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  async function sendRequest() {
    setError(null); setSuccess(null); setResetPath(null);
    if (!isValidEmail(email)) { setError("Enter a valid email address."); return; }
    setSubmitting(true);
    const result = await requestPasswordReset(email);
    if (result.ok) { setSuccess(result.message); setResetPath(result.resetPath); setCooldown(result.cooldownSeconds || PASSWORD_RESET_COOLDOWN_SECONDS); }
    else setError(result.message);
    setSubmitting(false);
  }

  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); await sendRequest(); }

  return <AuthShell kicker="Password recovery" title="Reset your password" description="Enter your work email and we’ll send password reset instructions.">
    <form className="auth-form" onSubmit={submit} noValidate>
      <div className="form-field"><label htmlFor="reset-email">Email address</label><TextInput id="reset-email" name="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} aria-invalid={Boolean(error)} aria-describedby={error ? "reset-email-error" : undefined} required/>{error && <p id="reset-email-error" className="field-error" role="alert">{error}</p>}</div>
      {success && <div className="login-message login-message-info" role="status"><span aria-hidden="true">i</span>{success}</div>}
      {resetPath && <div className="mock-reset-link"><p>Mock preview is enabled for this local build.</p><Link className="button button-secondary" href={resetPath}>Open reset password preview <Icon name="arrow" size={14}/></Link></div>}
      <button className="login-submit" type="submit" disabled={submitting || cooldown > 0}>{submitting ? "Sending reset link…" : cooldown > 0 ? `Resend available in ${cooldown}s` : "Send reset link"}</button>
    </form>
    <div className="auth-footer-links"><Link href="/">Return to sign in</Link>{success && <button className="text-button" type="button" onClick={sendRequest} disabled={submitting || cooldown > 0}>Resend reset link</button>}</div>
  </AuthShell>;
}

export function ResetPasswordPage() {
  const params = useSearchParams();
  const token = params.get("token") ?? (params.get("mock") === "valid" ? "mock-valid" : "");
  const [linkState, setLinkState] = useState<ReturnType<typeof getMockResetLinkState> | "loading">("loading");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let active = true;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) { setLinkState(getMockResetLinkState(token)); return () => { active = false; }; }
    const validateRecoverySession = async () => {
      // createBrowserClient is configured with detectSessionInUrl, so it
      // exchanges the one-time PKCE code during client initialization.
      // Calling exchangeCodeForSession here would consume a valid link twice.
      const { data } = await supabase.auth.getSession();
      if (active) setLinkState(data.session ? "ready" : "invalid");
    };
    void validateRecoverySession();
    return () => { active = false; };
  }, [token]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null); setFieldErrors({});
    if (!password || !confirmation) { setError("Enter and confirm your new password."); return; }
    setSubmitting(true);
    const result = await resetPassword(token, password, confirmation);
    if (result.ok) { setSuccess(true); setLinkState("used"); }
    else { setError(result.message); setFieldErrors(result.fieldErrors ?? {}); }
    setSubmitting(false);
  }

  if (linkState === "loading") return <AuthShell kicker="Password recovery" title="Check your reset link" description="Validating your password reset link…"><div className="auth-loading" aria-label="Validating reset link">Loading…</div></AuthShell>;
  if (linkState !== "ready" || success) return <AuthShell kicker="Password recovery" title={success ? "Password changed" : "Reset link unavailable"} description={success ? "Your Smartegy password has been updated successfully." : "This password reset link cannot be used."}><div className={success ? "auth-success-panel" : "auth-error-panel"} role="status"><span aria-hidden="true">{success ? "✓" : "!"}</span><p>{success ? "You can now sign in with your new password." : error ?? (linkState === "expired" ? "This link has expired." : linkState === "used" ? "This link has already been used." : "Request a new reset link to continue.")}</p></div><Link className="login-submit auth-action-link" href={success ? "/" : "/forgot-password"}>{success ? "Continue to sign in" : "Request a new reset link"}</Link></AuthShell>;

  return <AuthShell kicker="Password recovery" title="Choose a new password" description="Use a strong password you do not reuse elsewhere.">
    <form className="auth-form" onSubmit={submit} noValidate>
      <PasswordField id="new-password" label="New password" value={password} onChange={setPassword} visible={showPassword} onToggle={() => setShowPassword((value) => !value)} error={fieldErrors.password}/>
      <PasswordField id="confirm-new-password" label="Confirm new password" value={confirmation} onChange={setConfirmation} visible={showConfirmation} onToggle={() => setShowConfirmation((value) => !value)} error={fieldErrors.confirmation}/>
      <p className="password-requirements">Password requirements: at least {PASSWORD_MIN_LENGTH} characters.</p>
      {error && <div className="login-message login-message-error" role="alert"><span aria-hidden="true">!</span>{error}</div>}
      <button className="login-submit" type="submit" disabled={submitting}>{submitting ? "Updating password…" : "Reset password"}</button>
    </form>
    <div className="auth-footer-links"><Link href="/">Return to sign in</Link></div>
  </AuthShell>;
}

function PasswordField({ id, label, value, onChange, visible, onToggle, error }: { id: string; label: string; value: string; onChange: (value: string) => void; visible: boolean; onToggle: () => void; error?: string[] }) {
  const errorId = `${id}-error`;
  return <div className="form-field"><label htmlFor={id}>{label}</label><div className="password-input"><TextInput id={id} name={id} type={visible ? "text" : "password"} autoComplete="new-password" value={value} onChange={(event) => onChange(event.target.value)} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} required/><button className="password-toggle" type="button" onClick={onToggle} aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`} aria-pressed={visible}>{visible ? "Hide" : "Show"}</button></div>{error?.[0] && <p id={errorId} className="field-error" role="alert">{error[0]}</p>}</div>;
}
