import { getSupabaseBrowserClient, normalizeSupabaseError } from "./supabase-browser";
import type { AcceptTrialInput, CaseDetail, CaseDocument, CaseStatus, CurrentUser, CreateCaseInput, GeneratePaymentScheduleInput, ID, RecordPaymentInput, RejectPaymentInput, UpdateCaseInput, VerifyPaymentInput } from "./types";
import type { CaseDirectoryQuery, CaseResult, CasesRepository } from "./case-repository";
import { validateFileSignature } from "./document-config";

function failure<T>(error: { code?: string | null; message?: string | null }): CaseResult<T> { const normalized = normalizeSupabaseError(error); return { ok: false, error: { code: normalized.code as any, message: normalized.message } }; }
function moneyToSen(value: unknown) { return value == null ? null : Math.round(Number(value) * 100); }
function moneyToRm(value: number | null | undefined) { return value == null ? null : value / 100; }
function status(value: string) { return value as CaseStatus; }
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

async function loadCase(caseId: string): Promise<CaseDetail> {
  const supabase = getSupabaseBrowserClient(); if (!supabase) throw new Error("Supabase is not configured");
  const [{ data: row, error }, { data: baseCase, error: baseError }] = await Promise.all([
    supabase.from("case_overview").select("*").eq("id", caseId).single(),
    supabase.from("cases").select("*").eq("id", caseId).single(),
  ]);
  if (error) throw error; if (baseError) throw baseError;
  const [{ data: customer, error: customerError }, { data: documents, error: documentsError }, { data: history, error: historyError }, { data: payments, error: paymentsError }, { data: financialDocuments, error: financialError }, { data: schedules, error: schedulesError }, { data: commissions, error: commissionsError }] = await Promise.all([
    supabase.from("customers").select("*").eq("id", baseCase.customer_id).single(),
    supabase.from("case_documents").select("*").eq("case_id", caseId).order("created_at", { ascending: false }),
    supabase.from("case_status_history").select("*").eq("case_id", caseId).order("changed_at", { ascending: true }),
    supabase.from("payments").select("*").eq("case_id", caseId).order("paid_on", { ascending: false }),
    supabase.from("financial_documents").select("*").eq("case_id", caseId).order("created_at", { ascending: false }),
    supabase.from("payment_schedules").select("*").eq("case_id", caseId).order("sequence_no", { ascending: true }),
    supabase.from("commission_entries").select("id,calculation_id").eq("case_id", caseId),
  ]);
  if (customerError || documentsError || historyError || paymentsError || financialError || schedulesError || commissionsError) throw customerError ?? documentsError ?? historyError ?? paymentsError ?? financialError ?? schedulesError ?? commissionsError;
  const docs: CaseDocument[] = (documents ?? []).map((doc: any) => ({ id: doc.id, caseId: doc.case_id, type: doc.type === "supporting" ? "supporting_document" : doc.type === "proforma" ? "quotation" : doc.type, fileName: doc.original_filename, mimeType: doc.mime_type, sizeBytes: Number(doc.size_bytes ?? 0), uploadedBy: doc.uploaded_by ?? "system", uploadedAt: doc.uploaded_at ?? doc.created_at, bucketId: doc.bucket_id, objectPath: doc.object_path, visibleToAgent: doc.visible_to_agent }));
  const scheduleRows = (schedules ?? []).map((item: any) => ({ id: item.id, caseId: item.case_id, sequence: Number(item.sequence_no), kind: item.kind, dueDate: item.due_date, amountDueSen: moneyToSen(item.amount_due) ?? 0, amountPaidSen: moneyToSen(item.amount_paid) ?? 0, status: item.status }));
  const outstanding = scheduleRows.reduce((sum: number, item: any) => sum + item.amountDueSen - item.amountPaidSen, 0);
  return {
    id: row.id, caseNumber: row.case_number, customerDisplayName: row.customer_name, agentId: row.agent_id, agentName: row.agent_name, status: status(row.status), paymentStatus: scheduleRows.length ? (outstanding <= 0 ? "verified" : "pending_verification") : "not_recorded", saleAmountSen: moneyToSen(row.sale_amount), submittedAt: row.created_at, updatedAt: row.status_changed_at,
    customer: { id: baseCase.customer_id, displayName: row.customer_name, companyRegistrationNumber: row.registration_number, contactName: row.contact_name, email: customer?.email ?? null, phone: customer?.phone ?? null },
    service: { siteAddress: customer?.site_address ?? customer?.billing_address ?? "", electricityAccountNumber: null, notes: baseCase.service_notes ?? null },
    documents: docs,
    activity: (history ?? []).map((event: any) => ({ id: String(event.id), action: "status_changed", actorDisplayName: event.changed_by ?? "System", occurredAt: event.changed_at, summary: `${event.from_status ?? "Created"} → ${event.to_status}${event.reason ? ` — ${event.reason}` : ""}`, reason: event.reason ?? null })),
    quote: { saleAmountSen: moneyToSen(row.sale_amount), averageMonthlyKwh: baseCase.average_monthly_kwh == null ? null : Number(baseCase.average_monthly_kwh), averageTnbRate: baseCase.average_tnb_rate == null ? null : Number(baseCase.average_tnb_rate), quotedSavingsKwh: baseCase.quoted_savings_kwh == null ? null : Number(baseCase.quoted_savings_kwh), quotedMonthlySavingsSen: moneyToSen(baseCase.quoted_monthly_savings_rm) },
    verifiedSavings: { savingsKwh: baseCase.verified_savings_kwh == null ? null : Number(baseCase.verified_savings_kwh), monthlySavingsSen: moneyToSen(baseCase.verified_monthly_savings_rm), verifiedAt: baseCase.savings_verified_at ?? null },
    installationDate: baseCase.installation_date, installationProposedDate: baseCase.installation_proposed_date, installationProposedBy: baseCase.installation_proposed_by, installationProposedAt: baseCase.installation_proposed_at, installationConfirmedBy: baseCase.installation_confirmed_by, installationConfirmedAt: baseCase.installation_confirmed_at, installationDateFeedback: baseCase.installation_date_feedback, monitoringStartedOn: baseCase.monitoring_started_on, trialDecisionOn: baseCase.trial_decision_on, customerContinues: baseCase.customer_continues, installmentTermMonths: baseCase.installment_term_months,
    paymentSchedules: scheduleRows,
    payments: (payments ?? []).map((payment: any) => ({ id: payment.id, caseId: payment.case_id, amountSen: moneyToSen(payment.amount) ?? 0, paymentDate: payment.paid_on, reference: payment.reference, status: payment.status, recordedBy: payment.submitted_by ?? "system", recordedAt: payment.created_at, verifiedBy: payment.verified_by, verifiedAt: payment.verified_at })),
    financialDocuments: (financialDocuments ?? []).map((doc: any) => ({ id: doc.id, documentNumber: doc.number, type: doc.type === "proforma" ? "invoice" : "receipt", amountSen: moneyToSen(doc.issued_snapshot?.amount) ?? 0, issueDate: doc.issued_at?.slice(0, 10) ?? doc.created_at.slice(0, 10), status: doc.status === "void" ? "cancelled" : doc.status, createdAt: doc.created_at })),
    commissionIds: Array.from(new Set((commissions ?? []).map((entry: any) => entry.calculation_id ?? entry.id))),
  };
}

