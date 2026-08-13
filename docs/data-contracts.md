# Smartegy Data Contracts

## 1. Status

This is a proposed frontend/backend contract for parallel development. It is not a final database schema. The frontend can use these shapes for mock data, while the backend colleague validates them against Supabase tables, row-level security, and server actions.

Any change involving money, role access, commission eligibility, or audit history must be agreed explicitly.

## 2. Conventions

- IDs are opaque strings; the UI must not infer meaning from them.
- Human-readable references such as `SMG-00124` are separate from database IDs.
- Monetary values use integer sen: `2450000` means RM24,500.00.
- Percentages use basis points where practical: `550` means 5.5%.
- Timestamps are ISO 8601 UTC strings.
- Date-only values use `YYYY-MM-DD`.
- API results use stable machine-readable error codes plus safe user-facing messages.
- The server derives the authenticated user and trusted role; it does not accept them as authoritative request fields.

## 3. Shared Types

```ts
export type ID = string;
export type ISODate = string; // YYYY-MM-DD
export type ISODateTime = string; // UTC ISO 8601
export type MoneySen = number; // integer only
export type BasisPoints = number; // 100 = 1%

export type UserRole =
  | "agent"
  | "staff"
  | "admin";

export type RecordStatus = "active" | "inactive";

export type CaseStatus =
  | "submitted"
  | "under_review"
  | "quotation_prepared"
  | "pending_customer_acceptance"
  | "pending_installation"
  | "pending_payment"
  | "active"
  | "completed"
  | "cancelled";

export type PaymentStatus =
  | "not_recorded"
  | "pending_verification"
  | "verified"
  | "reversed";

export type CommissionStatus =
  | "calculated"
  | "scheduled"
  | "approved"
  | "paid"
  | "withheld"
  | "adjusted"
  | "reversed";

export type DocumentType =
  | "electricity_bill"
  | "supporting_document"
  | "quotation"
  | "invoice"
  | "receipt"
  | "other";

export type FinancialDocumentType = "invoice" | "receipt";
export type AgentLevel = 1 | 2 | 3;

export type AgentRegistrationStatus =
  | "draft"
  | "pending_approval"
  | "active"
  | "rejected"
  | "suspended";

export type RegistrationFeeStatus =
  | "unpaid"
  | "pending_verification"
  | "verified"
  | "rejected"
  | "waived"
  | "refunded";
```

The enum values above are proposed and must be kept aligned across TypeScript, validation schemas, database constraints, and UI labels.

## 4. Identity and Profile

```ts
export interface CurrentUser {
  id: ID;
  role: UserRole;
  displayName: string;
  email: string | null;
  agentId: ID | null;
}

export interface AgentSummary {
  id: ID;
  agentCode: string;
  displayName: string;
  currentLevel: AgentLevel;
  uplineAgentId: ID | null;
  uplineName: string | null;
  directAgentCount: number;
  successfulCaseCount: number;
  personalSalesSen: MoneySen;
  referralSalesSen: MoneySen;
  annualSalesSen: MoneySen;
  commissionEarnedSen: MoneySen;
  status: RecordStatus;
  qualification: AgentQualificationProgress;
  promotionHistory: AgentPromotionAudit[];
}

export interface AgentDetail extends AgentSummary {
  phone: string | null;
  registrationDate: ISODate;
  registrationStatus: AgentRegistrationStatus;
  directRecruits: AgentSummary[];
  qualification: AgentQualificationProgress;
  updatedAt: ISODateTime;
}

export interface AgentWorkspaceDetail {
  agent: AgentSummary;
  sales: CaseSummary[];
  commissions: CommissionSummary[];
  uplineAgents: AgentSummary[];
  downlineAgents: AgentSummary[];
}

export interface AgentQualificationProgress {
  currentLevel: AgentLevel;
  successfulCases: { current: number; required: number | null };
  directAgents: { current: number; required: number | null };
  annualSalesSen: { current: MoneySen; required: MoneySen | null };
  eligibleForPromotion: boolean;
  nextLevel: AgentLevel | null;
}

export interface AgentPromotionAudit {
  id: ID;
  agentId: ID;
  previousLevel: AgentLevel;
  newLevel: AgentLevel;
  actorId: ID;
  actorDisplayName: string;
  occurredAt: ISODateTime;
  note: string | null;
}

export interface AgentLevelChangeRequest {
  id: ID;
  agentId: ID;
  previousLevel: AgentLevel;
  requestedLevel: AgentLevel;
  requestedById: ID;
  requestedByDisplayName: string;
  requestedAt: ISODateTime;
  status: "pending" | "approved" | "rejected";
  reviewedById: ID | null;
  reviewedByDisplayName: string | null;
  reviewedAt: ISODateTime | null;
  reason: string | null;
}

export type PayoutSettlementStatus = "pending" | "settled";

export interface PayoutTransaction {
  id: ID;
  payoutMonth: string;
  agentId: ID;
  commissionId: ID;
  amountSen: MoneySen;
  settlementStatus: PayoutSettlementStatus;
  settledAt: ISODateTime | null;
  settledById: ID | null;
  bankReference: string | null;
}

export interface AgentMonthlyPayout {
  agentId: ID;
  payoutMonth: string;
  totalSen: MoneySen;
  settledSen: MoneySen;
  pendingSen: MoneySen;
  settlementStatus: PayoutSettlementStatus | "partially_settled";
}
```

