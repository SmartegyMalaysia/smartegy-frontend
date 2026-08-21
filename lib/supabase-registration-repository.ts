import { getSupabaseBrowserClient, normalizeSupabaseError } from "./supabase-browser";
import type { RegistrationRepository } from "./registration-repository";
import type {
  AgentRegistration, CompleteRegistrationProfileInput, CreateRegistrationInput, CurrentUser, ID,
  ReferralInvitation, RegistrationActionResult, RegistrationDecisionInput, RegistrationPaymentConfig, RegistrationPaymentProofAccess,
  RegistrationQueueQuery, RegistrationPaymentProof, SubmitRegistrationFeeInput,
  VerifyRegistrationFeeInput, RejectRegistrationFeeInput,
} from "./types";

type RegistrationRow = Record<string, any>;
function firstRow(value: unknown): RegistrationRow {
  return (Array.isArray(value) ? value[0] : value) as RegistrationRow;
}

function errorResult<T>(error: { code?: string | null; message?: string | null }): RegistrationActionResult<T> {
  const normalized = normalizeSupabaseError(error);
  return { ok: false, error: { code: normalized.code as any, message: normalized.message } };
}

function mapRegistration(row: RegistrationRow, proof?: RegistrationRow | null, audit: RegistrationRow[] = []): AgentRegistration {
  return {
    id: row.id,
    applicationNumber: row.application_number,
    profile: { fullName: row.full_name, email: row.email, mobileNumber: row.mobile_number },
    referralCode: row.referral_code,
    referringAgentId: row.referring_agent_id,
    referringAgentName: row.referring_agent?.legal_name ?? row.referring_agent_name ?? "",
    registrationStatus: row.registration_status,
    feeStatus: row.fee_status,
    emailVerified: row.email_verified,
    profileComplete: row.profile_complete,
    acceptedTermsAt: row.created_at,
    invoice: { invoiceNumber: row.invoice_number, amountSen: Math.round(Number(row.fee_amount) * 100), description: "Non-refundable RM50 name-card fee", issueDate: row.created_at.slice(0, 10), status: "issued" },
    feeAmountSen: Math.round(Number(row.fee_amount) * 100),
    paymentDate: row.payment_date,
    paymentReference: row.payment_reference,
    paymentRemarks: row.payment_remarks,
    verifiedAmountSen: row.verified_amount == null ? null : Math.round(Number(row.verified_amount) * 100),
    verifiedPaymentDate: row.verified_payment_date,
    bankReference: row.bank_reference,
    proof: proof ? { id: proof.id, fileName: proof.original_filename, mimeType: proof.mime_type, sizeBytes: Number(proof.size_bytes ?? 0), uploadedAt: proof.uploaded_at ?? proof.created_at } : null,
    rejectionReason: row.rejection_reason,
    submittedAt: row.submitted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    audit: audit.map((event) => ({ id: String(event.id), entityType: event.table_name === "agent_registrations" ? "registration" : "registration_fee", entityId: event.record_id, action: event.action, previousStatus: event.old_data?.registration_status ?? event.old_data?.fee_status ?? null, newStatus: event.new_data?.registration_status ?? event.new_data?.fee_status ?? null, actorId: event.actor_id ?? "system", actorDisplayName: event.actor?.display_name ?? "System", occurredAt: event.occurred_at, reason: event.reason })),
  };
}

async function fetchRegistration(id: string, includeAudit = true) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error("Supabase is not configured");
  const { data: row, error } = await supabase.from("agent_registrations").select("*,referring_agent:agents!agent_registrations_referring_agent_id_fkey(legal_name)").eq("id", id).single();
  if (error) throw error;
  const { data: proof } = await supabase.from("registration_documents").select("*").eq("id", row.payment_proof_document_id).maybeSingle();
  // audit_log.actor_id is intentionally not a foreign key (deleted users must
  // not delete audit history), so resolve the actor name separately only when
  // a future screen needs it. The audit row remains available to admins.
  const { data: audit } = includeAudit ? await supabase.from("audit_log").select("*").eq("table_name", "agent_registrations").eq("record_id", id).order("occurred_at", { ascending: false }) : { data: [] };
  return mapRegistration(row, proof, audit ?? []);
}

