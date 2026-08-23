import { getSupabaseBrowserClient, normalizeSupabaseError } from "./supabase-browser";
import type { AcceptTrialInput, AcceptanceInput, CaseDetail, CaseDocument, CaseStatus, CurrentUser, CreateCaseInput, GeneratedDocumentResult, GeneratePaymentScheduleInput, ID, ProposalInput, RecordPaymentInput, UpdateCaseInput, VerifyPaymentInput } from "./types";
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
  const [{ data: customer, error: customerError }, { data: documents, error: documentsError }, { data: history, error: historyError }, { data: payments, error: paymentsError }, { data: financialDocuments, error: financialError }, { data: schedules, error: schedulesError }, { data: commissions, error: commissionsError }, { data: proposalRows, error: proposalError }] = await Promise.all([
    supabase.from("customers").select("*").eq("id", baseCase.customer_id).single(),
    supabase.from("case_documents").select("*").eq("case_id", caseId).order("created_at", { ascending: false }),
    supabase.from("case_status_history").select("*").eq("case_id", caseId).order("changed_at", { ascending: true }),
    supabase.from("payments").select("*").eq("case_id", caseId).order("paid_on", { ascending: false }),
    supabase.from("financial_documents").select("*").eq("case_id", caseId).order("created_at", { ascending: false }),
    supabase.from("payment_schedules").select("*").eq("case_id", caseId).order("sequence_no", { ascending: true }),
    supabase.from("commission_entries").select("id,calculation_id").eq("case_id", caseId),
    supabase.from("proposals").select("*").eq("case_id", caseId).order("version", { ascending: false }).limit(1),
  ]);
  if (customerError || documentsError || historyError || paymentsError || financialError || schedulesError || commissionsError || proposalError) throw customerError ?? documentsError ?? historyError ?? paymentsError ?? financialError ?? schedulesError ?? commissionsError ?? proposalError;
  const proposalRow: any = proposalRows?.[0] ?? null;
  const { data: proposalReadings, error: proposalReadingsError } = proposalRow ? await supabase.from("proposal_energy_readings").select("*").eq("proposal_id", proposalRow.id).order("sequence_no", { ascending: true }) : { data: [], error: null };
  if (proposalReadingsError) throw proposalReadingsError;
  const docs: CaseDocument[] = (documents ?? []).map((doc: any) => ({ id: doc.id, caseId: doc.case_id, type: doc.type === "supporting" ? "supporting_document" : doc.type === "proforma" ? "invoice" : doc.type, fileName: doc.original_filename, mimeType: doc.mime_type, sizeBytes: Number(doc.size_bytes ?? 0), uploadedBy: doc.uploaded_by ?? "system", uploadedAt: doc.uploaded_at ?? doc.created_at, bucketId: doc.bucket_id, objectPath: doc.object_path, visibleToAgent: doc.visible_to_agent }));
  const scheduleRows = (schedules ?? []).map((item: any) => ({ id: item.id, caseId: item.case_id, sequence: Number(item.sequence_no), kind: item.kind, dueDate: item.due_date, amountDueSen: moneyToSen(item.amount_due) ?? 0, amountPaidSen: moneyToSen(item.amount_paid) ?? 0, status: item.status }));
  const outstanding = scheduleRows.reduce((sum: number, item: any) => sum + item.amountDueSen - item.amountPaidSen, 0);
  return {
    id: row.id, caseNumber: row.case_number, customerDisplayName: row.customer_name, agentId: row.agent_id, agentName: row.agent_name, status: status(row.status), paymentStatus: scheduleRows.length ? (outstanding <= 0 ? "verified" : "pending_verification") : "not_recorded", saleAmountSen: moneyToSen(row.sale_amount), submittedAt: row.created_at, updatedAt: row.status_changed_at,
    customer: { id: baseCase.customer_id, displayName: row.customer_name, companyRegistrationNumber: row.registration_number, contactName: row.contact_name, email: customer?.email ?? null, phone: customer?.phone ?? null },
    service: { siteAddress: customer?.site_address ?? customer?.billing_address ?? "", addressLine1: customer?.address_line_1 ?? "", addressLine2: customer?.address_line_2 ?? "", postcode: customer?.postcode ?? "", city: customer?.city ?? "", state: customer?.state ?? "", electricityAccountNumber: null, notes: baseCase.service_notes ?? null },
    documents: docs,
    proposal: proposalRow ? { id: proposalRow.id, caseId: proposalRow.case_id, version: Number(proposalRow.version), reference: proposalRow.reference, status: proposalRow.status, proposalDate: proposalRow.proposal_date, salesRepName: proposalRow.sales_rep_name, saleAmountSen: moneyToSen(proposalRow.sale_amount) ?? 0, deposit1Sen: moneyToSen(proposalRow.deposit_1) ?? 0, deposit2Sen: moneyToSen(proposalRow.deposit_2) ?? 0, downpaymentTotalSen: moneyToSen(proposalRow.downpayment_total) ?? 0, balanceSen: moneyToSen(proposalRow.balance) ?? 0, option1MonthlySen: moneyToSen(proposalRow.option_1_monthly) ?? 0, option2MonthlySen: moneyToSen(proposalRow.option_2_monthly) ?? 0, avgRate: Number(proposalRow.avg_rate), avgKwh: Number(proposalRow.avg_kwh), avgBillSen: moneyToSen(proposalRow.avg_bill) ?? 0, avgDayKwh: Number(proposalRow.avg_day_kwh), beforeInstallKwh: Number(proposalRow.before_install_kwh), afterInstallKwh: Number(proposalRow.after_install_kwh), savingKwhMonth: Number(proposalRow.saving_kwh_month), savingRmMonthSen: moneyToSen(proposalRow.saving_rm_month) ?? 0, savingRmYearSen: moneyToSen(proposalRow.saving_rm_year) ?? 0, savingRm2YSen: moneyToSen(proposalRow.saving_rm_2y) ?? 0, savingRm15YSen: moneyToSen(proposalRow.saving_rm_15y) ?? 0, acceptedByName: proposalRow.accepted_by_name, acceptanceDate: proposalRow.acceptance_date, selectedTermMonths: proposalRow.selected_term_months, signedDocumentId: proposalRow.signed_document_id, issuedAt: proposalRow.issued_at, acceptedAt: proposalRow.accepted_at } : null,
    proposalReadings: (proposalReadings ?? []).map((reading: any) => ({ sequence: Number(reading.sequence_no), month: reading.month_label, tnbRate: Number(reading.tnb_rate), kwhUsed: Number(reading.kwh_used), billAmountSen: moneyToSen(reading.bill_amount) ?? 0, operationDays: Number(reading.operation_days), dailyKwh: Number(reading.daily_kwh) })),
    activity: (history ?? []).map((event: any) => ({ id: String(event.id), action: "status_changed", actorDisplayName: event.changed_by ?? "System", occurredAt: event.changed_at, summary: `${event.from_status ?? "Created"} → ${event.to_status}${event.reason ? ` — ${event.reason}` : ""}`, reason: event.reason ?? null })),
    quote: { saleAmountSen: moneyToSen(row.sale_amount), averageMonthlyKwh: baseCase.average_monthly_kwh == null ? null : Number(baseCase.average_monthly_kwh), averageTnbRate: baseCase.average_tnb_rate == null ? null : Number(baseCase.average_tnb_rate), quotedSavingsKwh: baseCase.quoted_savings_kwh == null ? null : Number(baseCase.quoted_savings_kwh), quotedMonthlySavingsSen: moneyToSen(baseCase.quoted_monthly_savings_rm) },
    verifiedSavings: { savingsKwh: baseCase.verified_savings_kwh == null ? null : Number(baseCase.verified_savings_kwh), monthlySavingsSen: moneyToSen(baseCase.verified_monthly_savings_rm), verifiedAt: baseCase.savings_verified_at ?? null },
    installationDate: baseCase.installation_date, monitoringStartedOn: baseCase.monitoring_started_on, trialDecisionOn: baseCase.trial_decision_on, customerContinues: baseCase.customer_continues, installmentTermMonths: baseCase.installment_term_months,
    paymentSchedules: scheduleRows,
    payments: (payments ?? []).map((payment: any) => ({ id: payment.id, caseId: payment.case_id, amountSen: moneyToSen(payment.amount) ?? 0, paymentDate: payment.paid_on, reference: payment.reference, status: payment.status, recordedBy: payment.submitted_by ?? "system", recordedAt: payment.created_at, verifiedBy: payment.verified_by, verifiedAt: payment.verified_at })),
    financialDocuments: (financialDocuments ?? []).map((doc: any) => ({ id: doc.id, caseDocumentId: doc.case_document_id ?? undefined, sourceId: doc.payment_schedule_id ?? doc.payment_id ?? undefined, documentNumber: doc.number, type: doc.type === "proforma" ? "invoice" : doc.type === "quotation" ? "quotation" : "receipt", amountSen: moneyToSen(doc.issued_snapshot?.amount ?? doc.issued_snapshot?.payment_schedule?.amount_due ?? doc.issued_snapshot?.proposal?.sale_amount ?? doc.issued_snapshot?.payment?.amount) ?? 0, issueDate: doc.issued_at?.slice(0, 10) ?? doc.created_at.slice(0, 10), status: doc.status === "void" ? "cancelled" : doc.status, createdAt: doc.created_at })),
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
    const { data: created, error } = await supabase.rpc("create_case", { p_customer: { legal_name: input.customer.displayName, contact_name: input.customer.contactName || input.customer.displayName, email: input.customer.email, phone: input.customer.phone, billing_address: input.service.siteAddress || "Not provided", site_address: input.service.siteAddress, address_line_1: input.service.addressLine1, address_line_2: input.service.addressLine2, postcode: input.service.postcode, city: input.service.city, state: input.service.state, service_notes: input.service.notes }, p_case: {}, p_agent_id: actor.agentId }); if (error) return failure(error); const caseId = (created as any).id; onUploadProgress?.(10);
    for (let index = 0; index < input.documents.length; index += 1) { const document = input.documents[index]; if (!document.file) return failure({ message: `File data is missing for ${document.fileName}.` }); const signatureError = await validateFileSignature(document.file); if (signatureError) return failure({ message: `${document.fileName}: ${signatureError}` }); const { data: registered, error: registerError } = await supabase.rpc("register_case_document", { p_case_id: caseId, p_type: document.type === "supporting_document" ? "supporting" : "electricity_bill", p_filename: document.fileName, p_mime_type: document.mimeType, p_visible_to_agent: true }); if (registerError) return failure(registerError); const metadata = (registered as any[])[0] ?? registered as any; const { error: uploadError } = await supabase.storage.from(metadata.bucket_id).upload(metadata.object_path, document.file, { contentType: document.mimeType, upsert: false }); if (uploadError) return failure(uploadError); const { error: finalizeError } = await supabase.rpc("finalize_case_document", { p_document_id: metadata.document_id ?? metadata.id, p_size_bytes: document.sizeBytes }); if (finalizeError) return failure(finalizeError); onUploadProgress?.(20 + Math.round(((index + 1) / input.documents.length) * 75)); }
    const transitioned = await supabase.rpc("transition_case", { p_case_id: caseId, p_to: "under_review", p_reason: null }); if (transitioned.error) return failure(transitioned.error); return { ok: true, data: await loadCase(caseId) };
  },
  async update(_actor, caseId, input: UpdateCaseInput) { const customer = input.customer ?? {}; const service = input.service ?? {}; const quote = input.quote ?? {}; return rpcCase(_actor, "update_case_details", { p_case_id: caseId, p_customer: { legal_name: customer.displayName, registration_number: customer.companyRegistrationNumber, contact_name: customer.contactName, email: customer.email, phone: customer.phone, site_address: service.siteAddress, address_line_1: service.addressLine1, address_line_2: service.addressLine2, postcode: service.postcode, city: service.city, state: service.state }, p_case: { ...(service.notes == null ? {} : { service_notes: service.notes }), ...(quote.saleAmountSen == null ? {} : { sale_amount: moneyToRm(quote.saleAmountSen) }), ...(quote.averageMonthlyKwh == null ? {} : { average_monthly_kwh: quote.averageMonthlyKwh }), ...(quote.averageTnbRate == null ? {} : { average_tnb_rate: quote.averageTnbRate }), ...(quote.quotedSavingsKwh == null ? {} : { quoted_savings_kwh: quote.quotedSavingsKwh }), ...(quote.quotedMonthlySavingsSen == null ? {} : { quoted_monthly_savings_rm: moneyToRm(quote.quotedMonthlySavingsSen) }) } }, caseId); },
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
  async recordInstallation(_actor, caseId, installationDate) { return rpcCase(_actor, "record_installation", { p_case_id: caseId, p_installation_date: installationDate }, caseId); },
  async verifySavings(_actor, caseId, savingsKwh, monthlySavingsSen) { return rpcCase(_actor, "verify_case_savings", { p_case_id: caseId, p_savings_kwh: savingsKwh, p_monthly_savings_rm: monthlySavingsSen / 100 }, caseId); },
  async acceptTrial(_actor, caseId, input: AcceptTrialInput) { return rpcCase(_actor, "accept_trial_and_continue", { p_case_id: caseId, p_installment_start: input.installmentStart, p_term_months: input.termMonths }, caseId); },
  async saveProposalDraft(_actor, caseId, input: ProposalInput) {
    const supabase = getSupabaseBrowserClient(); if (!supabase) return failure<CaseDetail>({ message: "Supabase is not configured" });
    const { error } = await supabase.rpc("save_proposal_draft", { p_case_id: caseId, p_proposal: { sales_rep_name: input.salesRepName, proposal_date: input.proposalDate, sale_amount: input.saleAmountSen / 100 }, p_readings: input.readings.map((reading) => ({ month: reading.month, tnb_rate: reading.tnbRate, kwh_used: reading.kwhUsed, bill_amount: reading.billAmountSen / 100, operation_days: reading.operationDays, daily_kwh: reading.dailyKwh ?? null })) });
    if (error) return failure<CaseDetail>(error); return { ok: true, data: await loadCase(caseId) };
  },
  async issueProposal(_actor, caseId, input: ProposalInput) {
    const supabase = getSupabaseBrowserClient(); if (!supabase) return failure<CaseDetail>({ message: "Supabase is not configured" });
    const { data, error } = await supabase.functions.invoke("generate-document", { body: { case_id: caseId, type: "quotation", proposal: { sales_rep_name: input.salesRepName, proposal_date: input.proposalDate, sale_amount: input.saleAmountSen / 100 }, readings: input.readings.map((reading) => ({ month: reading.month, tnb_rate: reading.tnbRate, kwh_used: reading.kwhUsed, bill_amount: reading.billAmountSen / 100, operation_days: reading.operationDays, daily_kwh: reading.dailyKwh ?? null })) } });
    if (error) return failure<CaseDetail>(error); if (data?.error) return failure<CaseDetail>({ message: data.error }); return { ok: true, data: await loadCase(caseId) };
  },
  async acceptProposal(_actor, caseId, input: AcceptanceInput) {
    const supabase = getSupabaseBrowserClient(); if (!supabase) return failure<CaseDetail>({ message: "Supabase is not configured" });
    const { data: registered, error: registerError } = await supabase.rpc("register_case_document", { p_case_id: caseId, p_type: "signed_proposal", p_filename: input.signedProposal.name, p_mime_type: input.signedProposal.type || "application/pdf", p_visible_to_agent: true });
    if (registerError) return failure<CaseDetail>(registerError);
    const metadata: any = registered;
    const { error: uploadError } = await supabase.storage.from(metadata.bucket_id).upload(metadata.object_path, input.signedProposal, { contentType: input.signedProposal.type || "application/pdf", upsert: false });
    if (uploadError) return failure<CaseDetail>(uploadError);
    const { error: finalizeError } = await supabase.rpc("finalize_case_document", { p_document_id: metadata.id, p_size_bytes: input.signedProposal.size });
    if (finalizeError) return failure<CaseDetail>(finalizeError);
    const { data: accepted, error: acceptError } = await supabase.rpc("accept_proposal", { p_case_id: caseId, p_proposal_id: input.proposalId, p_accepted_by_name: input.acceptedByName, p_acceptance_date: input.acceptanceDate, p_selected_term_months: input.selectedTermMonths, p_signed_document_id: metadata.id });
    if (acceptError) return failure<CaseDetail>(acceptError);
    const document = accepted?.document as any;
    if (document?.status === "reserved") {
      const { data: generated, error: generationError } = await supabase.functions.invoke("generate-document", { body: { case_id: caseId, type: "proforma", payment_schedule_id: document.payment_schedule_id } });
      if (generationError) return failure<CaseDetail>(generationError); if (generated?.error) return failure<CaseDetail>({ message: generated.error });
    }
    return { ok: true, data: await loadCase(caseId) };
  },
  async voidProposal(_actor, caseId, proposalId, reason) { return rpcCase(_actor, "void_proposal", { p_proposal_id: proposalId, p_reason: reason }, caseId); },
  async generateFinancialDocument(_actor, caseId, type, paymentScheduleId, paymentId) {
    const supabase = getSupabaseBrowserClient(); if (!supabase) return failure<GeneratedDocumentResult>({ message: "Supabase is not configured" });
    const { data, error } = await supabase.functions.invoke("generate-document", { body: { case_id: caseId, type, payment_schedule_id: paymentScheduleId, payment_id: paymentId } });
    if (error) return failure<GeneratedDocumentResult>(error); if (data?.error || !data?.document) return failure<GeneratedDocumentResult>({ message: data?.error ?? "Document generation failed." });
    const document = data.document as any;
    return { ok: true, data: { id: document.id, documentNumber: document.number, type, status: document.status, signedUrl: data.signed_url ?? null, issueDate: document.issued_at?.slice(0, 10) ?? new Date().toISOString().slice(0, 10) } };
  },
  async voidDocument(_actor, caseId, documentId, reason) { return rpcCase(_actor, "void_financial_document", { p_financial_document_id: documentId, p_reason: reason }, caseId); },
  async getDocumentUrl(_actor, caseId, documentId) { try { const supabase = getSupabaseBrowserClient(); if (!supabase) return failure<string>({ message: "Supabase is not configured" }); const { data: document, error } = await supabase.from("case_documents").select("bucket_id,object_path").eq("case_id", caseId).eq("id", documentId).single(); if (error) return failure<string>(error); const { data, error: signedError } = await supabase.storage.from(document.bucket_id).createSignedUrl(document.object_path, 300); if (signedError) return failure<string>(signedError); return { ok: true, data: data.signedUrl }; } catch (error) { return failure<string>(error as any); } },
};
