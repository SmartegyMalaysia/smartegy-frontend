import { mockDashboard } from "./mock-data";
import { caseDocumentConfig, validateCaseDocument } from "./document-config";
import { canDeleteCase } from "./case-workflow";
import type { AcceptTrialInput, CaseDetail, CaseDocumentInput, CasePayment, CaseSummary, CurrentUser, CreateCaseInput, GeneratePaymentScheduleInput, ID, RecordPaymentInput, UpdateCaseInput, VerifyPaymentInput, CaseStatus, PaymentStatus } from "./types";

type CaseErrorCode = "VALIDATION_ERROR" | "FORBIDDEN" | "NOT_FOUND" | "INTERNAL_ERROR" | "CONFLICT";
export type CaseResult<T> = { ok: true; data: T } | { ok: false; error: { code: CaseErrorCode; message: string; fieldErrors?: Record<string, string[]> } };
export interface CaseDirectoryQuery { search?: string; stage?: "new" | "under_review" | "changes_requested" | "quotation_payment" | "installation_monitoring" | "trial_review" | "commission_active" | "completed_cancelled"; paymentStatus?: PaymentStatus; agentId?: ID; page?: number; pageSize?: number; sortBy?: "updated" | "newest" | "amount"; sortDirection?: "asc" | "desc"; }
export interface CaseDirectoryPage { items: CaseSummary[]; totalItems: number; totalPages: number; agentOptions: Array<{ value: ID; label: string }>; }

const seededCases = mockDashboard("staff").cases;
const now = () => new Date().toISOString();
const money = (sen: number | null | undefined) => sen == null ? null : sen;
const staffRoles = new Set(["staff", "admin"]);
const allowedTransitions: Partial<Record<CaseStatus, CaseStatus[]>> = {
  under_review: ["quotation_issued", "changes_requested", "cancelled"],
  changes_requested: ["under_review", "cancelled"],
  quotation_issued: ["awaiting_deposit", "cancelled"],
  awaiting_deposit: ["installation_scheduled", "cancelled"],
  installation_scheduled: ["installed_monitoring", "cancelled"],
  installed_monitoring: ["trial_review", "cancelled"],
  trial_review: ["active_installments", "cancelled"],
  active_installments: ["completed", "cancelled"],
};

