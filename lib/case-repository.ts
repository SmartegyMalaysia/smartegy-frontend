import { mockDashboard } from "./mock-data";
import { caseDocumentConfig, validateCaseDocument } from "./document-config";
import { canDeleteCase } from "./case-workflow";
import { calculateProposalPreview } from "./proposal-calculations";
import type { AcceptTrialInput, AcceptanceInput, CaseDetail, CaseDocumentInput, CasePayment, CaseSummary, CurrentUser, CreateCaseInput, GeneratedDocumentResult, GeneratePaymentScheduleInput, ID, ProposalInput, RecordPaymentInput, SavingsVerificationInput, UpdateCaseInput, VerifyPaymentInput, CaseStatus, PaymentStatus } from "./types";

type CaseErrorCode = "VALIDATION_ERROR" | "FORBIDDEN" | "NOT_FOUND" | "INTERNAL_ERROR" | "CONFLICT";
export type CaseResult<T> = { ok: true; data: T } | { ok: false; error: { code: CaseErrorCode; message: string; fieldErrors?: Record<string, string[]> } };
export interface CaseDirectoryQuery { search?: string; stage?: CaseStatus; paymentStatus?: PaymentStatus; agentId?: ID; page?: number; pageSize?: number; sortBy?: "updated" | "customer" | "agent" | "amount" | "status" | "payment_status"; sortDirection?: "asc" | "desc"; }
export interface CaseDirectoryPage { items: CaseSummary[]; totalItems: number; totalPages: number; agentOptions: Array<{ value: ID; label: string }>; }

const seededCases = mockDashboard("staff").cases;
const now = () => new Date().toISOString();
const money = (sen: number | null | undefined) => sen == null ? null : sen;
const staffRoles = new Set(["staff", "admin"]);
const allowedTransitions: Partial<Record<CaseStatus, CaseStatus[]>> = {
  under_review: ["quotation_issued", "changes_requested", "cancelled"],
  changes_requested: ["under_review", "cancelled"],
  quotation_issued: ["awaiting_deposit_submission", "cancelled"],
  awaiting_deposit_submission: ["deposit_pending_verification", "cancelled"],
  deposit_pending_verification: ["awaiting_deposit_submission", "awaiting_installation_scheduling", "cancelled"],
  awaiting_installation_scheduling: ["installation_pending_confirmation", "cancelled"],
  installation_pending_confirmation: ["installation_scheduled", "cancelled"],
  installation_reschedule_requested: ["installation_pending_confirmation", "cancelled"],
  installation_scheduled: ["awaiting_post_installation_payment", "installed_monitoring", "cancelled"],
  awaiting_post_installation_payment: ["post_installation_payment_pending_verification", "cancelled"],
  post_installation_payment_pending_verification: ["awaiting_post_installation_payment", "installed_monitoring", "cancelled"],
  installed_monitoring: ["trial_review", "cancelled"],
  trial_review: ["active_installments", "cancelled"],
  active_installments: ["completed", "cancelled"],
};

const caseStore = new Map<ID, CaseDetail>(seededCases.map((item) => [item.id, {
  ...item,
  customer: { id: `customer-${item.id}`, displayName: item.customerDisplayName, companyRegistrationNumber: null, contactName: null, email: null, phone: null, businessType: "Other", businessTypeOther: "Legacy case" },
  service: { siteAddress: "Not provided in mock data", addressLine1: "", addressLine2: "", postcode: "", city: "", state: "", electricityAccountNumber: null, notes: null },
  documents: [],
  quote: { saleAmountSen: item.saleAmountSen, averageMonthlyKwh: null, averageTnbRate: null, quotedSavingsKwh: null, quotedMonthlySavingsSen: item.id === "case-002" ? 1000 : null },
  verifiedSavings: null,
  paymentSchedules: item.status === "active_installments" ? [1, 2, 3].map((sequence) => ({ id: `schedule-${item.id}-${sequence}`, caseId: item.id, sequence, kind: sequence === 1 ? "deposit" : sequence === 2 ? "post_installation" : "installment", dueDate: `2026-08-${String(sequence).padStart(2, '0')}`, amountDueSen: sequence === 3 ? item.saleAmountSen ?? 0 : 0, amountPaidSen: sequence === 3 ? item.saleAmountSen ?? 0 : 0, status: "paid" as const })) : [],
  payments: [],
  financialDocuments: [],
  commissionIds: item.status === "active_installments" ? ["com-001", "com-002"] : [],
  activity: [{ id: `activity-${item.id}`, action: "case_created", actorDisplayName: item.agentName, occurredAt: item.submittedAt, summary: "Case submitted for staff review." }],
}]))

function failure<T>(code: CaseErrorCode, message: string, fieldErrors?: Record<string, string[]>): CaseResult<T> { return { ok: false, error: { code, message, ...(fieldErrors ? { fieldErrors } : {}) } }; }
function nextCaseNumber() { return `SMG-${String(caseStore.size + 128).padStart(5, "0")}`; }
function validateDocument(document: CaseDocumentInput) { return validateCaseDocument({ name: document.fileName, type: document.mimeType, size: document.sizeBytes }, document.type); }
function access(actor: CurrentUser, item: CaseDetail) { return actor.role !== "agent" || item.agentId === actor.agentId; }
function staffOnly<T>(actor: CurrentUser) { return staffRoles.has(actor.role) ? null : failure<T>("FORBIDDEN", "Staff or admin access is required for this case action."); }
function canManageCase(actor: CurrentUser, item: CaseDetail) { return staffRoles.has(actor.role) || (actor.role === "agent" && actor.agentId === item.agentId); }
function addMonths(date: string, months: number) { const value = new Date(`${date}T00:00:00Z`); value.setUTCMonth(value.getUTCMonth() + months); return value.toISOString().slice(0, 10); }
function addMockPaymentProof(found: CaseDetail, caseId: ID, actor: CurrentUser, proof: NonNullable<RecordPaymentInput["proof"]>, sequence: number) {
  const id = `document-${caseId}-payment-${sequence}`;
  found.documents = [...found.documents, { id, caseId, type: "payment_proof", fileName: proof.fileName, mimeType: proof.mimeType, sizeBytes: proof.sizeBytes, uploadedBy: actor.id, uploadedAt: now(), visibleToAgent: true, file: proof.file }];
  return id;
}
function automaticAllocations(schedules: CaseDetail["paymentSchedules"], amountSen: number) {
  let remaining = amountSen;
  const allocations: Array<{ scheduleId: ID; amountSen: number }> = [];
  for (const schedule of schedules ?? []) {
    const balance = schedule.amountDueSen - schedule.amountPaidSen;
    if (balance <= 0 || remaining <= 0) continue;
    const amount = Math.min(balance, remaining);
    allocations.push({ scheduleId: schedule.id, amountSen: amount });
    remaining -= amount;
  }
  return remaining === 0 ? allocations : null;
}
export function derivePaymentStatus(item: Pick<CaseDetail, "paymentSchedules" | "payments">, asOf = new Date().toISOString().slice(0, 10)): PaymentStatus {
  if (item.payments?.some((payment) => payment.status === "pending_verification")) return "pending_verification";
  const schedules = (item.paymentSchedules ?? []).filter((schedule) => !["waived", "cancelled"].includes(schedule.status));
  if (!schedules.length) return "not_recorded";
  if (schedules.every((schedule) => schedule.amountPaidSen >= schedule.amountDueSen)) return "fully_paid";
  if (schedules.some((schedule) => schedule.dueDate < asOf && schedule.amountPaidSen < schedule.amountDueSen)) return "overdue";
  if (schedules.some((schedule) => schedule.dueDate <= asOf && schedule.amountPaidSen > 0 && schedule.amountPaidSen < schedule.amountDueSen)) return "partially_paid";
  return "current";
}
function recordActivity(item: CaseDetail, actor: CurrentUser, action: string, summary: string, reason?: string) { item.activity = [...item.activity, { id: `activity-${item.id}-${item.activity.length + 1}`, action, actorDisplayName: actor.displayName, occurredAt: now(), summary: reason ? `${summary} — ${reason}` : summary, reason: reason ?? null }]; item.updatedAt = now(); }

