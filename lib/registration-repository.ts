import type {
  AgentRegistration,
  CompleteRegistrationProfileInput,
  CreateRegistrationInput,
  CurrentUser,
  ID,
  ReferralInvitation,
  RegistrationActionResult,
  RegistrationDecisionInput,
  RegistrationFeeStatus,
  RegistrationPaymentConfig,
  RegistrationPaymentProof,
  RegistrationStatus,
  RejectRegistrationFeeInput,
  SubmitRegistrationFeeInput,
  VerifyRegistrationFeeInput,
} from "./types";

const now = () => new Date().toISOString();
const id = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
export function isValidMobileNumber(value: string) { return /^(?:\+?6?01)[0-9]{7,9}$/.test(value.replace(/[\s-]/g, "")); }

export const mockRegistrationConfig: RegistrationPaymentConfig = {
  feeAmountSen: 5000,
  bankName: "Smartegy Operations Account (mock)",
  accountName: "Smartegy Sdn. Bhd.",
  accountNumber: "CONFIGURE-BEFORE-PRODUCTION",
  duitNowQrAvailable: false,
};

const invitations: ReferralInvitation[] = [
  { id: "invite-001", code: "AISHARAHMAN", referringAgentId: "agent-001", referringAgentName: "Aisha Rahman", expiresAt: null, valid: true },
  { id: "invite-002", code: "DANIEL2026", referringAgentId: "agent-002", referringAgentName: "Daniel Lim", expiresAt: "2026-12-31T23:59:59Z", valid: true },
];

const seedRegistration: AgentRegistration = {
  id: "registration-001",
  applicationNumber: "SMG-REG-0001",
  profile: { fullName: "Nadia Yusuf", email: "nadia@smartegy.example", mobileNumber: "+60123456789" },
  referralCode: "AISHARAHMAN",
  referringAgentId: "agent-001",
  referringAgentName: "Aisha Rahman",
  registrationStatus: "pending_approval",
  feeStatus: "pending_verification",
  emailVerified: true,
  profileComplete: true,
  acceptedTermsAt: "2026-08-05T08:30:00Z",
  invoice: { invoiceNumber: "SMG-INV-0001", amountSen: mockRegistrationConfig.feeAmountSen, description: "Non-refundable RM50 name-card fee", issueDate: "2026-08-05", status: "issued" },
  feeAmountSen: mockRegistrationConfig.feeAmountSen,
  paymentDate: "2026-08-05",
  paymentReference: "SMG-REG-0001",
  paymentRemarks: null,
  verifiedAmountSen: null,
  verifiedPaymentDate: null,
  bankReference: null,
  proof: { id: "proof-001", fileName: "nadia-transfer.png", mimeType: "image/png", sizeBytes: 182400, uploadedAt: "2026-08-05T08:35:00Z" },
  rejectionReason: null,
  submittedAt: "2026-08-05T08:35:00Z",
  createdAt: "2026-08-05T08:30:00Z",
  updatedAt: "2026-08-05T08:35:00Z",
  audit: [],
};

let registrations: AgentRegistration[] = [seedRegistration];
const mockOtpByEmail = new Map<string, string>();

function failure<T>(code: "VALIDATION_ERROR" | "FORBIDDEN" | "NOT_FOUND" | "CONFLICT", message: string, fieldErrors?: Record<string, string[]>): RegistrationActionResult<T> {
  return { ok: false, error: { code, message, ...(fieldErrors ? { fieldErrors } : {}) } };
}

function staffOnly<T>(actor: CurrentUser): RegistrationActionResult<T> {
  return actor.role === "staff" || actor.role === "admin"
    ? ({ ok: true, data: undefined as T })
    : failure("FORBIDDEN", "Only authorised staff can perform this registration action.");
}

function getOwnedRegistration(actor: CurrentUser, registrationId: ID) {
  const registration = registrations.find((item) => item.id === registrationId);
  if (!registration) return failure<AgentRegistration>("NOT_FOUND", "Registration application not found.");
  if (actor.role === "agent" && actor.agentId !== registration.id) return failure<AgentRegistration>("FORBIDDEN", "You can only access your own onboarding application.");
  return { ok: true as const, data: registration };
}

