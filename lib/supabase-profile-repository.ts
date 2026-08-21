import { getSupabaseBrowserClient, normalizeSupabaseError } from "./supabase-browser";
import { isValidEmail } from "./auth-repository";
import { isValidMobileNumber } from "./registration-repository";
import type { AgentProfile, CurrentUser, ProfileActionResult, UpdateAgentProfileInput } from "./types";
import type { AgentProfileRepository } from "./profile-repository";

function failure<T>(error: any, fieldErrors?: Record<string, string[]>): ProfileActionResult<T> { const normalized = normalizeSupabaseError(error); return { ok: false, error: { code: normalized.code === "FORBIDDEN" ? "FORBIDDEN" : normalized.code === "NOT_FOUND" ? "NOT_FOUND" : normalized.code === "DUPLICATE" ? "CONFLICT" : "INTERNAL_ERROR", message: normalized.message, ...(fieldErrors ? { fieldErrors } : {}) } }; }
function validate(input: UpdateAgentProfileInput) { const fieldErrors: Record<string, string[]> = {}; if (input.fullName.trim().length < 2) fieldErrors.fullName = ["Enter your full name."]; if (!isValidMobileNumber(input.mobileNumber)) fieldErrors.mobileNumber = ["Enter a valid Malaysian mobile number."]; if (!isValidEmail(input.email)) fieldErrors.email = ["Enter a valid email address."]; return fieldErrors; }

async function load(actor: CurrentUser): Promise<AgentProfile> {
  const supabase = getSupabaseBrowserClient(); if (!supabase) throw new Error("Supabase is not configured");
  const [{ data: profile, error: profileError }, { data: agent, error: agentError }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", actor.id).single(),
    supabase.from("agents").select("*").eq("profile_id", actor.id).maybeSingle(),
  ]); if (profileError) throw profileError; if (agentError) throw agentError;
  if (!agent) throw new Error("Your agent profile could not be found.");
  const [{ data: registration }, { data: referral, error: referralError }] = await Promise.all([
    supabase.from("agent_registrations").select("*").eq("agent_id", agent.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("referral_invitations").select("code").eq("referring_agent_id", agent.id).eq("is_active", true).order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]); if (referralError) throw referralError;
  return { id: agent.id, profile: { fullName: profile.display_name, email: actor.email ?? agent.email, mobileNumber: profile.phone ?? agent.phone ?? "" }, agentNumber: agent.agent_code, applicationNumber: registration?.application_number ?? "Not available", accountStatus: profile.account_status === "active" ? "active" : "inactive", registrationStatus: registration?.registration_status ?? (agent.is_active ? "active" : "pending_approval"), feeStatus: registration?.fee_status === "verified" ? "verified" : registration?.fee_status ?? (agent.fee_status === "paid" ? "verified" : "unpaid"), emailVerified: Boolean(actor.emailVerified), joinedDate: agent.joined_on, referralCode: referral?.code ?? "", uplineName: null, currentLevel: agent.current_level === "level_3" ? 3 : agent.current_level === "level_2" ? 2 : 1, profileComplete: Boolean(registration?.profile_complete ?? profile.display_name) };
}

export const supabaseAgentProfileRepository: AgentProfileRepository = {
  async getMine(actor) { if (actor.role !== "agent") return failure({ code: "42501", message: "Only an authenticated agent can access this profile." }); try { return { ok: true, data: await load(actor) }; } catch (error) { return failure(error); } },
  async updateMine(actor, input) { if (actor.role !== "agent") return failure({ code: "42501", message: "Only an authenticated agent can update this profile." }); const fieldErrors = validate(input); if (Object.keys(fieldErrors).length) return failure({ message: "Check the highlighted fields and try again." }, fieldErrors); const supabase = getSupabaseBrowserClient(); if (!supabase) return failure({ message: "Supabase is not configured" }); const current = await this.getMine(actor); if (!current.ok) return current; const emailChanged = input.email.trim().toLowerCase() !== current.data.profile.email.toLowerCase(); if (emailChanged) { const { error } = await supabase.auth.updateUser({ email: input.email.trim().toLowerCase() }); if (error) return failure(error); } const { error } = await supabase.from("profiles").update({ display_name: input.fullName.trim(), phone: input.mobileNumber.trim() }).eq("id", actor.id); if (error) return failure(error); return this.getMine(actor); },
  async requestEmailVerification(actor) { const current = await this.getMine(actor); if (!current.ok) return current; const supabase = getSupabaseBrowserClient(); if (!supabase) return failure({ message: "Supabase is not configured" }); const { error } = await supabase.auth.resend({ type: "signup", email: current.data.profile.email }); return error ? failure(error) : { ok: true, data: { expiresInSeconds: 600 } }; },
  async verifyEmail(actor, _code) { const current = await this.getMine(actor); if (!current.ok) return current; if (!current.data.emailVerified) return failure({ message: "Confirm the verification link sent to your email address before continuing." }, { code: ["The email confirmation is still pending."] }); return current; },
};
