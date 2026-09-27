import { createClient } from "@supabase/supabase-js";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "./supabase-browser";

export interface StaffInvitationDetails {
  displayName: string;
  email: string;
  phone: string;
  bankName: string;
  accountHolderName: string;
  accountNumber: string;
  requiresPassword: boolean;
}

export interface CompleteStaffInvitationInput extends StaffInvitationDetails {
  password: string;
  confirmation: string;
  requiresPassword: boolean;
}

type StaffInvitationResult<T> = { ok: true; data: T } | { ok: false; message: string; fieldErrors?: Record<string, string[]> };

// Admin invitation links currently return an implicit-grant session in the URL
// fragment. The app's shared SSR client is deliberately PKCE-only, so this
// isolated client consumes the invitation without weakening normal sign-in.
let invitationClient: any = null;

function getStaffInvitationClient() {
  if (!isSupabaseConfigured() || typeof window === "undefined") return null;
  if (new URLSearchParams(window.location.search).get("mode") === "recovery") return getSupabaseBrowserClient();
  if (!invitationClient) {
    invitationClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { flowType: "implicit", detectSessionInUrl: true, persistSession: true, autoRefreshToken: true } },
    );
  }
  return invitationClient;
}

export function validateStaffInvitation(input: CompleteStaffInvitationInput) {
  const fieldErrors: Record<string, string[]> = {};
  if (!input.displayName.trim()) fieldErrors.displayName = ["Enter your full name."];
  else if (input.displayName.trim().length > 160) fieldErrors.displayName = ["Use 160 characters or fewer."];
  if (!input.bankName.trim()) fieldErrors.bankName = ["Enter your bank name."];
  else if (input.bankName.trim().length > 160) fieldErrors.bankName = ["Use 160 characters or fewer."];
  if (!input.accountHolderName.trim()) fieldErrors.accountHolderName = ["Enter the account holder name."];
  else if (input.accountHolderName.trim().length > 160) fieldErrors.accountHolderName = ["Use 160 characters or fewer."];
  if (input.accountNumber.trim().length < 4) fieldErrors.accountNumber = ["Enter a valid bank account number."];
  else if (input.accountNumber.trim().length > 64) fieldErrors.accountNumber = ["Use 64 characters or fewer."];
  if (input.requiresPassword) {
    if (input.password.length < 8) fieldErrors.password = ["Use at least 8 characters."];
    if (input.password !== input.confirmation) fieldErrors.confirmation = ["Passwords do not match."];
  }
  return fieldErrors;
}

export async function loadStaffInvitation(): Promise<StaffInvitationResult<StaffInvitationDetails>> {
  const supabase = getStaffInvitationClient();
  if (!supabase) return { ok: false, message: "This invitation link requires a configured Supabase session." };
  const recovery = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("mode") === "recovery";
  const { error: initializationError } = recovery ? { error: null } : await supabase.auth.initialize();
  if (initializationError) {
    return { ok: false, message: "This invitation link is invalid or has expired." };
  }
  const { data: sessionData } = await supabase.auth.getSession();
  const user = sessionData.session?.user;
  if (!user) return { ok: false, message: "This invitation link is invalid or has expired." };
  const [{ data: profile, error }, { data: bankDetails, error: bankDetailsError }] = await Promise.all([
    supabase.from("profiles").select("display_name,phone,role,account_status").eq("id", user.id).single(),
    supabase.from("profile_bank_details").select("bank_name,account_holder_name,account_number").eq("profile_id", user.id).maybeSingle(),
  ]);
  if (error || bankDetailsError || !profile || profile.role !== "staff" || profile.account_status !== "invited") {
    return { ok: false, message: "This invitation is not available for staff onboarding." };
  }
  return { ok: true, data: { displayName: profile.display_name ?? "", email: user.email ?? "", phone: profile.phone ?? "", bankName: bankDetails?.bank_name ?? "", accountHolderName: bankDetails?.account_holder_name ?? "", accountNumber: bankDetails?.account_number ?? "", requiresPassword: !recovery } };
}

export async function completeStaffInvitation(input: CompleteStaffInvitationInput): Promise<StaffInvitationResult<true>> {
  const fieldErrors = validateStaffInvitation(input);
  if (Object.keys(fieldErrors).length) return { ok: false, message: "Check the highlighted fields and try again.", fieldErrors };
  const supabase = getStaffInvitationClient();
  if (!supabase) return { ok: false, message: "Supabase is not configured." };
  const { error } = await supabase.functions.invoke("accept-staff-invitation", { body: { display_name: input.displayName.trim(), phone: input.phone.trim() || null, password: input.requiresPassword ? input.password : undefined, recovery: !input.requiresPassword, bank_name: input.bankName.trim(), account_holder_name: input.accountHolderName.trim(), account_number: input.accountNumber.trim() } });
  if (error) {
    let message = error.message || "Unable to complete the staff invitation.";
    try {
      const payload = error.context ? await error.context.clone().json() as { error?: unknown; message?: unknown } : null;
      if (typeof payload?.error === "string") message = payload.error;
      else if (typeof payload?.message === "string") message = payload.message;
    } catch {
      // Keep the SDK message when the function response is not JSON.
    }
    return { ok: false, message };
  }
  await supabase.auth.signOut();
  return { ok: true, data: true };
}