## 5. Cases and Documents

```ts
export interface CaseSummary {
  id: ID;
  caseNumber: string;
  customerDisplayName: string;
  agentId: ID;
  agentName: string;
  status: CaseStatus;
  paymentStatus: PaymentStatus;
  saleAmountSen: MoneySen | null;
  submittedAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface CaseDetail extends CaseSummary {
  customer: CustomerRecord;
  service: ServiceRecord;
  documents: CaseDocument[];
  payments: PaymentRecord[];
  financialDocuments: FinancialDocumentSummary[];
  commissionIds: ID[];
  activity: AuditEvent[];
}

export interface CustomerRecord {
  id: ID;
  displayName: string;
  companyRegistrationNumber: string | null;
  contactName: string | null;
  email: string | null;
  phone: string | null;
}

export interface ServiceRecord {
  siteAddress: string;
  electricityAccountNumber: string | null;
  notes: string | null;
}

export interface CaseDocument {
  id: ID;
  caseId: ID;
  type: DocumentType;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedBy: ID;
  uploadedAt: ISODateTime;
  downloadUrl?: never; // obtain a short-lived URL through an authorised action
}

export interface CaseDocumentInput {
  type: "electricity_bill" | "supporting_document";
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

export interface CreateCaseInput {
  customer: Pick<CustomerRecord, "displayName" | "contactName" | "email" | "phone">;
  service: Pick<ServiceRecord, "siteAddress" | "notes">;
  documents: CaseDocumentInput[];
}
```

For the Version 1 agent submission flow, `customer.displayName` and one `electricity_bill` document are required. Contact, email, phone, service address, electricity account number, notes, and `supporting_document` uploads remain optional. The upload boundary validates configured file types and maximum size, stores document metadata against the case, and enforces ownership when an agent reads a case or its documents.

## 6. Payments

```ts
export interface PaymentRecord {
  id: ID;
  caseId: ID;
  amountSen: MoneySen;
  paymentDate: ISODate;
  reference: string | null;
  status: PaymentStatus;
  recordedBy: ID;
  recordedAt: ISODateTime;
  verifiedBy: ID | null;
  verifiedAt: ISODateTime | null;
}

export interface VerifyPaymentInput {
  paymentId: ID;
  expectedVersion: number;
}
```

The server decides whether the caller may verify the payment and whether it qualifies for commission generation.

## 7. Commissions