const caseStore = new Map<ID, CaseDetail>(seededCases.map((item) => [item.id, {
  ...item,
  customer: { id: `customer-${item.id}`, displayName: item.customerDisplayName, companyRegistrationNumber: null, contactName: null, email: null, phone: null },
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
  recordPayment(actor: CurrentUser, caseId: ID, input: RecordPaymentInput): Promise<CaseResult<CaseDetail>>;
  recordAndVerifyPayment(actor: CurrentUser, caseId: ID, input: RecordPaymentInput): Promise<CaseResult<CaseDetail>>;
  verifyPayment(actor: CurrentUser, input: VerifyPaymentInput): Promise<CaseResult<CaseDetail>>;
  recordInstallation(actor: CurrentUser, caseId: ID, installationDate: ISODate): Promise<CaseResult<CaseDetail>>;
  verifySavings(actor: CurrentUser, caseId: ID, savingsKwh: number, monthlySavingsSen: MoneySen): Promise<CaseResult<CaseDetail>>;
  acceptTrial(actor: CurrentUser, caseId: ID, input: AcceptTrialInput): Promise<CaseResult<CaseDetail>>;
  getDocumentUrl(actor: CurrentUser, caseId: ID, documentId: ID): Promise<CaseResult<string>>;
}

type ISODate = string;
type MoneySen = number;

export const mockCasesRepository: CasesRepository = {
  async listPage(actor, query) {
    const all = Array.from(caseStore.values()).filter((item) => actor.role !== "agent" || item.agentId === actor.agentId);
    const term = query.search?.trim().toLowerCase() ?? "";
    const stageMatch = (item: CaseSummary) => !query.stage || (query.stage === "new" ? ["draft", "submitted"].includes(item.status) : query.stage === "under_review" ? item.status === "under_review" : query.stage === "changes_requested" ? item.status === "changes_requested" : query.stage === "quotation_payment" ? ["quotation_issued", "awaiting_deposit"].includes(item.status) : query.stage === "installation_monitoring" ? ["installation_scheduled", "installed_monitoring"].includes(item.status) : query.stage === "trial_review" ? item.status === "trial_review" : query.stage === "commission_active" ? item.status === "active_installments" : ["completed", "cancelled"].includes(item.status));
    const filtered = all.filter((item) => (!term || `${item.caseNumber} ${item.customerDisplayName} ${item.agentName}`.toLowerCase().includes(term)) && stageMatch(item) && (!query.paymentStatus || item.paymentStatus === query.paymentStatus) && (!query.agentId || item.agentId === query.agentId));
    const direction = query.sortDirection === "asc" ? 1 : -1;
    const sorted = [...filtered].sort((a, b) => (query.sortBy === "amount" ? (a.saleAmountSen ?? 0) - (b.saleAmountSen ?? 0) : query.sortBy === "newest" ? a.submittedAt.localeCompare(b.submittedAt) : a.updatedAt.localeCompare(b.updatedAt)) * direction);
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
    if (!input.service.siteAddress.trim()) fieldErrors.siteAddress = ["Enter the service address."];
    if (!input.documents.some((document) => document.type === "electricity_bill")) fieldErrors.electricityBill = ["Upload the latest electricity bill before submitting."];
    input.documents.forEach((document) => { const error = validateDocument(document); if (error) fieldErrors[document.type] = [error]; });
    if (Object.keys(fieldErrors).length) return failure("VALIDATION_ERROR", "Check the required case details and documents.", fieldErrors);
    const id = `case-${String(caseStore.size + 1).padStart(3, "0")}`;
    const submittedAt = now();
    onUploadProgress?.(10);
    await new Promise((resolve) => setTimeout(resolve, 60));
    const created: CaseDetail = { id, caseNumber: nextCaseNumber(), customerDisplayName: input.customer.displayName.trim(), agentId: actor.agentId, agentName: actor.displayName, status: "under_review", paymentStatus: "not_recorded", saleAmountSen: null, submittedAt, updatedAt: submittedAt, customer: { id: `customer-${id}`, displayName: input.customer.displayName.trim(), companyRegistrationNumber: null, contactName: input.customer.contactName?.trim() || null, email: input.customer.email?.trim() || null, phone: input.customer.phone?.trim() || null }, service: { siteAddress: input.service.siteAddress.trim(), addressLine1: input.service.addressLine1?.trim() ?? "", addressLine2: input.service.addressLine2?.trim() ?? "", postcode: input.service.postcode?.trim() ?? "", city: input.service.city?.trim() ?? "", state: input.service.state?.trim() ?? "", electricityAccountNumber: null, notes: input.service.notes?.trim() || null }, documents: input.documents.map((document, index) => ({ id: `document-${id}-${index + 1}`, caseId: id, ...document, uploadedBy: actor.id, uploadedAt: submittedAt })), quote: null, verifiedSavings: null, paymentSchedules: [], payments: [], financialDocuments: [], commissionIds: [], activity: [{ id: `activity-${id}`, action: "case_submitted", actorDisplayName: actor.displayName, occurredAt: submittedAt, summary: "Case submitted and is ready for staff review." }] };
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
    if (actor.role === "agent") { if (found.status !== "changes_requested" || to !== "under_review") return failure("FORBIDDEN", "Agents may only resubmit a case that has requested changes."); }
    else if (!staffRoles.has(actor.role)) return failure("FORBIDDEN", "Staff or admin access is required.");
    if (!allowedTransitions[found.status]?.includes(to)) return failure("VALIDATION_ERROR", `Invalid case transition from ${found.status} to ${to}.`);
    if ((to === "changes_requested" || to === "cancelled") && !reason?.trim()) return failure("VALIDATION_ERROR", `${to === "cancelled" ? "A cancellation" : "A change request"} reason is required.`);
    if (to === "quotation_issued" && (!found.quote?.saleAmountSen || !found.quote.quotedMonthlySavingsSen)) return failure("VALIDATION_ERROR", "Sale amount and quoted monthly savings are required before quotation.");
    if (to === "awaiting_deposit" && !found.paymentSchedules?.length) return failure("VALIDATION_ERROR", "Generate the initial payment schedule before issuing the quotation.");
    if (to === "installation_scheduled" && found.paymentSchedules?.find((schedule) => schedule.kind === "deposit")?.status !== "paid") return failure("VALIDATION_ERROR", "The deposit must be verified before installation can be scheduled.");
    if (to === "trial_review" && !found.verifiedSavings?.verifiedAt) return failure("VALIDATION_ERROR", "Verified savings are required before trial review.");
    if (to === "completed" && found.paymentSchedules?.some((schedule) => schedule.kind === "installment" && schedule.status !== "paid")) return failure("VALIDATION_ERROR", "All installment obligations must be paid before completion.");
    const from = found.status; found.status = to; found.paymentStatus = found.paymentSchedules?.length && found.paymentSchedules.every((schedule) => schedule.status === "paid") ? "verified" : found.paymentSchedules?.length ? "pending_verification" : "not_recorded"; recordActivity(found, actor, "status_changed", `${from} → ${to}`, reason); return { ok: true, data: found };
  },
  async requestChanges(actor, caseId, reason) { return this.transition(actor, caseId, "changes_requested", reason); },
  async cancel(actor, caseId, reason) { return this.transition(actor, caseId, "cancelled", reason); },
  async generatePaymentSchedule(actor, caseId, input) {
    const permission = staffOnly<CaseDetail>(actor); if (permission) return permission; const found = caseStore.get(caseId); if (!found) return failure("NOT_FOUND", "Case not found."); if (found.status !== "quotation_issued") return failure("VALIDATION_ERROR", "A payment schedule can only be generated for a quotation."); if (found.paymentSchedules?.length) return failure("CONFLICT", "A payment schedule already exists."); if (!found.quote?.quotedMonthlySavingsSen || !found.saleAmountSen) return failure("VALIDATION_ERROR", "Sale amount and quoted monthly savings are required."); const initial = found.quote.quotedMonthlySavingsSen; found.paymentSchedules = [{ id: `schedule-${caseId}-1`, caseId, sequence: 1, kind: "deposit", dueDate: input.depositDue, amountDueSen: initial, amountPaidSen: 0, status: "scheduled" }, { id: `schedule-${caseId}-2`, caseId, sequence: 2, kind: "post_installation", dueDate: input.postInstallationDue, amountDueSen: initial * 2, amountPaidSen: 0, status: "scheduled" }]; recordActivity(found, actor, "payment_schedule_generated", "Initial payment schedule generated."); return this.transition(actor, caseId, "awaiting_deposit", "Quotation issued; payment schedule generated.");
  },
  async recordPayment(actor, caseId, input) { const permission = staffOnly<CaseDetail>(actor); if (permission) return permission; const found = caseStore.get(caseId); if (!found) return failure("NOT_FOUND", "Case not found."); const payment: CasePayment = { id: `payment-${caseId}-${(found.payments?.length ?? 0) + 1}`, caseId, amountSen: input.amountSen, paymentDate: input.paymentDate, reference: input.reference ?? null, status: "pending_verification", recordedBy: actor.id, recordedAt: now(), verifiedBy: null, verifiedAt: null }; found.payments = [...(found.payments ?? []), payment]; found.paymentStatus = "pending_verification"; recordActivity(found, actor, "payment_recorded", "Payment recorded and awaiting verification."); return { ok: true, data: found }; },
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
  async verifyPayment(actor, input) { const permission = staffOnly<CaseDetail>(actor); if (permission) return permission; const owner = Array.from(caseStore.values()).find((item: CaseDetail) => item.payments?.some((payment: CasePayment) => payment.id === input.paymentId)); if (!owner) return failure("NOT_FOUND", "Payment not found."); const payment = owner.payments?.find((item: CasePayment) => item.id === input.paymentId); if (!payment || payment.status !== "pending_verification") return failure("VALIDATION_ERROR", "Payment is not pending verification."); if (input.allocations.reduce((sum, allocation) => sum + allocation.amountSen, 0) !== payment.amountSen) return failure("VALIDATION_ERROR", "Allocations must equal the payment amount."); for (const allocation of input.allocations) { const schedule = owner.paymentSchedules?.find((item) => item.id === allocation.scheduleId); if (!schedule || schedule.amountPaidSen + allocation.amountSen > schedule.amountDueSen) return failure("VALIDATION_ERROR", "Payment allocation exceeds the schedule balance."); schedule.amountPaidSen += allocation.amountSen; schedule.status = schedule.amountPaidSen === schedule.amountDueSen ? "paid" : "partially_paid"; } payment.status = "verified"; payment.verifiedBy = actor.id; payment.verifiedAt = now(); owner.paymentStatus = "verified"; recordActivity(owner, actor, "payment_verified", "Payment verified."); const installments = owner.paymentSchedules?.filter((schedule) => schedule.kind === "installment") ?? []; if (owner.status === "active_installments" && installments.length > 0 && installments.every((schedule) => schedule.status === "paid")) return this.transition(actor, owner.id, "completed", "All instalment obligations paid."); return { ok: true, data: owner }; },
  async recordInstallation(actor, caseId, installationDate) { const permission = staffOnly<CaseDetail>(actor); if (permission) return permission; const found = caseStore.get(caseId); if (!found) return failure("NOT_FOUND", "Case not found."); if (found.status !== "installation_scheduled") return failure("VALIDATION_ERROR", "Case must be installation scheduled."); found.installationDate = installationDate; found.monitoringStartedOn = installationDate; const result = await this.transition(actor, caseId, "installed_monitoring", "Installation completed"); return result; },
  async verifySavings(actor, caseId, savingsKwh, monthlySavingsSen) { const permission = staffOnly<CaseDetail>(actor); if (permission) return permission; const found = caseStore.get(caseId); if (!found) return failure("NOT_FOUND", "Case not found."); if (savingsKwh < 0 || monthlySavingsSen < 0) return failure("VALIDATION_ERROR", "Savings cannot be negative."); if (!["installed_monitoring", "trial_review"].includes(found.status)) return failure("VALIDATION_ERROR", "Case is not in the monitoring workflow."); found.verifiedSavings = { savingsKwh, monthlySavingsSen, verifiedAt: now() }; recordActivity(found, actor, "savings_verified", "Savings verified."); return { ok: true, data: found }; },
  async acceptTrial(actor, caseId, input) { const permission = staffOnly<CaseDetail>(actor); if (permission) return permission; const found = caseStore.get(caseId); if (!found) return failure("NOT_FOUND", "Case not found."); if (found.status !== "trial_review") return failure("VALIDATION_ERROR", "Case must be in trial review."); if (!found.verifiedSavings?.verifiedAt) return failure("VALIDATION_ERROR", "Verified savings are required."); if (found.paymentSchedules?.some((schedule) => ["deposit", "post_installation"].includes(schedule.kind) && schedule.status !== "paid")) return failure("VALIDATION_ERROR", "All initial payment obligations must be verified."); if (found.commissionIds?.length) return failure("CONFLICT", "Commission has already been generated for this case."); const initial = found.paymentSchedules?.reduce((sum, item) => sum + item.amountDueSen, 0) ?? 0; const balance = (found.saleAmountSen ?? 0) - initial; const monthly = Math.floor(balance / input.termMonths); found.paymentSchedules = [...(found.paymentSchedules ?? []), ...Array.from({ length: input.termMonths }, (_, index) => ({ id: `schedule-${caseId}-${index + 3}`, caseId, sequence: index + 3, kind: "installment" as const, dueDate: input.installmentStart, amountDueSen: index === input.termMonths - 1 ? balance - monthly * (input.termMonths - 1) : monthly, amountPaidSen: 0, status: "scheduled" as const }))]; found.installmentTermMonths = input.termMonths; found.customerContinues = true; found.trialDecisionOn = now().slice(0, 10); found.commissionIds = [`commission-calculation-${caseId}`]; found.status = "active_installments"; found.paymentStatus = "pending_verification"; recordActivity(found, actor, "commission_generated", "Trial accepted; commission calculation generated."); return { ok: true, data: found }; },
  async getDocumentUrl(actor, caseId, documentId) { const found = caseStore.get(caseId); if (!found) return failure("NOT_FOUND", "Case not found."); if (!access(actor, found)) return failure("FORBIDDEN", "You can only access your own case documents."); if (!found.documents.some((document) => document.id === documentId)) return failure("NOT_FOUND", "Document not found."); return { ok: true, data: `mock://case-documents/${caseId}/${documentId}` }; },
};

export { caseDocumentConfig };

import { isSupabaseConfigured } from "./supabase-browser";
import { supabaseCasesRepository } from "./supabase-case-repository";
export const casesRepository: CasesRepository = isSupabaseConfigured() ? supabaseCasesRepository : mockCasesRepository;
