import { isValidEmail } from "./auth-repository";
import { isValidMobileNumber } from "./registration-repository";
import type { AgentProfile, CurrentUser, ID, ProfileActionResult, UpdateAgentProfileInput } from "./types";

const activeProfile: AgentProfile = { id: "agent-001", profile: { fullName: "Aisha Rahman", email: "aisha@smartegy.example", mobileNumber: "+60123456789" }, agentNumber: "AG-001", applicationNumber: "SMG-REG-0001", accountStatus: "active", registrationStatus: "active", feeStatus: "verified", emailVerified: true, joinedDate: "2026-05-18", referralCode: "AISHARAHMAN", uplineName: null, currentLevel: 2, profileComplete: true };
const pendingProfile: AgentProfile = { id: "registration-001", profile: { fullName: "Nadia Yusuf", email: "nadia@smartegy.example", mobileNumber: "+60123456789" }, agentNumber: "Not assigned", applicationNumber: "SMG-REG-0001", accountStatus: "inactive", registrationStatus: "pending_approval", feeStatus: "pending_verification", emailVerified: true, joinedDate: "2026-08-05", referralCode: "AISHARAHMAN", uplineName: "Aisha Rahman", currentLevel: 1, profileComplete: true };
let profiles = [activeProfile, pendingProfile];
const emailVerificationCodes = new Map<string, string>();
type ProfileErrorCode = "VALIDATION_ERROR" | "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" | "INTERNAL_ERROR";

function failure<T>(code: ProfileErrorCode, message: string, fieldErrors?: Record<string, string[]>): ProfileActionResult<T> { return { ok: false, error: { code, message, ...(fieldErrors ? { fieldErrors } : {}) } }; }
function ownedProfile(actor: CurrentUser) { const profile = profiles.find((item) => item.id === actor.agentId); if (actor.role !== "agent" || !actor.agentId) return failure<AgentProfile>("FORBIDDEN", "Only an authenticated agent can access this profile."); if (!profile) return failure<AgentProfile>("NOT_FOUND", "Your agent profile could not be found."); return { ok: true as const, data: profile }; }
function validate(input: UpdateAgentProfileInput) { const fieldErrors: Record<string, string[]> = {}; if (!input.fullName.trim() || input.fullName.trim().length < 2) fieldErrors.fullName = ["Enter your full name."]; if (!isValidMobileNumber(input.mobileNumber)) fieldErrors.mobileNumber = ["Enter a valid Malaysian mobile number."]; if (!isValidEmail(input.email)) fieldErrors.email = ["Enter a valid email address."]; return fieldErrors; }

export interface AgentProfileRepository { getMine(actor: CurrentUser): Promise<ProfileActionResult<AgentProfile>>; updateMine(actor: CurrentUser, input: UpdateAgentProfileInput & Record<string, unknown>): Promise<ProfileActionResult<AgentProfile>>; requestEmailVerification(actor: CurrentUser): Promise<ProfileActionResult<{ expiresInSeconds: number }>>; verifyEmail(actor: CurrentUser, code: string): Promise<ProfileActionResult<AgentProfile>>; }
export const mockAgentProfileRepository: AgentProfileRepository = {
  async getMine(actor) { return ownedProfile(actor); },
  async updateMine(actor, input) {
    const found = ownedProfile(actor); if (!found.ok) return found;
    const allowed = ["fullName", "mobileNumber", "email"]; if (Object.keys(input).some((key) => !allowed.includes(key))) return failure("FORBIDDEN", "Only personal contact details can be updated.");
    const fieldErrors = validate(input); if (Object.keys(fieldErrors).length) return failure("VALIDATION_ERROR", "Check the highlighted fields and try again.", fieldErrors);
    const emailChanged = input.email.trim().toLowerCase() !== found.data.profile.email.toLowerCase();
    found.data.profile = { fullName: input.fullName.trim(), mobileNumber: input.mobileNumber.trim(), email: input.email.trim().toLowerCase() };
    if (emailChanged) found.data.emailVerified = false;
    return { ok: true, data: found.data };
  },
  async requestEmailVerification(actor) {
    const found = ownedProfile(actor); if (!found.ok) return found;
    emailVerificationCodes.set(found.data.profile.email, "123456");
    return { ok: true, data: { expiresInSeconds: 600 } };
  },
  async verifyEmail(actor, code) {
    const found = ownedProfile(actor); if (!found.ok) return found;
    if (emailVerificationCodes.get(found.data.profile.email) !== code.trim()) return failure("VALIDATION_ERROR", "That verification code is invalid or has expired.", { code: ["Enter the 6-digit verification code sent to your new email address."] });
    emailVerificationCodes.delete(found.data.profile.email); found.data.emailVerified = true; return { ok: true, data: found.data };
  },
};
export function resetMockProfiles() { profiles = [structuredClone(activeProfile), structuredClone(pendingProfile)]; emailVerificationCodes.clear(); }

import { isSupabaseConfigured } from "./supabase-browser";
import { supabaseAgentProfileRepository } from "./supabase-profile-repository";
export const agentProfileRepository: AgentProfileRepository = isSupabaseConfigured() ? supabaseAgentProfileRepository : mockAgentProfileRepository;