```ts
export type CommissionRecipientKind =
  | "level_1_agent"
  | "level_2_agent"
  | "level_3_agent"
  | "office";

export interface CommissionSummary {
  id: ID;
  commissionNumber: string;
  caseId: ID;
  caseNumber: string;
  recipientId: ID | null;
  recipientName: string;
  recipientKind: CommissionRecipientKind;
  entitlementSen: MoneySen;
  firstPaymentSen: MoneySen;
  deferredBalanceSen: MoneySen;
  paidToDateSen: MoneySen;
  nextPaymentDate: ISODate | null;
  nextPaymentSen: MoneySen | null;
  status: CommissionStatus;
}

export interface CommissionCaseDetail {
  id: ID;
  caseId: ID;
  caseNumber: string;
  qualifyingPaymentId: ID;
  saleAmountSen: MoneySen;
  totalCommissionSen: MoneySen;
  firstPaymentPoolSen: MoneySen;
  deferredPoolSen: MoneySen;
  allocations: CommissionAllocation[];
  audit: AuditEvent[];
  createdAt: ISODateTime;
  version: number;
}

export interface CommissionAllocation {
  id: ID;
  recipientId: ID | null;
  recipientName: string;
  recipientKind: CommissionRecipientKind;
  entitlementRateBps: BasisPoints;
  firstPoolShareBps: BasisPoints;
  entitlementSen: MoneySen;
  firstPaymentSen: MoneySen;
  deferredBalanceSen: MoneySen;
  instalments: CommissionInstalment[];
  status: CommissionStatus;
}

export interface CommissionInstalment {
  id: ID;
  sequence: number; // 1 through 17 for the current rule
  dueDate: ISODate;
  amountSen: MoneySen;
  status: "scheduled" | "approved" | "paid" | "withheld" | "adjusted" | "reversed";
  paidAt: ISODateTime | null;
  paymentReference: string | null;
}

export interface AgentCommissionRecord extends CommissionSummary {
  customerDisplayName: string;
  eligibilityStatus: "eligible" | "pending";
  lastUpdatedAt: ISODateTime;
  schedule: CommissionInstalment[];
  withheldReason: string | null;
  adjustmentNote: string | null;
  qualifyingPaymentDate: ISODate | null;
}

export interface CommissionOverview {
  totalEntitlementSen: MoneySen;
  paidToDateSen: MoneySen;
  remainingBalanceSen: MoneySen;
  upcomingPayoutSen: MoneySen | null;
  upcomingPayoutDate: ISODate | null;
}

export interface AdjustCommissionInput {
  allocationId: ID;
  adjustmentSen: MoneySen; // signed integer
  reason: string;
  expectedVersion: number;
}
```

The frontend must never submit calculated recipient entitlements as trusted results. It may preview values for explanation, but the backend recalculates and returns the authoritative schedule.

The agent-facing commissions repository exposes only the authenticated agent's permitted records and returns the summary totals plus complete 17-month schedule. It has no client mutation methods. Staff/admin commission-management actions remain outside this agent-facing contract.

## 8. Invoices and Receipts

```ts
export interface FinancialDocumentSummary {
  id: ID;
  documentNumber: string;
  type: FinancialDocumentType;
  caseId: ID;
  caseNumber: string;
  customerDisplayName: string;
  amountSen: MoneySen;
  issueDate: ISODate;
  status: "issued" | "cancelled";
  createdAt: ISODateTime;
}

export interface GenerateFinancialDocumentInput {
  caseId: ID;
  type: FinancialDocumentType;
  amountSen: MoneySen;
  issueDate: ISODate;
  paymentId?: ID;
  notes?: string;
}

export interface GenerateFinancialDocumentResult {
  document: FinancialDocumentSummary;
  downloadActionAvailable: boolean;
}
```

The server allocates the sequential document number, generates the PDF, stores it securely, and returns the resulting record. The client must not predict document numbers or submit a storage path. Registration-fee payments are handled by the registration contract below and do not generate a registration-fee receipt in this Version 1 flow.

## 9. Reports and Pagination

```ts
export interface PageRequest {
  page: number; // 1-based in UI contract
  pageSize: number;
  search?: string;
  sort?: string;
  direction?: "asc" | "desc";
}

export interface PageResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface DateRangeFilter {
  from?: ISODate;
  to?: ISODate;
}

export interface ExportRequest<TFilters> {
  reportType:
    | "case_activity"
    | "agent_performance"
    | "sales_performance"
    | "referral_relationships"
    | "commission_calculations"
    | "monthly_commission_payments"
    | "invoices_receipts";
  filters: TFilters;
  format: "csv" | "xlsx";
}
```

Exports must be generated from authorised server-side queries, not from an unrestricted client-side dataset.

## 10. Audit Events

```ts
export interface AuditEvent {
  id: ID;
  entityType: "case" | "agent" | "payment" | "commission" | "document";
  entityId: ID;
  action: string;
  actorId: ID;
  actorDisplayName: string;
  occurredAt: ISODateTime;
  reason: string | null;
  summary: string;
}
```

Sensitive before/after values may be retained server-side without exposing all raw fields to every frontend role.

## 11. Result and Error Shape