export interface CasesRepository {
  listPage(actor: CurrentUser, query: CaseDirectoryQuery): Promise<CaseResult<CaseDirectoryPage>>;
  export(actor: CurrentUser, query: CaseDirectoryQuery): Promise<CaseResult<true>>;
  getById(actor: CurrentUser, caseId: ID): Promise<CaseResult<CaseDetail>>;
  create(actor: CurrentUser, input: CreateCaseInput, onUploadProgress?: (progress: number) => void): Promise<CaseResult<CaseDetail>>;
  update(actor: CurrentUser, caseId: ID, input: UpdateCaseInput): Promise<CaseResult<CaseDetail>>;
  deleteCase(actor: CurrentUser, caseId: ID): Promise<CaseResult<{ id: ID }>>;
  transition(actor: CurrentUser, caseId: ID, to: CaseStatus, reason?: string): Promise<CaseResult<CaseDetail>>;
  requestChanges(actor: CurrentUser, caseId: ID, reason: string): Promise<CaseResult<CaseDetail>>;
  cancel(actor: CurrentUser, caseId: ID, reason: string): Promise<CaseResult<CaseDetail>>;
  generatePaymentSchedule(actor: CurrentUser, caseId: ID, input: GeneratePaymentScheduleInput): Promise<CaseResult<CaseDetail>>;
  submitDeposit(actor: CurrentUser, caseId: ID, input: RecordPaymentInput): Promise<CaseResult<CaseDetail>>;
  submitPostInstallationPayment(actor: CurrentUser, caseId: ID, input: RecordPaymentInput): Promise<CaseResult<CaseDetail>>;
  submitInstallmentPayment(actor: CurrentUser, caseId: ID, input: RecordPaymentInput): Promise<CaseResult<CaseDetail>>;
  rejectPayment(actor: CurrentUser, paymentId: ID, reason: string): Promise<CaseResult<CaseDetail>>;
  proposeInstallationDate(actor: CurrentUser, caseId: ID, date: ISODate, time: string): Promise<CaseResult<CaseDetail>>;
  confirmInstallationDate(actor: CurrentUser, caseId: ID): Promise<CaseResult<CaseDetail>>;
  requestInstallationReschedule(actor: CurrentUser, caseId: ID, reason: string): Promise<CaseResult<CaseDetail>>;
  recordPayment(actor: CurrentUser, caseId: ID, input: RecordPaymentInput): Promise<CaseResult<CaseDetail>>;
  recordAndVerifyPayment(actor: CurrentUser, caseId: ID, input: RecordPaymentInput): Promise<CaseResult<CaseDetail>>;
  verifyPayment(actor: CurrentUser, input: VerifyPaymentInput): Promise<CaseResult<CaseDetail>>;
  recordInstallation(actor: CurrentUser, caseId: ID, installationDate: ISODate, installationTime: string): Promise<CaseResult<CaseDetail>>;
  verifySavings(actor: CurrentUser, caseId: ID, input: SavingsVerificationInput): Promise<CaseResult<CaseDetail>>;
  acceptTrial(actor: CurrentUser, caseId: ID, input: AcceptTrialInput): Promise<CaseResult<CaseDetail>>;
  saveProposalDraft(actor: CurrentUser, caseId: ID, input: ProposalInput): Promise<CaseResult<CaseDetail>>;
  issueProposal(actor: CurrentUser, caseId: ID, input: ProposalInput): Promise<CaseResult<CaseDetail>>;
  acceptProposal(actor: CurrentUser, caseId: ID, input: AcceptanceInput): Promise<CaseResult<CaseDetail>>;
  voidProposal(actor: CurrentUser, caseId: ID, proposalId: ID, reason: string): Promise<CaseResult<CaseDetail>>;
  generateFinancialDocument(actor: CurrentUser, caseId: ID, type: "quotation" | "proforma", paymentScheduleId?: ID): Promise<CaseResult<GeneratedDocumentResult>>;
  voidDocument(actor: CurrentUser, caseId: ID, documentId: ID, reason: string): Promise<CaseResult<CaseDetail>>;
  getDocumentUrl(actor: CurrentUser, caseId: ID, documentId: ID): Promise<CaseResult<string>>;
}