function addAudit(registration: AgentRegistration, actor: CurrentUser, entityType: "registration" | "registration_fee", action: string, previousStatus: RegistrationStatus | RegistrationFeeStatus | null, newStatus: RegistrationStatus | RegistrationFeeStatus | null, reason: string | null = null) {
  registration.audit.unshift({ id: id("audit"), entityType, entityId: registration.id, action, previousStatus, newStatus, actorId: actor.id, actorDisplayName: actor.displayName, occurredAt: now(), reason });
  registration.updatedAt = now();
}

export interface RegistrationRepository {
  getInvitation(code: string): Promise<RegistrationActionResult<ReferralInvitation>>;
  sendEmailOtp(email: string): Promise<RegistrationActionResult<{ expiresInSeconds: number }>>;
  verifyEmailOtp(email: string, otp: string): Promise<RegistrationActionResult<true>>;
  createApplication(input: CreateRegistrationInput): Promise<RegistrationActionResult<AgentRegistration>>;
  getRegistration(actor: CurrentUser, registrationId: ID): Promise<RegistrationActionResult<AgentRegistration>>;
  verifyEmail(actor: CurrentUser, registrationId: ID): Promise<RegistrationActionResult<AgentRegistration>>;
  completeProfile(actor: CurrentUser, registrationId: ID, input: CompleteRegistrationProfileInput): Promise<RegistrationActionResult<AgentRegistration>>;
  submitFee(actor: CurrentUser, input: SubmitRegistrationFeeInput): Promise<RegistrationActionResult<AgentRegistration>>;
  listForStaff(actor: CurrentUser): Promise<RegistrationActionResult<AgentRegistration[]>>;
  verifyFee(actor: CurrentUser, input: VerifyRegistrationFeeInput): Promise<RegistrationActionResult<AgentRegistration>>;
  rejectFee(actor: CurrentUser, input: RejectRegistrationFeeInput): Promise<RegistrationActionResult<AgentRegistration>>;
  approveRegistration(actor: CurrentUser, input: RegistrationDecisionInput): Promise<RegistrationActionResult<AgentRegistration>>;
  rejectRegistration(actor: CurrentUser, input: RegistrationDecisionInput): Promise<RegistrationActionResult<AgentRegistration>>;
  assertActiveAgent(actor: CurrentUser, registrationId: ID): Promise<RegistrationActionResult<AgentRegistration>>;
}