async function rpcCase(actor: CurrentUser, name: string, args: Record<string, unknown>, caseId: string) {
  const supabase = getSupabaseBrowserClient(); if (!supabase) return failure<CaseDetail>({ message: "Supabase is not configured" });
  const { error } = await supabase.rpc(name, args); if (error) return failure<CaseDetail>(error); return { ok: true, data: await loadCase(caseId) } as CaseResult<CaseDetail>;
}

export const supabaseCasesRepository: CasesRepository = {
  async listPage(actor, query: CaseDirectoryQuery) {
    const supabase = getSupabaseBrowserClient(); if (!supabase) return failure({ message: "Supabase is not configured" });
    const { data, error } = await supabase.rpc("list_case_directory", { p_search: query.search?.trim() || null, p_stage: query.stage ?? null, p_payment_status: query.paymentStatus ?? null, p_agent_id: query.agentId ?? null, p_page: query.page ?? 1, p_page_size: query.pageSize ?? 5, p_sort_by: query.sortBy ?? "updated", p_sort_direction: query.sortDirection ?? "desc" });
    if (error) return failure(error);
    const payload = data as Record<string, any>;
    const items = (payload.items ?? []).map((row: any) => ({ id: row.id, caseNumber: row.case_number, customerDisplayName: row.customer_name, agentId: row.agent_id, agentName: row.agent_name, status: status(row.status), paymentStatus: row.payment_status, saleAmountSen: moneyToSen(row.sale_amount), submittedAt: row.created_at, updatedAt: row.status_changed_at ?? row.created_at }));
    return { ok: true, data: { items, totalItems: Number(payload.total_items ?? 0), totalPages: Number(payload.total_pages ?? 1), agentOptions: (payload.agent_options ?? []).map((item: any) => ({ value: item.value, label: item.label })) } };
  },
  async export(actor, query: CaseDirectoryQuery) {
    const params = new URLSearchParams(); if (query.search) params.set("search", query.search); if (query.stage) params.set("stage", query.stage); if (query.paymentStatus) params.set("payment_status", query.paymentStatus); if (query.agentId) params.set("agent_id", query.agentId); if (query.sortBy) params.set("sort_by", query.sortBy); if (query.sortDirection) params.set("sort_direction", query.sortDirection);
    try { const response = await fetch(`/api/exports/cases?${params.toString()}`, { credentials: "same-origin" }); if (!response.ok) return failure({ code: response.status === 403 ? "42501" : "PGRST000", message: "Unable to export cases." }); const blob = await response.blob(); const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = "smartegy-cases.csv"; link.click(); URL.revokeObjectURL(link.href); return { ok: true, data: true }; } catch (error) { return failure(error as any); }
  },
  async getById(_actor, caseId) { try { return { ok: true, data: await loadCase(caseId) }; } catch (error) { return failure(error as any); } },
  async create(actor, input: CreateCaseInput, onUploadProgress) {
    const supabase = getSupabaseBrowserClient(); if (!supabase) return failure<CaseDetail>({ message: "Supabase is not configured" }); if (!actor.agentId) return failure<CaseDetail>({ code: "42501", message: "An active Agent account is required." });
    const { data: created, error } = await supabase.rpc("create_case", { p_customer: { legal_name: input.customer.displayName, contact_name: input.customer.contactName || input.customer.displayName, email: input.customer.email, phone: input.customer.phone, billing_address: input.service.siteAddress || "Not provided", site_address: input.service.siteAddress, service_notes: input.service.notes }, p_case: {}, p_agent_id: actor.agentId }); if (error) return failure(error); const caseId = (created as any).id; onUploadProgress?.(10);
    for (let index = 0; index < input.documents.length; index += 1) { const document = input.documents[index]; if (!document.file) return failure({ message: `File data is missing for ${document.fileName}.` }); const signatureError = await validateFileSignature(document.file); if (signatureError) return failure({ message: `${document.fileName}: ${signatureError}` }); const { data: registered, error: registerError } = await supabase.rpc("register_case_document", { p_case_id: caseId, p_type: document.type === "supporting_document" ? "supporting" : "electricity_bill", p_filename: document.fileName, p_mime_type: document.mimeType, p_visible_to_agent: true }); if (registerError) return failure(registerError); const metadata = (registered as any[])[0] ?? registered as any; const { error: uploadError } = await supabase.storage.from(metadata.bucket_id).upload(metadata.object_path, document.file, { contentType: document.mimeType, upsert: false }); if (uploadError) return failure(uploadError); const { error: finalizeError } = await supabase.rpc("finalize_case_document", { p_document_id: metadata.document_id ?? metadata.id, p_size_bytes: document.sizeBytes }); if (finalizeError) return failure(finalizeError); onUploadProgress?.(20 + Math.round(((index + 1) / input.documents.length) * 75)); }
    const transitioned = await supabase.rpc("transition_case", { p_case_id: caseId, p_to: "under_review", p_reason: null }); if (transitioned.error) return failure(transitioned.error); return { ok: true, data: await loadCase(caseId) };
  },
  async update(_actor, caseId, input: UpdateCaseInput) { const customer = input.customer ?? {}; const quote = input.quote ?? {}; return rpcCase(_actor, "update_case_details", { p_case_id: caseId, p_customer: { legal_name: customer.displayName, registration_number: customer.companyRegistrationNumber, contact_name: customer.contactName, email: customer.email, phone: customer.phone, site_address: input.service?.siteAddress }, p_case: { ...(input.service?.notes == null ? {} : { service_notes: input.service.notes }), ...(quote.saleAmountSen == null ? {} : { sale_amount: moneyToRm(quote.saleAmountSen) }), ...(quote.averageMonthlyKwh == null ? {} : { average_monthly_kwh: quote.averageMonthlyKwh }), ...(quote.averageTnbRate == null ? {} : { average_tnb_rate: quote.averageTnbRate }), ...(quote.quotedSavingsKwh == null ? {} : { quoted_savings_kwh: quote.quotedSavingsKwh }), ...(quote.quotedMonthlySavingsSen == null ? {} : { quoted_monthly_savings_rm: moneyToRm(quote.quotedMonthlySavingsSen) }) } }, caseId); },
  async deleteCase(_actor, caseId) {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return failure<{ id: string }>({ message: "Supabase is not configured" });
    const { data: documents, error: documentsError } = await supabase.from("case_documents").select("bucket_id,object_path").eq("case_id", caseId);
    if (documentsError) return failure<{ id: string }>(documentsError);
    const { data, error } = await supabase.rpc("delete_case", { p_case_id: caseId });
    if (error) return failure<{ id: string }>(error);
    for (const bucket of Array.from(new Set((documents ?? []).map((document: any) => document.bucket_id)))) {
      const paths = (documents ?? []).filter((document: any) => document.bucket_id === bucket).map((document: any) => document.object_path);
      if (!paths.length) continue;
      await supabase.storage.from(bucket).remove(paths);
    }
    return { ok: true, data: { id: (data as string | null) ?? caseId } };
  },
  async transition(_actor, caseId, to, reason) { return rpcCase(_actor, "transition_case", { p_case_id: caseId, p_to: to, p_reason: reason ?? null }, caseId); },
  async requestChanges(actor, caseId, reason) { return this.transition(actor, caseId, "changes_requested", reason); },
  async cancel(actor, caseId, reason) { return this.transition(actor, caseId, "cancelled", reason); },
  async generatePaymentSchedule(_actor, caseId, input: GeneratePaymentScheduleInput) { return rpcCase(_actor, "generate_initial_payment_schedule", { p_case_id: caseId, p_deposit_due: input.depositDue, p_post_installation_due: input.postInstallationDue }, caseId); },
  async submitDeposit(_actor, caseId, input: RecordPaymentInput) { return rpcCase(_actor, "submit_deposit", { p_case_id: caseId, p_amount: input.amountSen / 100, p_paid_on: input.paymentDate, p_reference: input.reference ?? null }, caseId); },
  async recordPayment(_actor, caseId, input: RecordPaymentInput) { return rpcCase(_actor, "record_payment", { p_case_id: caseId, p_amount: input.amountSen / 100, p_paid_on: input.paymentDate, p_reference: input.reference ?? null, p_proof_document_id: null }, caseId); },
  async recordAndVerifyPayment(actor, caseId, input: RecordPaymentInput) {
    let current: CaseDetail;
    try { current = await loadCase(caseId); } catch (error) { return failure<CaseDetail>(error as any); }
    const allocations = automaticAllocations(current.paymentSchedules, input.amountSen);
    if (!allocations) return failure<CaseDetail>({ code: "VALIDATION_ERROR", message: "Payment amount exceeds the outstanding schedule balance." });
    const pending = current.payments?.find((payment) => payment.status === "pending_verification");
    if (pending) {
      if (pending.amountSen !== input.amountSen) return failure<CaseDetail>({ code: "VALIDATION_ERROR", message: "The pending payment amount cannot be changed after it has been recorded." });
      return this.verifyPayment(actor, { paymentId: pending.id, allocations });
    }
    const recorded = await this.recordPayment(actor, caseId, input);
    if (!recorded.ok) return recorded;
    const payment = recorded.data.payments?.find((item) => item.status === "pending_verification");
    if (!payment) return failure<CaseDetail>({ message: "The payment could not be prepared for confirmation." });
    return this.verifyPayment(actor, { paymentId: payment.id, allocations });
  },
  async verifyPayment(_actor, input: VerifyPaymentInput) { const supabase = getSupabaseBrowserClient(); if (!supabase) return failure<CaseDetail>({ message: "Supabase is not configured" }); const { data: payment, error } = await supabase.rpc("verify_payment", { p_payment_id: input.paymentId, p_allocations: input.allocations.map((allocation) => ({ schedule_id: allocation.scheduleId, amount: allocation.amountSen / 100 })) }); if (error) return failure(error); const paymentCase = (payment as any)?.case_id; if (!paymentCase) return failure<CaseDetail>({ message: "Verified payment did not return its case." }); return { ok: true, data: await loadCase(paymentCase) }; },
  async rejectPayment(_actor, input: RejectPaymentInput) { const supabase = getSupabaseBrowserClient(); if (!supabase) return failure<CaseDetail>({ message: "Supabase is not configured" }); const { data: payment, error } = await supabase.rpc("reject_payment", { p_payment_id: input.paymentId, p_reason: input.reason }); if (error) return failure(error); const paymentCase = (payment as any)?.case_id; if (!paymentCase) return failure<CaseDetail>({ message: "Rejected payment did not return its case." }); return { ok: true, data: await loadCase(paymentCase) }; },
  async proposeInstallationDate(_actor, caseId, installationDate) { return rpcCase(_actor, "propose_installation_date", { p_case_id: caseId, p_installation_date: installationDate }, caseId); },
  async respondToInstallationDate(_actor, caseId, confirmed, reason) { return rpcCase(_actor, "respond_to_installation_date", { p_case_id: caseId, p_confirmed: confirmed, p_reason: reason ?? null }, caseId); },
  async recordInstallation(_actor, caseId, installationDate) { return rpcCase(_actor, "record_installation", { p_case_id: caseId, p_installation_date: installationDate }, caseId); },
  async verifySavings(_actor, caseId, savingsKwh, monthlySavingsSen) { return rpcCase(_actor, "verify_case_savings", { p_case_id: caseId, p_savings_kwh: savingsKwh, p_monthly_savings_rm: monthlySavingsSen / 100 }, caseId); },
  async acceptTrial(_actor, caseId, input: AcceptTrialInput) { return rpcCase(_actor, "accept_trial_and_continue", { p_case_id: caseId, p_installment_start: input.installmentStart, p_term_months: input.termMonths }, caseId); },
  async getDocumentUrl(_actor, caseId, documentId) { try { const supabase = getSupabaseBrowserClient(); if (!supabase) return failure<string>({ message: "Supabase is not configured" }); const { data: document, error } = await supabase.from("case_documents").select("bucket_id,object_path").eq("case_id", caseId).eq("id", documentId).single(); if (error) return failure<string>(error); const { data, error: signedError } = await supabase.storage.from(document.bucket_id).createSignedUrl(document.object_path, 300); if (signedError) return failure<string>(signedError); return { ok: true, data: data.signedUrl }; } catch (error) { return failure<string>(error as any); } },
};