type ISODate = string;
export const mockCasesRepository: CasesRepository = {
  async listPage(actor, query) {
    const all = Array.from(caseStore.values()).filter((item) => actor.role !== "agent" || item.agentId === actor.agentId);
    const term = query.search?.trim().toLowerCase() ?? "";
    const stageMatch = (item: CaseSummary) => !query.stage || item.status === query.stage;
    const filtered = all.filter((item) => (!term || `${item.caseNumber} ${item.customerDisplayName} ${item.agentName}`.toLowerCase().includes(term)) && stageMatch(item) && (!query.paymentStatus || item.paymentStatus === query.paymentStatus) && (!query.agentId || item.agentId === query.agentId));
    const direction = query.sortDirection === "asc" ? 1 : -1;
    const sorted = [...filtered].sort((a, b) => {
      const comparison = query.sortBy === "amount" ? (a.saleAmountSen ?? 0) - (b.saleAmountSen ?? 0)
        : query.sortBy === "customer" ? a.customerDisplayName.localeCompare(b.customerDisplayName)
            : query.sortBy === "agent" ? a.agentName.localeCompare(b.agentName)
              : query.sortBy === "status" ? a.status.localeCompare(b.status)
                : query.sortBy === "payment_status" ? a.paymentStatus.localeCompare(b.paymentStatus)
                  : a.updatedAt.localeCompare(b.updatedAt);
      return comparison * direction;
    });
    const pageSize = Math.min(10000, Math.max(1, query.pageSize ?? 5)); const page = Math.max(1, query.page ?? 1);
    return { ok: true, data: { items: sorted.slice((page - 1) * pageSize, page * pageSize).map((item) => ({ ...item })), totalItems: sorted.length, totalPages: Math.max(1, Math.ceil(sorted.length / pageSize)), agentOptions: Array.from(new Map(all.map((item) => [item.agentId, { value: item.agentId, label: item.agentName }])).values()).sort((a, b) => a.label.localeCompare(b.label)) } };
  },
  async export(actor, query) { const result = await this.listPage(actor, { ...query, page: 1, pageSize: 10000 }); if (!result.ok) return result; const { downloadCsv } = await import("./export-csv"); downloadCsv("smartegy-cases.csv", [["Case", "Customer", "Agent", "Amount", "Status", "Payment", "Updated"], ...result.data.items.map((item) => [item.caseNumber, item.customerDisplayName, item.agentName, item.saleAmountSen == null ? "" : item.saleAmountSen / 100, item.status, item.paymentStatus, item.updatedAt])]); return { ok: true, data: true }; },
  async getById(actor, caseId) {
    await new Promise((resolve) => setTimeout(resolve, 30));
    const found = caseStore.get(caseId);
    if (!found) return failure("NOT_FOUND", "Case not found.");
    if (!access(actor, found)) return failure("FORBIDDEN", "You can only access your own cases.");
    return { ok: true, data: found };
  },
  async create(actor, input, onUploadProgress) {
    if (actor.role !== "agent" || !actor.agentId) return failure("FORBIDDEN", "Only agents can submit a new case.");
    const fieldErrors: Record<string, string[]> = {};
    if (!input.customer.displayName.trim()) fieldErrors.customerName = ["Enter the customer or company name."];
    if (!input.customer.businessType?.trim()) fieldErrors.businessType = ["Select the type of business."];
    if (input.customer.businessType === "Other" && !input.customer.businessTypeOther?.trim()) fieldErrors.businessTypeOther = ["Enter the type of business."];
    if (!input.service.siteAddress.trim()) fieldErrors.siteAddress = ["Enter the service address."];
    if (!input.documents.some((document) => document.type === "electricity_bill")) fieldErrors.electricityBill = ["Upload the latest electricity bill before submitting."];
    input.documents.forEach((document) => { const error = validateDocument(document); if (error) fieldErrors[document.type] = [error]; });
    if (Object.keys(fieldErrors).length) return failure("VALIDATION_ERROR", "Check the required case details and documents.", fieldErrors);
    const id = `case-${String(caseStore.size + 1).padStart(3, "0")}`;
    const submittedAt = now();
    onUploadProgress?.(10);
    await new Promise((resolve) => setTimeout(resolve, 60));
    const created: CaseDetail = { id, caseNumber: nextCaseNumber(), customerDisplayName: input.customer.displayName.trim(), agentId: actor.agentId, agentName: actor.displayName, status: "under_review", paymentStatus: "not_recorded", saleAmountSen: null, submittedAt, updatedAt: submittedAt, customer: { id: `customer-${id}`, displayName: input.customer.displayName.trim(), companyRegistrationNumber: null, contactName: input.customer.contactName?.trim() || null, email: input.customer.email?.trim() || null, phone: input.customer.phone?.trim() || null, businessType: input.customer.businessType?.trim() || null, businessTypeOther: input.customer.businessType === "Other" ? input.customer.businessTypeOther?.trim() || null : null }, service: { siteAddress: input.service.siteAddress.trim(), addressLine1: input.service.addressLine1?.trim() ?? "", addressLine2: input.service.addressLine2?.trim() ?? "", postcode: input.service.postcode?.trim() ?? "", city: input.service.city?.trim() ?? "", state: input.service.state?.trim() ?? "", electricityAccountNumber: null, notes: input.service.notes?.trim() || null }, documents: input.documents.map((document, index) => ({ id: `document-${id}-${index + 1}`, caseId: id, ...document, uploadedBy: actor.id, uploadedAt: submittedAt })), quote: null, verifiedSavings: null, paymentSchedules: [], payments: [], financialDocuments: [], commissionIds: [], activity: [{ id: `activity-${id}`, action: "case_submitted", actorDisplayName: actor.displayName, occurredAt: submittedAt, summary: "Case submitted and is ready for staff review." }] };
    onUploadProgress?.(100);
    caseStore.set(id, created);
    return { ok: true, data: created };
  },
  async update(actor, caseId, input) {
    const found = caseStore.get(caseId); if (!found) return failure("NOT_FOUND", "Case not found."); if (!access(actor, found)) return failure("FORBIDDEN", "You can only edit your own case.");
    if (actor.role === "agent" && found.status !== "changes_requested") return failure("FORBIDDEN", "Agents can only edit a case when changes have been requested.");
    if (input.customer) Object.assign(found.customer, input.customer, { displayName: input.customer.displayName?.trim() || found.customer.displayName });
    if (input.service) Object.assign(found.service, input.service);
    if (input.quote) { found.quote = { ...(found.quote ?? { saleAmountSen: null, averageMonthlyKwh: null, averageTnbRate: null, quotedSavingsKwh: null, quotedMonthlySavingsSen: null }), ...input.quote }; found.saleAmountSen = found.quote.saleAmountSen; }
    found.customerDisplayName = found.customer.displayName; recordActivity(found, actor, "case_updated", "Case details updated."); return { ok: true, data: found };
  },
  async deleteCase(actor, caseId) {
    const found = caseStore.get(caseId);
    if (!found) return failure("NOT_FOUND", "Case not found.");
    if (!canDeleteCase(actor, found.status, found.agentId)) return failure("FORBIDDEN", "Agents can only delete their own draft cases.");
    caseStore.delete(caseId);
    return { ok: true, data: { id: caseId } };
  },
  async transition(actor, caseId, to, reason) {
    const found = caseStore.get(caseId); if (!found) return failure("NOT_FOUND", "Case not found."); if (!access(actor, found)) return failure("FORBIDDEN", "You can only access your own case.");
    if (actor.role === "agent") { if (!((found.status === "changes_requested" && to === "under_review") || (found.status === "installation_pending_confirmation" && to === "installation_scheduled"))) return failure("FORBIDDEN", "Agents may only resubmit or confirm their own case."); }
    else if (!staffRoles.has(actor.role)) return failure("FORBIDDEN", "Staff or admin access is required.");
    if (!allowedTransitions[found.status]?.includes(to)) return failure("VALIDATION_ERROR", `Invalid case transition from ${found.status} to ${to}.`);
    if ((to === "changes_requested" || to === "cancelled") && !reason?.trim()) return failure("VALIDATION_ERROR", `${to === "cancelled" ? "A cancellation" : "A change request"} reason is required.`);
    if (to === "quotation_issued" && (!found.quote?.saleAmountSen || !found.quote.quotedMonthlySavingsSen)) return failure("VALIDATION_ERROR", "Sale amount and quoted monthly savings are required before quotation.");
    if (to === "awaiting_deposit_submission" && !found.paymentSchedules?.length) return failure("VALIDATION_ERROR", "Generate the initial payment schedule before issuing the quotation.");
    if (to === "installation_pending_confirmation" && found.paymentSchedules?.find((schedule) => schedule.kind === "deposit")?.status !== "paid") return failure("VALIDATION_ERROR", "The deposit must be verified before installation can be scheduled.");
    if (to === "installation_pending_confirmation" && !found.installationProposedDate) return failure("VALIDATION_ERROR", "A proposed installation date is required.");
    if (to === "installation_scheduled" && !found.installationConfirmedAt) return failure("VALIDATION_ERROR", "The agent must confirm the proposed installation date.");
    if (to === "trial_review" && !found.verifiedSavings?.verifiedAt) return failure("VALIDATION_ERROR", "Verified savings are required before trial review.");
    if (to === "completed" && found.paymentSchedules?.some((schedule) => schedule.kind === "installment" && schedule.status !== "paid")) return failure("VALIDATION_ERROR", "All installment obligations must be paid before completion.");
    const from = found.status; found.status = to; found.paymentStatus = derivePaymentStatus(found); recordActivity(found, actor, "status_changed", `${from} → ${to}`, reason); return { ok: true, data: found };
  },
  async requestChanges(actor, caseId, reason) { return this.transition(actor, caseId, "changes_requested", reason); },
  async cancel(actor, caseId, reason) { return this.transition(actor, caseId, "cancelled", reason); },
  async generatePaymentSchedule(actor, caseId, input) {
    const permission = staffOnly<CaseDetail>(actor); if (permission) return permission; const found = caseStore.get(caseId); if (!found) return failure("NOT_FOUND", "Case not found."); if (found.status !== "quotation_issued") return failure("VALIDATION_ERROR", "A payment schedule can only be generated for a quotation."); if (found.paymentSchedules?.length) return failure("CONFLICT", "A payment schedule already exists."); if (!found.quote?.quotedMonthlySavingsSen || !found.saleAmountSen) return failure("VALIDATION_ERROR", "Sale amount and quoted monthly savings are required."); const initial = found.quote.quotedMonthlySavingsSen; found.paymentSchedules = [{ id: `schedule-${caseId}-1`, caseId, sequence: 1, kind: "deposit", dueDate: input.depositDue, amountDueSen: initial, amountPaidSen: 0, status: "scheduled" }, { id: `schedule-${caseId}-2`, caseId, sequence: 2, kind: "post_installation", dueDate: input.postInstallationDue, amountDueSen: initial * 2, amountPaidSen: 0, status: "scheduled" }]; recordActivity(found, actor, "payment_schedule_generated", "Initial payment schedule generated."); return this.transition(actor, caseId, "awaiting_deposit_submission", "Quotation issued; payment schedule generated.");
  },
  async recordPayment(actor, caseId, input) { const permission = staffOnly<CaseDetail>(actor); if (permission) return permission; const found = caseStore.get(caseId); if (!found) return failure("NOT_FOUND", "Case not found."); const payment: CasePayment = { id: `payment-${caseId}-${(found.payments?.length ?? 0) + 1}`, caseId, amountSen: input.amountSen, paymentDate: input.paymentDate, reference: input.reference ?? null, status: "pending_verification", recordedBy: actor.id, recordedAt: now(), verifiedBy: null, verifiedAt: null }; found.payments = [...(found.payments ?? []), payment]; found.paymentStatus = "pending_verification"; recordActivity(found, actor, "payment_recorded", "Payment recorded and awaiting verification."); return { ok: true, data: found }; },
  async submitDeposit(actor, caseId, input) { if (actor.role !== "agent") return failure("FORBIDDEN", "Only the submitting agent can record a deposit."); const found = caseStore.get(caseId); if (!found || found.agentId !== actor.agentId) return failure("FORBIDDEN", "You can only submit a deposit for your own case."); if (!['awaiting_deposit_submission', 'deposit_pending_verification'].includes(found.status)) return failure("VALIDATION_ERROR", "This case is not awaiting a deposit."); if (!input.proof) return failure("VALIDATION_ERROR", "Deposit proof is required."); const schedule = found.paymentSchedules?.find((item) => item.kind === "deposit" && item.amountDueSen > item.amountPaidSen); const pendingTotal = (found.payments ?? []).filter((payment) => payment.status === "pending_verification").reduce((sum, payment) => sum + payment.amountSen, 0); if (!schedule || input.amountSen <= 0 || input.amountSen > schedule.amountDueSen - schedule.amountPaidSen - pendingTotal) return failure("VALIDATION_ERROR", "Payment amount cannot exceed the remaining deposit balance after pending payments."); const sequence = (found.payments?.length ?? 0) + 1; const payment: CasePayment = { id: `payment-${caseId}-${sequence}`, caseId, amountSen: input.amountSen, paymentDate: input.paymentDate, reference: input.reference ?? null, proofDocumentId: addMockPaymentProof(found, caseId, actor, input.proof, sequence), proofFileName: input.proof.fileName, proofMimeType: input.proof.mimeType, status: "pending_verification", recordedBy: actor.id, recordedAt: now(), verifiedBy: null, verifiedAt: null }; found.payments = [...(found.payments ?? []), payment]; found.status = "deposit_pending_verification"; found.paymentStatus = "pending_verification"; recordActivity(found, actor, "payment_recorded", "Deposit submitted and awaiting staff verification."); return { ok: true, data: found }; },
  async submitPostInstallationPayment(actor, caseId, input) { const found = caseStore.get(caseId); if (!found || actor.role !== "agent" || found.agentId !== actor.agentId || !["awaiting_post_installation_payment", "post_installation_payment_pending_verification"].includes(found.status)) return failure("FORBIDDEN", "Only the submitting agent can record the post-installation payment after installation."); if (!input.proof) return failure("VALIDATION_ERROR", "Payment proof is required."); const schedule = found.paymentSchedules?.find((item) => item.kind === "post_installation" && item.amountDueSen > item.amountPaidSen); const pendingTotal = (found.payments ?? []).filter((payment) => payment.status === "pending_verification").reduce((sum, payment) => sum + payment.amountSen, 0); if (!schedule || input.amountSen <= 0 || input.amountSen > schedule.amountDueSen - schedule.amountPaidSen - pendingTotal) return failure("VALIDATION_ERROR", "Payment amount cannot exceed the remaining post-installation balance after pending payments."); const sequence = (found.payments?.length ?? 0) + 1; const payment: CasePayment = { id: `payment-${caseId}-${sequence}`, caseId, amountSen: input.amountSen, paymentDate: input.paymentDate, reference: input.reference ?? null, proofDocumentId: addMockPaymentProof(found, caseId, actor, input.proof, sequence), proofFileName: input.proof.fileName, proofMimeType: input.proof.mimeType, status: "pending_verification", recordedBy: actor.id, recordedAt: now(), verifiedBy: null, verifiedAt: null }; found.payments = [...(found.payments ?? []), payment]; found.status = "post_installation_payment_pending_verification"; found.paymentStatus = "pending_verification"; recordActivity(found, actor, "payment_recorded", "Post-installation payment submitted and awaiting staff verification."); return { ok: true, data: found }; },
  async submitInstallmentPayment(actor, caseId, input) { const found = caseStore.get(caseId); const schedule = found?.paymentSchedules?.find((item) => item.kind === "installment" && item.amountDueSen > item.amountPaidSen); if (!found || actor.role !== "agent" || found.agentId !== actor.agentId || found.status !== "active_installments") return failure("FORBIDDEN", "Only the submitting agent can record an installment payment."); if (!schedule) return failure("VALIDATION_ERROR", "All installment payments have already been completed."); if (!input.proof) return failure("VALIDATION_ERROR", "Payment proof is required."); const pendingTotal = (found.payments ?? []).filter((payment) => payment.status === "pending_verification").reduce((sum, payment) => sum + payment.amountSen, 0); if (input.amountSen <= 0 || input.amountSen > schedule.amountDueSen - schedule.amountPaidSen - pendingTotal) return failure("VALIDATION_ERROR", "Payment amount cannot exceed the installment balance after pending payments."); const sequence = (found.payments?.length ?? 0) + 1; const payment: CasePayment = { id: `payment-${caseId}-${sequence}`, caseId, amountSen: input.amountSen, paymentDate: input.paymentDate, reference: input.reference ?? null, proofDocumentId: addMockPaymentProof(found, caseId, actor, input.proof, sequence), proofFileName: input.proof.fileName, proofMimeType: input.proof.mimeType, status: "pending_verification", recordedBy: actor.id, recordedAt: now(), verifiedBy: null, verifiedAt: null }; found.payments = [...(found.payments ?? []), payment]; found.paymentStatus = "pending_verification"; recordActivity(found, actor, "payment_recorded", "Installment payment submitted and awaiting verification."); return { ok: true, data: found }; },
  async rejectPayment(actor, paymentId, reason) { const permission = staffOnly<CaseDetail>(actor); if (permission) return permission; if (!reason.trim()) return failure("VALIDATION_ERROR", "A rejection reason is required."); const found = Array.from(caseStore.values()).find((item) => item.payments?.some((payment) => payment.id === paymentId)); const payment = found?.payments?.find((item) => item.id === paymentId); if (!found || !payment || payment.status !== "pending_verification") return failure("NOT_FOUND", "Pending payment not found."); payment.status = "rejected"; payment.rejectionReason = reason.trim(); found.paymentStatus = derivePaymentStatus(found); recordActivity(found, actor, "payment_rejected", "Payment rejected.", reason.trim()); return { ok: true, data: found }; },
  async proposeInstallationDate(actor, caseId, date, time) { const permission = staffOnly<CaseDetail>(actor); if (permission) return permission; const found = caseStore.get(caseId); if (!found) return failure("NOT_FOUND", "Case not found."); if (!["awaiting_installation_scheduling", "installation_pending_confirmation", "installation_reschedule_requested"].includes(found.status) || found.paymentSchedules?.find((s) => s.kind === "deposit")?.status !== "paid") return failure("VALIDATION_ERROR", "A verified deposit is required before setting an installation date."); const needsConfirmation = found.status !== "installation_pending_confirmation"; found.installationProposedDate = date; found.installationProposedTime = time; found.installationProposedAt = now(); found.installationConfirmationRequestedReason = null; found.installationConfirmedAt = null; return needsConfirmation ? this.transition(actor, caseId, "installation_pending_confirmation", "Installation date proposed for agent confirmation.") : { ok: true, data: found }; },
  async confirmInstallationDate(actor, caseId) { if (actor.role !== "agent") return failure("FORBIDDEN", "Only the submitting agent can confirm the installation date."); const found = caseStore.get(caseId); if (!found || found.agentId !== actor.agentId) return failure("FORBIDDEN", "You can only confirm your own case."); if (found.status !== "installation_pending_confirmation" || !found.installationProposedDate) return failure("VALIDATION_ERROR", "This case is not awaiting installation confirmation."); found.installationConfirmedAt = now(); return this.transition(actor, caseId, "installation_scheduled", "Agent confirmed installation date after client confirmation."); },
  async requestInstallationReschedule(actor, caseId, reason) { if (actor.role !== "agent") return failure("FORBIDDEN", "Only the submitting agent can request a reschedule."); const found = caseStore.get(caseId); if (!found || found.agentId !== actor.agentId) return failure("FORBIDDEN", "You can only update your own case."); if (found.status !== "installation_pending_confirmation" || !reason.trim()) return failure("VALIDATION_ERROR", "A reschedule reason is required."); found.installationProposedDate = null; found.installationProposedTime = null; found.installationProposedAt = null; found.installationConfirmationRequestedReason = reason.trim(); found.installationConfirmedAt = null; found.status = "installation_reschedule_requested"; recordActivity(found, actor, "installation_reschedule_requested", "Installation reschedule requested.", reason.trim()); return { ok: true, data: found }; },
  async recordAndVerifyPayment(actor, caseId, input) {
    const permission = staffOnly<CaseDetail>(actor); if (permission) return permission;
    const found = caseStore.get(caseId); if (!found) return failure("NOT_FOUND", "Case not found.");
    const allocations = automaticAllocations(found.paymentSchedules, input.amountSen);
    if (!allocations) return failure("VALIDATION_ERROR", "Payment amount exceeds the outstanding schedule balance.");
    const pending = found.payments?.find((payment) => payment.status === "pending_verification");
    if (pending) {
      if (pending.amountSen !== input.amountSen) return failure("VALIDATION_ERROR", "The pending payment amount cannot be changed after it has been recorded.");
      return this.verifyPayment(actor, { paymentId: pending.id, allocations });
    }
    const recorded = await this.recordPayment(actor, caseId, input);
    if (!recorded.ok) return recorded;
    const payment = recorded.data.payments?.find((item) => item.status === "pending_verification");
    if (!payment) return failure("INTERNAL_ERROR", "The payment could not be prepared for confirmation.");
    return this.verifyPayment(actor, { paymentId: payment.id, allocations });
  },
  async verifyPayment(actor, input) {
    const owner = Array.from(caseStore.values()).find((item: CaseDetail) => item.payments?.some((payment) => payment.id === input.paymentId));
    if (!owner) return failure("NOT_FOUND", "Payment not found.");
    if (!staffRoles.has(actor.role)) return failure("FORBIDDEN", "Only staff or admin can verify payments.");
    const payment = owner.payments?.find((item: CasePayment) => item.id === input.paymentId);
    if (!payment || payment.status !== "pending_verification") return failure("VALIDATION_ERROR", "Payment is not pending verification.");
    if (input.allocations.reduce((sum, allocation) => sum + allocation.amountSen, 0) !== payment.amountSen) return failure("VALIDATION_ERROR", "Allocations must equal the payment amount.");
    let allocatedKind: NonNullable<CaseDetail["paymentSchedules"]>[number]["kind"] | undefined;
    for (const allocation of input.allocations) {
      const schedule = owner.paymentSchedules?.find((item) => item.id === allocation.scheduleId);
      if (!schedule || schedule.amountPaidSen + allocation.amountSen > schedule.amountDueSen) return failure("VALIDATION_ERROR", "Payment allocation exceeds the schedule balance.");
      allocatedKind = schedule.kind;
      schedule.amountPaidSen += allocation.amountSen;
      schedule.status = schedule.amountPaidSen === schedule.amountDueSen ? "paid" : "partially_paid";
    }
    payment.status = "verified";
    payment.verifiedBy = actor.id;
    payment.verifiedAt = now();
    const hasPending = owner.payments?.some((item) => item.status === "pending_verification") ?? false;
    owner.paymentStatus = hasPending ? "pending_verification" : derivePaymentStatus(owner);
    if (allocatedKind === "deposit" && ["deposit_pending_verification", "awaiting_deposit_submission"].includes(owner.status)) {
      owner.status = owner.paymentSchedules?.some((schedule) => schedule.kind === "deposit" && schedule.status !== "paid") ? hasPending ? "deposit_pending_verification" : "awaiting_deposit_submission" : "awaiting_installation_scheduling";
    } else if (allocatedKind === "post_installation" && ["post_installation_payment_pending_verification", "awaiting_post_installation_payment"].includes(owner.status)) {
      const postInstallationPaid = !owner.paymentSchedules?.some((schedule) => schedule.kind === "post_installation" && schedule.status !== "paid");
      owner.status = postInstallationPaid ? "installed_monitoring" : hasPending ? "post_installation_payment_pending_verification" : "awaiting_post_installation_payment";
      if (postInstallationPaid && !owner.commissionIds?.length) {
        owner.commissionIds = [`commission-calculation-${owner.id}`];
        recordActivity(owner, actor, "commission_generated", "Initial commission issued after post-installation payment verification.");
      }
    }
    recordActivity(owner, actor, "payment_verified", "Payment verified.");
    const installments = owner.paymentSchedules?.filter((schedule) => schedule.kind === "installment") ?? [];
    if (allocatedKind === "installment" && !installments.some((schedule) => schedule.status !== "paid")) return this.transition(actor, owner.id, "completed", "All instalment obligations paid.");
    return { ok: true, data: owner };
  },
  async recordInstallation(actor, caseId, installationDate, installationTime) { const permission = staffOnly<CaseDetail>(actor); if (permission) return permission; const found = caseStore.get(caseId); if (!found) return failure("NOT_FOUND", "Case not found."); if (found.status !== "installation_scheduled") return failure("VALIDATION_ERROR", "Case must be installation scheduled."); found.installationDate = installationDate; found.installationTime = installationTime; found.monitoringStartedOn = installationDate; const result = await this.transition(actor, caseId, found.paymentSchedules?.find((schedule) => schedule.kind === "post_installation")?.status === "paid" ? "installed_monitoring" : "awaiting_post_installation_payment", "Installation completed"); return result; },
  async verifySavings(actor, caseId, input) {
    const found = caseStore.get(caseId);
    if (!found) return failure("NOT_FOUND", "Case not found.");
    if (actor.role !== "agent" || actor.agentId !== found.agentId) return failure("FORBIDDEN", "Only the submitting agent can record savings for this case.");
    if (found.status !== "installed_monitoring") return failure("VALIDATION_ERROR", "Case is not in the monitoring workflow.");
    if (input.readings.length !== 3 || input.readings.some((reading) => reading.kwhUsed <= 0 || reading.billAmountSen <= 0 || reading.operationDays <= 0)) return failure("VALIDATION_ERROR", "Enter exactly three valid post-installation readings.");
    const uniqueMonths = new Set(input.readings.map((reading) => reading.month));
    if (uniqueMonths.size !== 3) return failure("VALIDATION_ERROR", "Each savings reading must use a different month.");
    const avgKwh = input.readings.reduce((sum, reading) => sum + reading.kwhUsed, 0) / 3;
    const avgBillSen = Math.round(input.readings.reduce((sum, reading) => sum + reading.billAmountSen, 0) / 3);
    const avgRate = input.readings.reduce((sum, reading) => sum + reading.billAmountSen / 100 / reading.kwhUsed, 0) / 3;
    found.verifiedSavings = {
      readings: input.readings,
      avgKwh,
      avgBillSen,
      avgRate,
      savingsKwh: (found.proposal?.avgKwh ?? 0) - avgKwh,
      monthlySavingsSen: (found.proposal?.avgBillSen ?? 0) - avgBillSen,
      verifiedAt: now(),
    };
    found.status = "trial_review";
    recordActivity(found, actor, "savings_recorded", "Three months of post-installation savings were recorded.");
    return { ok: true, data: found };
  },
  async acceptTrial(actor, caseId, input) {
    const permission = staffOnly<CaseDetail>(actor); if (permission) return permission;
    const found = caseStore.get(caseId); if (!found) return failure("NOT_FOUND", "Case not found.");
    if (found.status !== "trial_review") return failure("VALIDATION_ERROR", "Case must be in trial review.");
    if (!found.verifiedSavings?.verifiedAt) return failure("VALIDATION_ERROR", "Recorded savings are required.");
    if (found.paymentSchedules?.some((schedule) => ["deposit", "post_installation"].includes(schedule.kind) && schedule.status !== "paid")) return failure("VALIDATION_ERROR", "All initial payment obligations must be verified.");
    if (found.paymentSchedules?.some((schedule) => schedule.kind === "installment")) return failure("CONFLICT", "An installment schedule already exists for this case.");
    const downpayment = found.proposal?.deposit1Sen ?? found.paymentSchedules?.find((item) => item.kind === "deposit")?.amountDueSen ?? 0;
    const postInstallation = found.proposal?.deposit2Sen ?? found.paymentSchedules?.find((item) => item.kind === "post_installation")?.amountDueSen ?? 0;
    const interest = input.termMonths === 20 ? Math.round((found.proposal?.saleAmountSen ?? found.saleAmountSen ?? 0) * 0.1) : 0;
    const balance = Math.max(0, (found.proposal?.saleAmountSen ?? found.saleAmountSen ?? 0) + interest - downpayment - postInstallation);
    const monthly = Math.floor(balance / input.termMonths);
    found.paymentSchedules = [...(found.paymentSchedules ?? []), ...Array.from({ length: input.termMonths }, (_, index) => ({ id: `schedule-${caseId}-${index + 3}`, caseId, sequence: index + 3, kind: "installment" as const, dueDate: addMonths(input.installmentStart, index), amountDueSen: index === input.termMonths - 1 ? balance - monthly * (input.termMonths - 1) : monthly, amountPaidSen: 0, status: "scheduled" as const }))];
    found.installmentTermMonths = input.termMonths;
    found.customerContinues = true;
    found.trialDecisionOn = now().slice(0, 10);
    found.status = "active_installments";
    found.paymentStatus = derivePaymentStatus(found);
    recordActivity(found, actor, "trial_started", `${input.termMonths}-month recurring payment schedule started.`);
    return { ok: true, data: found };
  },
  async saveProposalDraft(actor, caseId, input) { const permission = staffOnly<CaseDetail>(actor); if (permission) return permission; const found = caseStore.get(caseId); if (!found) return failure("NOT_FOUND", "Case not found."); if (!["under_review", "changes_requested"].includes(found.status)) return failure("VALIDATION_ERROR", "A proposal can only be prepared for a case under review."); const calculated = calculateProposalPreview(input); if (!calculated) return failure("VALIDATION_ERROR", "Enter between one and twelve valid completed monthly readings and a valid project amount."); found.proposal = { id: found.proposal?.id ?? `proposal-${caseId}`, caseId, version: found.proposal?.version ?? 1, reference: null, status: "draft", proposalDate: input.proposalDate, salesRepName: input.salesRepName, installationAddress: input.installationAddress, installationCostSen: input.installationCostSen, outstationCostSen: input.outstationCostSen, saleAmountSen: calculated.saleAmountSen, calculatedDownpaymentSen: calculated.calculatedDownpaymentSen, deposit1Sen: calculated.downpaymentSen, deposit2Sen: calculated.postInstallationSen, downpaymentTotalSen: calculated.downpaymentTotalSen, balanceSen: calculated.balanceSen, financingInterestSen: calculated.financingInterestSen, option1TotalSen: calculated.option1TotalSen, option2TotalSen: calculated.option2TotalSen, option1MonthlySen: calculated.option1MonthlySen, option2MonthlySen: calculated.option2MonthlySen, avgRate: calculated.avgRate, avgKwh: calculated.avgKwh, avgBillSen: calculated.avgBillSen, avgDayKwh: calculated.avgDayKwh, beforeInstallKwh: calculated.beforeInstallKwh, afterInstallKwh: calculated.afterInstallKwh, savingKwhMonth: calculated.savingKwhMonth, savingRmMonthSen: calculated.savingRmMonthSen, savingRmYearSen: calculated.savingRmYearSen, savingRm2YSen: calculated.savingRm2YSen, savingRm15YSen: calculated.savingRm15YSen, acceptedByName: null, acceptanceDate: null, selectedTermMonths: null, signedDocumentId: null, issuedAt: null, acceptedAt: null }; found.proposalReadings = input.readings; recordActivity(found, actor, "proposal_draft_saved", "Proposal draft saved."); return { ok: true, data: found }; },
  async issueProposal(actor, caseId, input) { const permission = staffOnly<CaseDetail>(actor); if (permission) return permission; const draft = await this.saveProposalDraft(actor, caseId, input); if (!draft.ok) return draft; const found = draft.data; if (!found.proposal) return failure("INTERNAL_ERROR", "Proposal draft was not created."); found.proposal.status = "issued"; found.proposal.reference = `PROP-${new Date().toISOString().slice(0, 7).replace("-", "")}-${String(caseStore.size + 1).padStart(3, "0")}`; found.proposal.issuedAt = now(); found.status = "quotation_issued"; found.saleAmountSen = found.proposal.saleAmountSen; found.quote = { saleAmountSen: found.proposal.saleAmountSen, averageMonthlyKwh: found.proposal.avgKwh, averageTnbRate: found.proposal.avgRate, quotedSavingsKwh: found.proposal.savingKwhMonth, quotedMonthlySavingsSen: found.proposal.savingRmMonthSen }; found.financialDocuments = [...(found.financialDocuments ?? []), { id: `document-${caseId}-quotation`, documentNumber: found.proposal.reference, type: "quotation", amountSen: found.proposal.saleAmountSen, issueDate: input.proposalDate, status: "issued", createdAt: now() }]; recordActivity(found, actor, "proposal_issued", `Proposal ${found.proposal.reference} issued.`); return { ok: true, data: found }; },
  async acceptProposal(actor, caseId, input) { if (actor.role !== "agent") return failure("FORBIDDEN", "Only the submitting agent can accept the proposal."); const found = caseStore.get(caseId); if (!found) return failure("NOT_FOUND", "Case not found."); if (found.agentId !== actor.agentId) return failure("FORBIDDEN", "You can only accept proposals for your own cases."); if (!found.proposal || found.proposal.status !== "issued") return failure("VALIDATION_ERROR", "An issued proposal is required."); if (input.postInstallationDue < input.depositDue) return failure("VALIDATION_ERROR", "Post-installation due date cannot precede the downpayment due date."); const signedDocumentId = `document-${caseId}-signed-proposal`; found.documents = [...found.documents, { id: signedDocumentId, caseId, type: "signed_proposal", fileName: input.signedProposal.name, mimeType: input.signedProposal.type || "application/pdf", sizeBytes: input.signedProposal.size, uploadedBy: actor.id, uploadedAt: now(), visibleToAgent: true }]; found.proposal.status = "accepted"; found.proposal.acceptedByName = input.acceptedByName; found.proposal.acceptanceDate = input.acceptanceDate; found.proposal.selectedTermMonths = input.selectedTermMonths; found.proposal.signedDocumentId = signedDocumentId; found.proposal.acceptedAt = now(); const downpayment = found.proposal.deposit1Sen; const post = found.proposal.deposit2Sen; found.paymentSchedules = [{ id: `schedule-${caseId}-1`, caseId, sequence: 1, kind: "deposit", dueDate: input.depositDue, amountDueSen: downpayment, amountPaidSen: 0, status: "scheduled" }, { id: `schedule-${caseId}-2`, caseId, sequence: 2, kind: "post_installation", dueDate: input.postInstallationDue, amountDueSen: post, amountPaidSen: 0, status: "scheduled" }]; found.installmentTermMonths = input.selectedTermMonths; found.status = "awaiting_deposit_submission"; found.paymentStatus = "not_recorded"; recordActivity(found, actor, "proposal_accepted", "Proposal accepted; downpayment and post-installation schedules created."); return { ok: true, data: found }; },
  async voidProposal(actor, caseId, proposalId, reason) { const permission = staffOnly<CaseDetail>(actor); if (permission) return permission; if (!reason.trim()) return failure("VALIDATION_ERROR", "A void reason is required."); const found = caseStore.get(caseId); if (!found) return failure("NOT_FOUND", "Case not found."); if (!found.proposal || found.proposal.id !== proposalId) return failure("NOT_FOUND", "Proposal not found."); if (!['draft', 'issued'].includes(found.proposal.status)) return failure("VALIDATION_ERROR", "Only draft or issued proposals can be voided."); found.proposal.status = "void"; if (found.status === "quotation_issued") found.status = "under_review"; recordActivity(found, actor, "proposal_voided", `Proposal version ${found.proposal.version} voided.`, reason); return { ok: true, data: found }; },
  async generateFinancialDocument(actor, caseId, type, paymentScheduleId) { const found = caseStore.get(caseId); if (!found) return failure("NOT_FOUND", "Case not found."); if (!canManageCase(actor, found)) return failure("FORBIDDEN", "Only the submitting agent, staff, or admin can generate this document."); const existing = found.financialDocuments?.find((document) => (type === "proforma" ? document.type === "invoice" && document.sourceId === paymentScheduleId : document.type === "quotation") && document.status === "issued"); if (existing) return { ok: true, data: { id: existing.id, documentNumber: existing.documentNumber, type, status: existing.status, signedUrl: `mock://generated-documents/${caseId}/${existing.id}.docx`, issueDate: existing.issueDate } }; const schedule = paymentScheduleId ? found.paymentSchedules?.find((item) => item.id === paymentScheduleId) : undefined; if (type === "proforma" && !schedule) return failure("VALIDATION_ERROR", "Select a payment schedule before generating its invoice."); const documentNumber = `${type === "quotation" ? "PROP" : "INV"}-MOCK-${(found.financialDocuments?.length ?? 0) + 1}`; const summary = { id: `document-${caseId}-${type}-${(found.financialDocuments?.length ?? 0) + 1}`, sourceId: type === "proforma" ? schedule?.id : undefined, documentNumber, type: type === "proforma" ? "invoice" as const : "quotation" as const, amountSen: schedule?.amountDueSen ?? found.saleAmountSen ?? 0, issueDate: now().slice(0, 10), status: "issued", createdAt: now() }; found.financialDocuments = [...(found.financialDocuments ?? []), summary]; return { ok: true, data: { id: summary.id, documentNumber, type, status: "issued", signedUrl: `mock://generated-documents/${caseId}/${summary.id}.docx`, issueDate: summary.issueDate } }; },
  async voidDocument(actor, caseId, documentId, reason) { const permission = staffOnly<CaseDetail>(actor); if (permission) return permission; if (!reason.trim()) return failure("VALIDATION_ERROR", "A void reason is required."); const found = caseStore.get(caseId); if (!found) return failure("NOT_FOUND", "Case not found."); const document = found.financialDocuments?.find((item) => item.id === documentId); if (!document) return failure("NOT_FOUND", "Document not found."); document.status = "cancelled"; recordActivity(found, actor, "document_voided", `${document.documentNumber} voided.` , reason); return { ok: true, data: found }; },
  async getDocumentUrl(actor, caseId, documentId) { const found = caseStore.get(caseId); if (!found) return failure("NOT_FOUND", "Case not found."); if (!access(actor, found)) return failure("FORBIDDEN", "You can only access your own case documents."); const document = found.documents.find((item) => item.id === documentId); if (!document) return failure("NOT_FOUND", "Document not found."); return { ok: true, data: document.file && typeof URL !== "undefined" ? URL.createObjectURL(document.file) : `mock://case-documents/${caseId}/${documentId}` }; },
};

export { caseDocumentConfig };

import { isSupabaseConfigured } from "./supabase-browser";
import { supabaseCasesRepository } from "./supabase-case-repository";
export const casesRepository: CasesRepository = isSupabaseConfigured() ? supabaseCasesRepository : mockCasesRepository;
