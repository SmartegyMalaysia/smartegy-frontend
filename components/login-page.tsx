"use client";

import { TextInput, TextArea } from "./form-controls";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { login } from "@/lib/auth-repository";
import { Icon } from "./icons";
import { BrandLogo } from "./brand-logo";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<"info" | "error">("info");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setIsSubmitting(true);
    const result = await login({ email, password, remember });
    setMessageTone(result.ok ? "info" : "error");
    setMessage(result.message);
    setIsSubmitting(false);
  }

  return (
    <main className="login-page">
      <section className="login-intro" aria-labelledby="intro-title">
        <div className="login-intro-inner">
          <BrandLogo className="login-brand" />
          <div className="intro-copy">
            <p className="login-kicker">Operations workspace</p>
            <h1 id="intro-title">Turn energy savings into a simpler operation.</h1>
            <p>One workspace for cases, agents, payments, and commissions—from first submission to final follow-through.</p>
          </div>
          <p className="login-footnote">Built for Smartegy agents and operations teams.</p>
        </div>
      </section>

      <section className="login-form-side" aria-labelledby="login-title">
        <div className="login-card">
          <div className="login-card-heading">
            <p className="login-kicker">Welcome back</p>
            <h2 id="login-title">Sign in to Smartegy</h2>
            <p>Access your workspace securely.</p>
          </div>

          <form onSubmit={handleSubmit} noValidate>
            <div className="form-field">
              <label htmlFor="email">Work email</label>
              <TextInput id="email" name="email" type="email" autoComplete="email" placeholder="you@company.com" value={email} onChange={(event) => setEmail(event.target.value)} required />
            </div>
            <div className="form-field">
              <div className="field-label-row"><label htmlFor="password">Password</label><Link className="text-button" href="/forgot-password">Forgot password?</Link></div>
              <div className="password-input"><TextInput id="password" name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder="Enter your password" value={password} onChange={(event) => setPassword(event.target.value)} required /><button className="password-toggle" type="button" aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} onClick={() => setShowPassword((visible) => !visible)}>{showPassword ? "Hide" : "Show"}</button></div>
            </div>
            <label className="remember-row"><TextInput type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} /><span>Keep me signed in on this device</span></label>
            {message && <div className={`login-message login-message-${messageTone}`} role="status"><span aria-hidden="true">{messageTone === "error" ? "!" : "i"}</span>{message}</div>}
            <button className="login-submit" type="submit" disabled={isSubmitting}>{isSubmitting ? <><span className="button-spinner" aria-hidden="true" />Signing in…</> : <>Sign in <Icon name="arrow" size={16} /></>}</button>
          </form>

          <div className="login-divider"><span>Need an account?</span></div>
          <p className="login-support">Create your Smartegy account to start managing cases, agents, and commissions.</p>
          <Link className="auth-link" href="/signup">Sign up for Smartegy <Icon name="arrow" size={14} /></Link>
          <Link className="preview-link" href="/dashboard">Open development preview <Icon name="arrow" size={14} /></Link>
        </div>
        <p className="login-legal">© 2026 Smartegy · Your operational workspace</p>
      </section>
    </main>
  );
}