export const registrationRepository: RegistrationRepository = {
  async getInvitation(code) {
    const invitation = invitations.find((item) => item.code.toLowerCase() === code.trim().toLowerCase() && item.valid);
    return invitation ? { ok: true, data: invitation } : failure("NOT_FOUND", "This invitation or referral link is invalid or has expired.");
  },

  async sendEmailOtp(email) {
    if (!email.trim().includes("@")) return failure("VALIDATION_ERROR", "Enter a valid email address.", { email: ["Enter a valid email address."] });
    mockOtpByEmail.set(email.trim().toLowerCase(), "123456");
    return { ok: true, data: { expiresInSeconds: 600 } };
  },

  async verifyEmailOtp(email, otp) {
    const normalizedEmail = email.trim().toLowerCase();
    if (mockOtpByEmail.get(normalizedEmail) !== otp.trim()) return failure("VALIDATION_ERROR", "That OTP is invalid or has expired.", { otp: ["Enter the 6-digit mock OTP shown above."] });
    mockOtpByEmail.delete(normalizedEmail);
    return { ok: true, data: true };
  },

  async createApplication(input) {
    const invitation = invitations.find((item) => item.code.toLowerCase() === input.referralCode.trim().toLowerCase() && item.valid);
    const fieldErrors: Record<string, string[]> = {};
    if (!input.fullName.trim()) fieldErrors.fullName = ["Enter your full name."];
    if (!input.email.includes("@")) fieldErrors.email = ["Enter a valid email address."];
    if (!input.mobileNumber.trim()) fieldErrors.mobileNumber = ["Enter your mobile number."];
    else if (!isValidMobileNumber(input.mobileNumber)) fieldErrors.mobileNumber = ["Enter a valid mobile number, for example 012345678."];
    if (input.password.length < 8) fieldErrors.password = ["Use at least 8 characters."];
    if (input.password !== input.passwordConfirmation) fieldErrors.passwordConfirmation = ["Passwords must match."];
    if (!input.acceptedTerms) fieldErrors.acceptedTerms = ["Accept the Terms of Use and Privacy Notice to continue."];
    if (!invitation) return failure("VALIDATION_ERROR", "Check the invitation or referral code and try again.", { ...fieldErrors, referralCode: ["This invitation or referral code is invalid or expired."] });
    if (Object.keys(fieldErrors).length) return failure("VALIDATION_ERROR", "Check the highlighted fields and try again.", fieldErrors);
    const timestamp = now();
    const registration: AgentRegistration = {
      id: id("registration"),
      applicationNumber: `SMG-REG-${String(registrations.length + 1).padStart(4, "0")}`,
      profile: { fullName: input.fullName.trim(), email: input.email.trim().toLowerCase(), mobileNumber: input.mobileNumber.trim() },
      referralCode: invitation.code,
      referringAgentId: invitation.referringAgentId,
      referringAgentName: invitation.referringAgentName,
      registrationStatus: "draft",
      feeStatus: "unpaid",
      emailVerified: false,
      profileComplete: true,
      acceptedTermsAt: timestamp,
      invoice: { invoiceNumber: `SMG-INV-${String(registrations.length + 1).padStart(4, "0")}`, amountSen: mockRegistrationConfig.feeAmountSen, description: "Non-refundable RM50 name-card fee", issueDate: timestamp.slice(0, 10), status: "issued" },
      feeAmountSen: mockRegistrationConfig.feeAmountSen,
      paymentDate: null,
      paymentReference: null,
      paymentRemarks: null,
      verifiedAmountSen: null,
      verifiedPaymentDate: null,
      bankReference: null,
      proof: null,
      rejectionReason: null,
      submittedAt: null,
      createdAt: timestamp,
      updatedAt: timestamp,
      audit: [],
    };
    registrations = [registration, ...registrations];
    return { ok: true, data: registration };
  },

  async getRegistration(actor, registrationId) { return getOwnedRegistration(actor, registrationId); },

  async verifyEmail(actor, registrationId) {
    const found = getOwnedRegistration(actor, registrationId);
    if (!found.ok) return found;
    if (actor.role !== "agent") return failure("FORBIDDEN", "Only the applicant can verify this email.");
    found.data.emailVerified = true;
    addAudit(found.data, actor, "registration", "email_verified", found.data.registrationStatus, found.data.registrationStatus);
    return { ok: true, data: found.data };
  },

  async completeProfile(actor, registrationId, input) {
    const found = getOwnedRegistration(actor, registrationId);
    if (!found.ok) return found;
    if (actor.role !== "agent") return failure("FORBIDDEN", "Only the applicant can complete this profile.");
    if (!input.fullName.trim() || !input.mobileNumber.trim()) return failure("VALIDATION_ERROR", "Complete the required profile fields.", { fullName: !input.fullName.trim() ? ["Enter your full name."] : [], mobileNumber: !input.mobileNumber.trim() ? ["Enter your mobile number."] : [] });
    found.data.profile = { ...input, fullName: input.fullName.trim(), mobileNumber: input.mobileNumber.trim(), email: found.data.profile.email };
    found.data.profileComplete = true;
    addAudit(found.data, actor, "registration", "profile_completed", found.data.registrationStatus, found.data.registrationStatus);
    return { ok: true, data: found.data };
  },

  async submitFee(actor, input) {
    const found = getOwnedRegistration(actor, input.registrationId);
    if (!found.ok) return found;
    if (actor.role !== "agent") return failure("FORBIDDEN", "Only the applicant can submit payment proof.");
    if (!["unpaid", "rejected"].includes(found.data.feeStatus)) return failure("CONFLICT", "Payment proof can only be submitted when the fee is unpaid or rejected.");
    if (!input.proof.fileName) return failure("VALIDATION_ERROR", "Upload proof of payment before submitting.");
    const previous = found.data.feeStatus;
    found.data.paymentDate = input.paymentDate;
    found.data.paymentReference = input.paymentReference?.trim() || null;
    found.data.paymentRemarks = input.paymentRemarks?.trim() || null;
    found.data.proof = { ...input.proof, id: id("proof"), uploadedAt: now() };
    found.data.feeStatus = "pending_verification";
    found.data.rejectionReason = null;
    found.data.registrationStatus = "pending_approval";
    found.data.submittedAt = now();
    addAudit(found.data, actor, "registration_fee", "payment_submitted", previous, "pending_verification");
    return { ok: true, data: found.data };
  },

  async listForStaff(actor) {
    const allowed = staffOnly<AgentRegistration[]>(actor);
    return allowed.ok ? { ok: true, data: registrations } : allowed;
  },

  async verifyFee(actor, input) {
    const allowed = staffOnly<AgentRegistration>(actor);
    if (!allowed.ok) return allowed;
    const found = getOwnedRegistration({ ...actor, role: "staff" }, input.registrationId);
    if (!found.ok) return found;
    if (input.verifiedAmountSen !== mockRegistrationConfig.feeAmountSen) return failure("VALIDATION_ERROR", "The verified amount must be exactly RM50.00.", { verifiedAmountSen: ["Enter RM50.00 to verify this registration fee."] });
    if (!input.paymentDate || !input.bankReference.trim()) return failure("VALIDATION_ERROR", "Payment date and bank reference are required.");
    const previous = found.data.feeStatus;
    found.data.feeStatus = "verified";
    found.data.verifiedAmountSen = input.verifiedAmountSen;
    found.data.verifiedPaymentDate = input.paymentDate;
    found.data.bankReference = input.bankReference.trim();
    found.data.rejectionReason = null;
    addAudit(found.data, actor, "registration_fee", "payment_verified", previous, "verified", input.note ?? null);
    return { ok: true, data: found.data };
  },

  async rejectFee(actor, input) {
    const allowed = staffOnly<AgentRegistration>(actor);
    if (!allowed.ok) return allowed;
    const found = getOwnedRegistration({ ...actor, role: "staff" }, input.registrationId);
    if (!found.ok) return found;
    if (!input.reason.trim()) return failure("VALIDATION_ERROR", "A rejection reason is required.");
    const previous = found.data.feeStatus;
    found.data.feeStatus = "rejected";
    found.data.rejectionReason = input.reason.trim();
    addAudit(found.data, actor, "registration_fee", "payment_rejected", previous, "rejected", input.reason.trim());
    return { ok: true, data: found.data };
  },

  async approveRegistration(actor, input) {
    const allowed = staffOnly<AgentRegistration>(actor);
    if (!allowed.ok) return allowed;
    const found = getOwnedRegistration({ ...actor, role: "staff" }, input.registrationId);
    if (!found.ok) return found;
    if (found.data.registrationStatus !== "pending_approval") return failure("CONFLICT", "Only pending registrations can be approved.");
    if (!found.data.emailVerified || !found.data.profileComplete || !["verified", "waived"].includes(found.data.feeStatus)) return failure("CONFLICT", "The application cannot be activated until email, profile, and fee requirements are complete.");
    const previous = found.data.registrationStatus;
    found.data.registrationStatus = "active";
    addAudit(found.data, actor, "registration", "registration_approved_and_activated", previous, "active", input.reason?.trim() || null);
    return { ok: true, data: found.data };
  },

  async rejectRegistration(actor, input) {
    const allowed = staffOnly<AgentRegistration>(actor);
    if (!allowed.ok) return allowed;
    const found = getOwnedRegistration({ ...actor, role: "staff" }, input.registrationId);
    if (!found.ok) return found;
    if (!input.reason?.trim()) return failure("VALIDATION_ERROR", "A rejection reason is required.");
    const previous = found.data.registrationStatus;
    found.data.registrationStatus = "rejected";
    addAudit(found.data, actor, "registration", "registration_rejected", previous, "rejected", input.reason.trim());
    return { ok: true, data: found.data };
  },

  async assertActiveAgent(actor, registrationId) {
    const found = getOwnedRegistration(actor, registrationId);
    if (!found.ok) return found;
    if (actor.role !== "agent" || found.data.registrationStatus !== "active") return failure("FORBIDDEN", "Your account is awaiting registration approval. Only onboarding and registration status are available.");
    return found;
  },
};

export function resetMockRegistrations() { registrations = [seedRegistration]; mockOtpByEmail.clear(); }
