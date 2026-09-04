"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { AuthShell } from "./auth-shell";
import { TextInput } from "./form-controls";
import { CompleteStaffInvitationInput, completeStaffInvitation, loadStaffInvitation } from "@/lib/staff-invitation";

const emptyForm: CompleteStaffInvitationInput = { displayName: "", email: "", phone: "", password: "", confirmation: "" };
const invitationIntro = { introTitle: "Set up your Smartegy staff workspace.", introDescription: "Complete your staff profile and create secure sign-in details from your invitation." };

export function StaffInvitationPage() {
  const [state, setState] = useState<"loading" | "ready" | "invalid" | "complete">("loading");
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  useEffect(() => {
    let active = true;
    const load = async () => {
      const result = await loadStaffInvitation();
      if (!active) return;
      if (!result.ok) { setError(result.message); setState("invalid"); return; }
      setForm((current) => ({ ...current, ...result.data }));
      setState("ready");
    };
    void load();
    return () => { active = false; };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true); setError(null); setFieldErrors({});
    const result = await completeStaffInvitation(form);
    setSubmitting(false);
    if (!result.ok) { setError(result.message); setFieldErrors(result.fieldErrors ?? {}); return; }
    setState("complete");
  }

  if (state === "loading") return <AuthShell {...invitationIntro} kicker="Staff invitation" title="Preparing your account" description="Validating your invitation securely…"><div className="auth-loading" role="status">Loading…</div></AuthShell>;
  if (state === "invalid") return <AuthShell {...invitationIntro} kicker="Staff invitation" title="Invitation unavailable" description="This staff invitation cannot be completed."><div className="auth-error-panel" role="alert"><span aria-hidden="true">!</span><p>{error}</p></div><Link className="login-submit auth-action-link" href="/">Return to sign in</Link></AuthShell>;
  if (state === "complete") return <AuthShell {...invitationIntro} kicker="Staff invitation" title="Profile submitted" description="Your staff account setup is complete."><div className="auth-success-panel" role="status"><span aria-hidden="true">✓</span><p>Your account remains invited until an administrator activates it. You can sign in after activation.</p></div><Link className="login-submit auth-action-link" href="/">Return to sign in</Link></AuthShell>;

  return <AuthShell {...invitationIntro} kicker="Staff invitation" title="Set up your staff account" description="Complete your profile and create the password you will use to sign in.">
    <form className="auth-form" onSubmit={submit} noValidate>
      <InvitationField id="staff-invite-name" label="Full name" value={form.displayName} onChange={(displayName) => setForm((current) => ({ ...current, displayName }))} error={fieldErrors.displayName?.[0]} autoComplete="name"/>
      <div className="form-field"><label htmlFor="staff-invite-email">Work email</label><TextInput id="staff-invite-email" type="email" value={form.email} readOnly className="auth-readonly-input"/><p className="field-help">This email is fixed by your invitation.</p></div>
      <InvitationField id="staff-invite-phone" label="Phone number" value={form.phone} onChange={(phone) => setForm((current) => ({ ...current, phone }))} error={fieldErrors.phone?.[0]} autoComplete="tel" optional/>
      <InvitationField id="staff-invite-password" label="Create password" value={form.password} onChange={(password) => setForm((current) => ({ ...current, password }))} error={fieldErrors.password?.[0]} autoComplete="new-password" type="password"/>
      <InvitationField id="staff-invite-confirmation" label="Confirm password" value={form.confirmation} onChange={(confirmation) => setForm((current) => ({ ...current, confirmation }))} error={fieldErrors.confirmation?.[0]} autoComplete="new-password" type="password"/>
      <p className="password-requirements">Password requirements: at least 8 characters.</p>
      {error && <div className="login-message login-message-error" role="alert"><span aria-hidden="true">!</span>{error}</div>}
      <button className="login-submit" type="submit" disabled={submitting}>{submitting ? "Completing setup…" : "Complete account setup"}</button>
    </form>
  </AuthShell>;
}

function InvitationField({ id, label, value, onChange, error, autoComplete, type = "text", optional = false }: { id: string; label: string; value: string; onChange: (value: string) => void; error?: string; autoComplete: string; type?: "text" | "password"; optional?: boolean }) {
  return <div className="form-field"><label htmlFor={id}>{label}{optional && <span className="muted-cell"> (optional)</span>}</label><TextInput id={id} type={type} value={value} onChange={(event) => onChange(event.target.value)} autoComplete={autoComplete} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined}/>{error && <p id={`${id}-error`} className="field-error" role="alert">{error}</p>}</div>;
}
