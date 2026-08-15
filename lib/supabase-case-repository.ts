import { getSupabaseBrowserClient, normalizeSupabaseError } from "./supabase-browser";
import type { CaseDetail, CaseDocument, CurrentUser, CreateCaseInput } from "./types";
import type { CaseResult, CasesRepository } from "./case-repository";

function failure<T>(error: { code?: string | null; message?: string | null }): CaseResult<T> {
  const normalized = normalizeSupabaseError(error);
  return { ok: false, error: { code: normalized.code as any, message: normalized.message } };
}

function moneyToSen(value: unknown) { return value == null ? null : Math.round(Number(value) * 100); }
function caseStatus(value: string) {
  if (value === "quotation_issued" || value === "awaiting_deposit") return "pending_payment";
  if (value === "installation_scheduled" || value === "installed_monitoring" || value === "trial_review" || value === "active_installments") return "active";
  if (value === "cancelled") return "completed";
  return value;
}

async function loadCase(caseId: string): Promise<CaseDetail> {
  const supabase = getSupabaseBrowserClient(); if (!supabase) throw new Error("Supabase is not configured");
  const [{ data: row, error }, { data: baseCase, error: baseError }] = await Promise.all([
    supabase.from("case_overview").select("*").eq("id", caseId).single(),
    supabase.from("cases").select("customer_id").eq("id", caseId).single(),
  ]);
  if (error) throw error;
  if (baseError) throw baseError;
  const [customer, documents, statusHistory, payments, financialDocuments, schedules] = await Promise.all([
    supabase.from("customers").select("*").eq("id", baseCase.customer_id).single(),
    supabase.from("case_documents").select("*").eq("case_id", caseId).order("created_at", { ascending: false }),
    supabase.from("case_status_history").select("*").eq("case_id", caseId).order("changed_at", { ascending: true }),
    supabase.from("payments").select("*").eq("case_id", caseId).order("paid_on", { ascending: false }),
    supabase.from("financial_documents").select("*").eq("case_id", caseId).order("created_at", { ascending: false }),
    supabase.from("payment_schedules").select("*").eq("case_id", caseId).order("sequence_no", { ascending: true }),
  ]);
  const docs: CaseDocument[] = (documents.data ?? []).map((doc: any) => ({ id: doc.id, caseId: doc.case_id, type: doc.type === "supporting" ? "supporting_document" : doc.type, fileName: doc.original_filename, mimeType: doc.mime_type, sizeBytes: Number(doc.size_bytes ?? 0), uploadedBy: doc.uploaded_by ?? "system", uploadedAt: doc.uploaded_at ?? doc.created_at }));
  const outstanding = (schedules.data ?? []).reduce((sum: number, schedule: any) => sum + Number(schedule.amount_due) - Number(schedule.amount_paid), 0);
  const paymentStatus = schedules.data?.length ? (outstanding <= 0 ? "verified" : "pending_verification") : "not_recorded";
  return {
    id: row.id, caseNumber: row.case_number, customerDisplayName: row.customer_name, agentId: row.agent_id,
    agentName: row.agent_name, status: caseStatus(row.status) as any, paymentStatus: paymentStatus as any,
    saleAmountSen: moneyToSen(row.sale_amount), submittedAt: row.created_at, updatedAt: row.status_changed_at,
    customer: { id: baseCase.customer_id, displayName: row.customer_name, companyRegistrationNumber: row.registration_number, contactName: row.contact_name, email: customer.data?.email ?? null, phone: customer.data?.phone ?? null },
    service: { siteAddress: customer.data?.site_address ?? "", electricityAccountNumber: null, notes: null },
    documents: docs,
    activity: (statusHistory.data ?? []).map((event: any) => ({ id: String(event.id), action: "status_changed", actorDisplayName: event.changed_by ?? "System", occurredAt: event.changed_at, summary: `${event.from_status ?? "Created"} → ${event.to_status}` })),
    payments: (payments.data ?? []).map((payment: any) => ({ id: payment.id, caseId: payment.case_id, amountSen: moneyToSen(payment.amount) ?? 0, paymentDate: payment.paid_on, reference: payment.reference, status: payment.status, recordedBy: payment.submitted_by ?? "system", recordedAt: payment.created_at, verifiedBy: payment.verified_by, verifiedAt: payment.verified_at })),
    financialDocuments: (financialDocuments.data ?? []).map((doc: any) => ({ id: doc.id, documentNumber: doc.number, type: doc.type === "proforma" ? "invoice" : "receipt", caseId: doc.case_id, caseNumber: row.case_number, customerDisplayName: row.customer_name, amountSen: moneyToSen(doc.issued_snapshot?.amount) ?? 0, issueDate: doc.issued_at?.slice(0, 10) ?? doc.created_at.slice(0, 10), status: doc.status === "void" ? "cancelled" : doc.status, createdAt: doc.created_at })),
    commissionIds: [],
  } as CaseDetail;
}

export const supabaseCasesRepository: CasesRepository = {
  async getById(_actor: CurrentUser, caseId) {
    try { return { ok: true, data: await loadCase(caseId) }; } catch (error) { return failure(error as any); }
  },
  async create(actor, input: CreateCaseInput, onUploadProgress) {
    const supabase = getSupabaseBrowserClient(); if (!supabase) return failure({ message: "Supabase is not configured" });
    if (!actor.agentId) return failure({ code: "42501", message: "An active Agent account is required." });
    const { data: created, error } = await supabase.rpc("create_case", {
      p_customer: { legal_name: input.customer.displayName, contact_name: input.customer.contactName || input.customer.displayName, email: input.customer.email, phone: input.customer.phone, billing_address: input.service.siteAddress || "Not provided", site_address: input.service.siteAddress },
      p_case: {}, p_agent_id: actor.agentId,
    });
    if (error) return failure(error);
    const caseId = (created as any).id;
    onUploadProgress?.(10);
    for (let index = 0; index < input.documents.length; index += 1) {
      const document = input.documents[index];
      const { data: registered, error: registerError } = await supabase.rpc("register_case_document", { p_case_id: caseId, p_type: document.type === "supporting_document" ? "supporting" : "electricity_bill", p_original_filename: document.fileName, p_mime_type: document.mimeType, p_visible_to_agent: true });
      if (registerError) return failure(registerError);
      const metadata = (registered as any[])[0] ?? registered as any;
      if (!document.file) return failure({ message: `File data is missing for ${document.fileName}.` });
      const { error: uploadError } = await supabase.storage.from(metadata.bucket_id).upload(metadata.object_path, document.file, { contentType: document.mimeType, upsert: false });
      if (uploadError) return failure(uploadError);
      const { error: finalizeError } = await supabase.rpc("finalize_case_document", { p_document_id: metadata.document_id ?? metadata.id, p_size_bytes: document.sizeBytes });
      if (finalizeError) return failure(finalizeError);
      onUploadProgress?.(20 + Math.round(((index + 1) / input.documents.length) * 75));
    }
    const transitioned = await supabase.rpc("transition_case", { p_case_id: caseId, p_to: "submitted", p_reason: null });
    if (transitioned.error) return failure(transitioned.error);
    return { ok: true, data: await loadCase(caseId) };
  },
};