export const supabaseRegistrationRepository: RegistrationRepository = {
  async getPaymentConfig() {
    const supabase = getSupabaseBrowserClient(); if (!supabase) return errorResult({ message: "Supabase is not configured" });
    const { data, error } = await supabase.rpc("get_registration_payment_config");
    if (error) return errorResult(error);
    const row = (data as RegistrationRow[] | null)?.[0];
    return row ? { ok: true, data: { feeAmountSen: Math.round(Number(row.fee_amount) * 100), bankName: row.bank_name ?? "", accountName: row.account_name ?? "", accountNumber: row.account_number ?? "", duitNowQrAvailable: Boolean(row.duitnow_qr_available) } as RegistrationPaymentConfig } : errorResult({ message: "Registration payment instructions are not configured." });
  },
  async getInvitation(code) {
    const supabase = getSupabaseBrowserClient(); if (!supabase) return errorResult({ message: "Supabase is not configured" });
    const { data, error } = await supabase.rpc("get_registration_invitation", { p_code: code });
    if (error) return errorResult(error);
    const row = (data as RegistrationRow[] | null)?.[0];
    return row ? { ok: true, data: { id: row.id, code: row.code, referringAgentId: row.referring_agent_id, referringAgentName: row.referring_agent_name, expiresAt: row.expires_at, valid: row.valid } } : errorResult({ message: "This invitation or referral link is invalid or has expired." });
  },
  async sendEmailOtp(email) {
    const supabase = getSupabaseBrowserClient(); if (!supabase) return errorResult({ message: "Supabase is not configured" });
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: true } });
    return error ? errorResult(error) : { ok: true, data: { expiresInSeconds: 600 } };
  },
  async verifyEmailOtp(email, otp) {
    const supabase = getSupabaseBrowserClient(); if (!supabase) return errorResult({ message: "Supabase is not configured" });
    const { data, error } = await supabase.auth.verifyOtp({ email: email.trim(), token: otp.trim(), type: "email" });
    if (error || !data.user) return errorResult(error ?? { message: "The email verification code is invalid or expired." });
    return { ok: true, data: true };
  },
  async createApplication(input) {
    const supabase = getSupabaseBrowserClient(); if (!supabase) return errorResult({ message: "Supabase is not configured" });
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
    if (claimsError || !claimsData?.claims?.sub) return errorResult(claimsError ?? { message: "Verify your email before creating the registration." });
    const { error: passwordError } = await supabase.auth.updateUser({ password: input.password, data: { display_name: input.fullName.trim(), mobile_number: input.mobileNumber.trim() } });
    if (passwordError) return errorResult(passwordError);
    const { data, error } = await supabase.rpc("create_registration", { p_invitation_code: input.referralCode, p_full_name: input.fullName, p_mobile_number: input.mobileNumber });
    if (error) return errorResult(error);
    return { ok: true, data: mapRegistration(firstRow(data)) };
  },
  async getRegistration(_actor, registrationId) { try { return { ok: true, data: await fetchRegistration(registrationId) }; } catch (error) { return errorResult(error as any); } },
  async verifyEmail(_actor, registrationId) {
    const supabase = getSupabaseBrowserClient(); if (!supabase) return errorResult({ message: "Supabase is not configured" });
    const { data, error } = await supabase.rpc("mark_registration_email_verified", { p_registration_id: registrationId });
    return error ? errorResult(error) : { ok: true, data: mapRegistration(firstRow(data)) };
  },
  async completeProfile(_actor, registrationId, input: CompleteRegistrationProfileInput) {
    const supabase = getSupabaseBrowserClient(); if (!supabase) return errorResult({ message: "Supabase is not configured" });
    const { data, error } = await supabase.rpc("complete_registration_profile", { p_registration_id: registrationId, p_full_name: input.fullName, p_mobile_number: input.mobileNumber });
    return error ? errorResult(error) : { ok: true, data: mapRegistration(firstRow(data)) };
  },
  async submitFee(_actor, input: SubmitRegistrationFeeInput) {
    const supabase = getSupabaseBrowserClient(); if (!supabase) return errorResult({ message: "Supabase is not configured" });
    const { data: registration, error: registrationError } = await supabase.rpc("register_registration_document", { p_registration_id: input.registrationId, p_original_filename: input.proof.fileName, p_mime_type: input.proof.mimeType });
    if (registrationError) return errorResult(registrationError);
    const document = firstRow(registration);
    const file = input.proof.file;
    if (!file) return errorResult({ message: "The payment proof file is required." });
    const { error: uploadError } = await supabase.storage.from(document.bucket_id).upload(document.object_path, file, { contentType: input.proof.mimeType, upsert: false });
    if (uploadError) return errorResult(uploadError);
    const { error: finalizeError } = await supabase.rpc("finalize_registration_document", { p_document_id: document.document_id, p_size_bytes: input.proof.sizeBytes });
    if (finalizeError) return errorResult(finalizeError);
    const { data, error } = await supabase.rpc("submit_registration_fee", { p_registration_id: input.registrationId, p_payment_date: input.paymentDate, p_payment_reference: input.paymentReference, p_payment_remarks: input.paymentRemarks ?? null, p_proof_document_id: document.document_id });
    return error ? errorResult(error) : { ok: true, data: mapRegistration(firstRow(data)) };
  },
  async listForStaff(_actor, query = {}) {
    const supabase = getSupabaseBrowserClient(); if (!supabase) return errorResult({ message: "Supabase is not configured" });
    const { data, error } = await supabase.rpc("list_registration_directory", { p_search: query.search?.trim() || null, p_registration_status: query.registrationStatus && query.registrationStatus !== "all" ? query.registrationStatus : null, p_fee_status: query.feeStatus && query.feeStatus !== "all" ? query.feeStatus : null, p_profile_complete: query.profileComplete && query.profileComplete !== "all" ? query.profileComplete : null, p_email_verified: query.emailVerified && query.emailVerified !== "all" ? query.emailVerified : null, p_submitted_from: query.submittedFrom || null, p_submitted_to: query.submittedTo || null, p_page: 1, p_page_size: 10000, p_sort_by: query.sort === "oldest" ? "oldest" : query.sort === "recently_updated" ? "recently_updated" : query.sort === "newest" ? "newest" : "priority", p_sort_direction: "desc" });
    if (error) return errorResult(error);
    const payload = data as Record<string, any>;
    return { ok: true, data: ((payload.items ?? []) as RegistrationRow[]).map((row) => mapRegistration(row)) };
  },
  async exportForStaff(_actor, query = {}) {
    const params = new URLSearchParams(); if (query.search) params.set("search", query.search); if (query.registrationStatus && query.registrationStatus !== "all") params.set("registration_status", query.registrationStatus); if (query.feeStatus && query.feeStatus !== "all") params.set("fee_status", query.feeStatus); if (query.profileComplete && query.profileComplete !== "all") params.set("profile_complete", query.profileComplete); if (query.emailVerified && query.emailVerified !== "all") params.set("email_verified", query.emailVerified); if (query.submittedFrom) params.set("submitted_from", query.submittedFrom); if (query.submittedTo) params.set("submitted_to", query.submittedTo); if (query.sort) params.set("sort_by", query.sort);
    try { const response = await fetch(`/api/exports/registrations?${params.toString()}`, { credentials: "same-origin" }); if (!response.ok) return errorResult({ code: response.status === 403 ? "42501" : "PGRST000", message: "Unable to export registrations." }); const blob = await response.blob(); const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = "smartegy-registrations.csv"; link.click(); URL.revokeObjectURL(link.href); return { ok: true, data: true }; } catch (error) { return errorResult(error as any); }
  },
  async getByApplicationNumber(_actor, applicationNumber) {
    const supabase = getSupabaseBrowserClient(); if (!supabase) return errorResult({ message: "Supabase is not configured" });
    const { data, error } = await supabase.from("agent_registrations").select("id").eq("application_number", applicationNumber).single();
    if (error) return errorResult(error);
    try { return { ok: true, data: await fetchRegistration(data.id) }; } catch (fetchError) { return errorResult(fetchError as any); }
  },
  async getPaymentProof(_actor, registrationId): Promise<RegistrationActionResult<RegistrationPaymentProofAccess>> {
    const supabase = getSupabaseBrowserClient(); if (!supabase) return errorResult({ message: "Supabase is not configured" });
    const { data: registration, error: registrationError } = await supabase.from("agent_registrations").select("payment_proof_document_id").eq("id", registrationId).single();
    if (registrationError || !registration.payment_proof_document_id) return errorResult(registrationError ?? { message: "No payment proof has been uploaded." });
    const { data: document, error: documentError } = await supabase.from("registration_documents").select("*").eq("id", registration.payment_proof_document_id).single();
    if (documentError) return errorResult(documentError);
    const { data: signed, error: signedError } = await supabase.storage.from(document.bucket_id).createSignedUrl(document.object_path, 300);
    if (signedError || !signed.signedUrl) return errorResult(signedError ?? { message: "The payment proof could not be opened." });
    return { ok: true, data: { fileName: document.original_filename, mimeType: document.mime_type, accessToken: signed.signedUrl, expiresAt: new Date(Date.now() + 300000).toISOString() } };
  },
  async verifyFee(_actor, input: VerifyRegistrationFeeInput) { const supabase = getSupabaseBrowserClient(); if (!supabase) return errorResult({ message: "Supabase is not configured" }); const { data, error } = await supabase.rpc("verify_registration_fee", { p_registration_id: input.registrationId, p_verified_amount: input.verifiedAmountSen / 100, p_verified_payment_date: input.paymentDate, p_bank_reference: input.bankReference, p_note: input.note ?? null }); return error ? errorResult(error) : { ok: true, data: mapRegistration(firstRow(data)) }; },
  async rejectFee(_actor, input: RejectRegistrationFeeInput) { const supabase = getSupabaseBrowserClient(); if (!supabase) return errorResult({ message: "Supabase is not configured" }); const { data, error } = await supabase.rpc("reject_registration_fee", { p_registration_id: input.registrationId, p_reason: input.reason }); return error ? errorResult(error) : { ok: true, data: mapRegistration(firstRow(data)) }; },
  async approveRegistration(_actor, input: RegistrationDecisionInput) { const supabase = getSupabaseBrowserClient(); if (!supabase) return errorResult({ message: "Supabase is not configured" }); const { data, error } = await supabase.rpc("approve_registration", { p_registration_id: input.registrationId, p_reason: input.reason ?? null }); return error ? errorResult(error) : { ok: true, data: mapRegistration(firstRow(data)) }; },
  async rejectRegistration(_actor, input: RegistrationDecisionInput) { const supabase = getSupabaseBrowserClient(); if (!supabase) return errorResult({ message: "Supabase is not configured" }); const { data, error } = await supabase.rpc("reject_registration", { p_registration_id: input.registrationId, p_reason: input.reason ?? "Registration rejected" }); return error ? errorResult(error) : { ok: true, data: mapRegistration(firstRow(data)) }; },
  async assertActiveAgent(actor, registrationId) { const result = await supabaseRegistrationRepository.getRegistration(actor, registrationId); if (!result.ok) return result; return result.data.registrationStatus === "active" ? result : { ok: false, error: { code: "FORBIDDEN", message: "Your account is awaiting registration approval. Only onboarding and registration status are available." } }; },
};