```ts
export type ActionResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: {
        code:
          | "VALIDATION_ERROR"
          | "UNAUTHENTICATED"
          | "FORBIDDEN"
          | "NOT_FOUND"
          | "CONFLICT"
          | "DUPLICATE"
          | "INTERNAL_ERROR";
        message: string;
        fieldErrors?: Record<string, string[]>;
      };
    };
```

Do not expose database errors, policies, stack traces, or sensitive record details in user-facing messages.

## 12. Frontend Repository Boundary

The frontend should call interfaces such as:

```ts
export interface CasesRepository {
  list(input: PageRequest & { status?: CaseStatus }): Promise<PageResult<CaseSummary>>;
  getById(caseId: ID): Promise<CaseDetail>;
  create(input: CreateCaseInput): Promise<CaseDetail>;
}

export interface CommissionsRepository {
  list(input: PageRequest & { status?: CommissionStatus }): Promise<PageResult<CommissionSummary>>;
  getById(commissionId: ID): Promise<CommissionCaseDetail>;
}
```

Provide mock and Supabase/server-backed implementations behind the same interface. UI components should not import Supabase directly.

## 13. Backend Confirmation Checklist

Before integration, both developers should agree on:

1. Final enums and allowed state transitions.
2. Required versus optional fields.
3. Role/permission matrix and row-level security behaviour.
4. Agent hierarchy representation and circular-reference prevention.
5. Commission calculation input/output and idempotency key.
6. Payment verification and reversal workflow.
7. Document numbering and secure file access.
8. Pagination, search, sorting, and filter parameters.
9. Error codes and optimistic-concurrency/version fields.
10. Audit-event coverage.

## 14. Agent Registration and Onboarding Contracts

```ts
export interface ReferralInvitation {
  id: ID;
  code: string;
  referringAgentId: ID;
  referringAgentName: string;
  expiresAt: ISODateTime | null;
  valid: boolean;
}

export interface RegistrationPaymentProof {
  id: ID;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: ISODateTime;
}

export interface RegistrationInvoice {
  invoiceNumber: string;
  amountSen: MoneySen;
  description: string;
  issueDate: ISODate;
  status: "issued";
}

export interface AgentRegistration {
  id: ID;
  applicationNumber: string;
  profile: { fullName: string; email: string; mobileNumber: string };
  referralCode: string;
  referringAgentId: ID;
  referringAgentName: string;
  registrationStatus: AgentRegistrationStatus;
  feeStatus: RegistrationFeeStatus;
  emailVerified: boolean;
  profileComplete: boolean;
  feeAmountSen: MoneySen;
  invoice: RegistrationInvoice;
  paymentDate: ISODate | null;
  paymentReference: string | null;
  paymentRemarks: string | null;
  verifiedAmountSen: MoneySen | null;
  verifiedPaymentDate: ISODate | null;
  bankReference: string | null;
  proof: RegistrationPaymentProof | null;
  rejectionReason: string | null;
  submittedAt: ISODateTime | null;
  audit: RegistrationAuditEvent[];
}

export interface RegistrationAuditEvent {
  id: ID;
  entityType: "registration" | "registration_fee";
  entityId: ID;
  action: string;
  previousStatus: AgentRegistrationStatus | RegistrationFeeStatus | null;
  newStatus: AgentRegistrationStatus | RegistrationFeeStatus | null;
  actorId: ID;
  actorDisplayName: string;
  occurredAt: ISODateTime;
  reason: string | null;
}
```

The repository boundary exposes invitation lookup, mock OTP send/verification, application creation, fee-proof submission, staff listing, fee verification/rejection, registration rejection, and active-agent access checks. In the simplified applicant contract, `paymentDate` and `paymentReference` remain null at applicant submission and `paymentRemarks` is optional; staff verification separately records the verified payment date and bank reference. Production bank details and proof-file URLs come from authorised configuration/storage services; the client does not submit role, level, commission, status, fee-verification, or upline values as trusted fields. Fee verification automatically approves and activates an application when email is verified and the profile is complete; otherwise it remains pending approval. Every privileged action creates an audit event.

The staff registration queue additionally accepts `RegistrationQueueQuery` filters for search, separate registration/fee status, profile and email readiness, submitted date range, and supported sort orders. Staff detail lookup uses the human-readable application number. Payment proof access is returned by `getPaymentProof` as a short-lived protected access token; proof files must not be exposed as public URLs. Queue/detail reads and all fee or registration decisions remain staff/admin-only at the repository/server boundary.
