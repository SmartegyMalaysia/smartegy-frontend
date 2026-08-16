import { clearDeveloperView, getSupabaseBrowserClient, normalizeSupabaseError } from "./supabase-browser";

export interface LoginInput {
  email: string;
  password: string;
  remember: boolean;
}

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_RESET_COOLDOWN_SECONDS = 30;
const PASSWORD_RESET_LIFETIME_MS = 15 * 60 * 1000;
const neutralResetMessage = "If an account exists for this email address, we have sent password-reset instructions.";

export type PasswordResetResult =
  | { ok: true; message: string; resetPath: string; cooldownSeconds: number }
  | { ok: false; code: "INVALID_INPUT" | "RATE_LIMITED" | "NETWORK_ERROR"; message: string; fieldErrors?: Record<string, string[]>; cooldownSeconds?: number };

export type ResetLinkState = "ready" | "invalid" | "expired" | "used";
export type PasswordUpdateResult =
  | { ok: true; message: string }
  | { ok: false; code: "INVALID_INPUT" | "INVALID_LINK" | "EXPIRED_LINK" | "USED_LINK"; message: string; fieldErrors?: Record<string, string[]> };

interface MockResetSession { status: "ready" | "used"; requestedAt: number; expiresAt: number; }
let mockResetSession: MockResetSession | null = null;

export function isValidEmail(email: string) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()); }

export function getMockResetLinkState(token: string): ResetLinkState {
  if (getSupabaseBrowserClient()) return "ready";
  if (token !== "mock-valid" || !mockResetSession) return "invalid";
  if (mockResetSession.status === "used") return "used";
  if (Date.now() >= mockResetSession.expiresAt) return "expired";
  return "ready";
}

export async function requestPasswordReset(email: string): Promise<PasswordResetResult> {
  if (!isValidEmail(email)) return { ok: false, code: "INVALID_INPUT", message: "Enter a valid email address.", fieldErrors: { email: ["Enter a valid email address."] } };
  const supabase = getSupabaseBrowserClient();
  if (supabase) {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/reset-password` });
    if (error) return { ok: false, code: "NETWORK_ERROR", message: normalizeSupabaseError(error).message };
    return { ok: true, message: neutralResetMessage, resetPath: "/reset-password", cooldownSeconds: PASSWORD_RESET_COOLDOWN_SECONDS };
  }
  const now = Date.now();
  const remaining = mockResetSession ? Math.ceil((PASSWORD_RESET_COOLDOWN_SECONDS * 1000 - (now - mockResetSession.requestedAt)) / 1000) : 0;
  if (remaining > 0) return { ok: true, message: neutralResetMessage, resetPath: "/reset-password?mock=valid", cooldownSeconds: remaining };
  mockResetSession = { status: "ready", requestedAt: now, expiresAt: now + PASSWORD_RESET_LIFETIME_MS };
  return { ok: true, message: neutralResetMessage, resetPath: "/reset-password?mock=valid", cooldownSeconds: PASSWORD_RESET_COOLDOWN_SECONDS };
}

export function getPasswordResetCooldownSeconds() {
  if (!mockResetSession) return 0;
  return Math.max(0, Math.ceil((PASSWORD_RESET_COOLDOWN_SECONDS * 1000 - (Date.now() - mockResetSession.requestedAt)) / 1000));
}

export async function resetPassword(token: string, password: string, confirmation: string): Promise<PasswordUpdateResult> {
  const linkState = getMockResetLinkState(token);
  if (linkState === "invalid") return { ok: false, code: "INVALID_LINK", message: "This password-reset link is invalid. Request a new link to continue." };
  if (linkState === "expired") return { ok: false, code: "EXPIRED_LINK", message: "This password-reset link has expired. Request a new link to continue." };
  if (linkState === "used") return { ok: false, code: "USED_LINK", message: "This password-reset link has already been used. Request a new link to continue." };
  const fieldErrors: Record<string, string[]> = {};
  if (password.length < PASSWORD_MIN_LENGTH) fieldErrors.password = [`Use at least ${PASSWORD_MIN_LENGTH} characters.`];
  if (password !== confirmation) fieldErrors.confirmation = ["Passwords do not match."];
  if (Object.keys(fieldErrors).length) return { ok: false, code: "INVALID_INPUT", message: "Check the highlighted fields and try again.", fieldErrors };
  const supabase = getSupabaseBrowserClient();
  if (supabase) {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return { ok: false, code: "INVALID_LINK", message: normalizeSupabaseError(error).message };
    return { ok: true, message: "Your password has been changed successfully." };
  }
  if (mockResetSession) mockResetSession.status = "used";
  return { ok: true, message: "Your password has been changed successfully." };
}

export function resetMockPasswordState() { mockResetSession = null; }
export function expireMockPasswordResetForTest() { if (mockResetSession) mockResetSession.expiresAt = Date.now() - 1; }

export type AuthResult =
  | { ok: true; message: string }
  | { ok: false; code: "NOT_CONFIGURED" | "INVALID_INPUT" | "AUTHENTICATION_FAILED" | "NETWORK_ERROR"; message: string };

/** Sign in through the server route so the Supabase session is written to SSR cookies. */
export async function login(input: LoginInput): Promise<AuthResult> {
  if (!input.email || !input.password) {
    return { ok: false, code: "INVALID_INPUT", message: "Enter your email and password to continue." };
  }

  try {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(input),
    });
    const result = (await response.json()) as AuthResult;
    if (result.ok) clearDeveloperView();
    return result;
  } catch {
    return { ok: false, code: "NETWORK_ERROR", message: "We couldn’t reach the sign-in service. Try again shortly." };
  }
}

export async function logout() {
  const supabase = getSupabaseBrowserClient();
  if (supabase) await supabase.auth.signOut();
}
