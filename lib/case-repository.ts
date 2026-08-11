import { mockDashboard } from "./mock-data";
import { caseDocumentConfig, validateCaseDocument } from "./document-config";
import type { CaseDetail, CaseDocumentInput, CurrentUser, CreateCaseInput, ID } from "./types";

type CaseResult<T> = { ok: true; data: T } | { ok: false; error: { code: "VALIDATION_ERROR" | "FORBIDDEN" | "NOT_FOUND" | "INTERNAL_ERROR"; message: string; fieldErrors?: Record<string, string[]> } };

const seededCases = mockDashboard("staff").cases;
const caseStore = new Map<ID, CaseDetail>(seededCases.map((item) => [item.id, {
  ...item,
  customer: { id: `customer-${item.id}`, displayName: item.customerDisplayName, companyRegistrationNumber: null, contactName: null, email: null, phone: null },
  service: { siteAddress: "Not provided in mock data", electricityAccountNumber: null, notes: null },
  documents: [],
  activity: [{ id: `activity-${item.id}`, action: "case_created", actorDisplayName: item.agentName, occurredAt: item.submittedAt, summary: "Case submitted for staff review." }],
}]));

function failure<T>(code: "VALIDATION_ERROR" | "FORBIDDEN" | "NOT_FOUND" | "INTERNAL_ERROR", message: string, fieldErrors?: Record<string, string[]>): CaseResult<T> { return { ok: false, error: { code, message, ...(fieldErrors ? { fieldErrors } : {}) } }; }
function now() { return new Date().toISOString(); }
function nextCaseNumber() { return `SMG-${String(caseStore.size + 128).padStart(5, "0")}`; }
function validateDocument(document: CaseDocumentInput) { const error = validateCaseDocument({ name: document.fileName, type: document.mimeType, size: document.sizeBytes }, document.type); return error; }

export interface CasesRepository {
  getById(actor: CurrentUser, caseId: ID): Promise<CaseResult<CaseDetail>>;
  create(actor: CurrentUser, input: CreateCaseInput, onUploadProgress?: (progress: number) => void): Promise<CaseResult<CaseDetail>>;
}

export const mockCasesRepository: CasesRepository = {
  async getById(actor, caseId) {
    await new Promise((resolve) => setTimeout(resolve, 90));
    const found = caseStore.get(caseId);
    if (!found) return failure("NOT_FOUND", "Case not found.");
    if (actor.role === "agent" && found.agentId !== actor.agentId) return failure("FORBIDDEN", "You can only access documents and case details for your own cases.");
    return { ok: true, data: found };
  },
  async create(actor, input, onUploadProgress) {
    if (actor.role !== "agent" || !actor.agentId) return failure("FORBIDDEN", "Only agents can submit a new case.");
    const fieldErrors: Record<string, string[]> = {};
    if (!input.customer.displayName.trim()) fieldErrors.customerName = ["Enter the customer or company name."];
    const electricityBill = input.documents.find((document) => document.type === "electricity_bill");
    if (!electricityBill) fieldErrors.electricityBill = ["Upload the latest electricity bill before submitting."];
    input.documents.forEach((document) => { const error = validateDocument(document); if (error) fieldErrors[document.type] = [error]; });
    if (Object.keys(fieldErrors).length) return failure("VALIDATION_ERROR", "Check the required case details and documents.", fieldErrors);
    const id = `case-${String(caseStore.size + 1).padStart(3, "0")}`;
    const submittedAt = now();
    const caseNumber = nextCaseNumber();
    onUploadProgress?.(10);
    await new Promise((resolve) => setTimeout(resolve, 120));
    const documents = input.documents.map((document, index) => ({ id: `document-${id}-${index + 1}`, caseId: id, ...document, uploadedBy: actor.id, uploadedAt: submittedAt }));
    onUploadProgress?.(100);
    const created: CaseDetail = {
      id, caseNumber, customerDisplayName: input.customer.displayName.trim(), agentId: actor.agentId, agentName: actor.displayName,
      status: "submitted", paymentStatus: "not_recorded", saleAmountSen: null, submittedAt, updatedAt: submittedAt,
      customer: { id: `customer-${id}`, displayName: input.customer.displayName.trim(), companyRegistrationNumber: null, contactName: input.customer.contactName?.trim() || null, email: input.customer.email?.trim() || null, phone: input.customer.phone?.trim() || null },
      service: { siteAddress: input.service.siteAddress.trim(), electricityAccountNumber: null, notes: input.service.notes?.trim() || null },
      documents, activity: [{ id: `activity-${id}`, action: "case_submitted", actorDisplayName: actor.displayName, occurredAt: submittedAt, summary: "Case submitted for staff review." }],
    };
    caseStore.set(id, created);
    return { ok: true, data: created };
  },
};

export { caseDocumentConfig };
