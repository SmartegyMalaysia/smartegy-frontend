export type ID = string;
export type ISODate = string;
export type ISODateTime = string;
export type MoneySen = number;
export type UserRole = "agent" | "staff" | "admin";
export type CaseStatus = "submitted" | "under_review" | "pending_payment" | "active" | "completed";
export type PaymentStatus = "not_recorded" | "pending_verification" | "verified";
export type CommissionStatus = "calculated" | "scheduled" | "approved" | "paid" | "withheld";
export type RegistrationStatus = "draft" | "pending_approval" | "active" | "rejected" | "suspended";
export type RegistrationFeeStatus = "unpaid" | "pending_verification" | "verified" | "rejected" | "waived" | "refunded";
export type RegistrationDocumentType = "payment_proof";
export type DocumentType = "electricity_bill" | "supporting_document" | "quotation" | "invoice" | "receipt" | "other";
export interface CurrentUser { id: ID; role: UserRole; displayName: string; email: string | null; agentId: ID | null; }
export interface CaseSummary { id: ID; caseNumber: string; customerDisplayName: string; agentId: ID; agentName: string; status: CaseStatus; paymentStatus: PaymentStatus; saleAmountSen: MoneySen | null; submittedAt: ISODateTime; updatedAt: ISODateTime; }
export interface CustomerRecord { id: ID; displayName: string; companyRegistrationNumber: string | null; contactName: string | null; email: string | null; phone: string | null; }
export interface ServiceRecord { siteAddress: string; electricityAccountNumber: string | null; notes: string | null; }
export interface CaseDocument { id: ID; caseId: ID; type: DocumentType; fileName: string; mimeType: string; sizeBytes: number; uploadedBy: ID; uploadedAt: ISODateTime; }
export interface CaseActivity { id: ID; action: string; actorDisplayName: string; occurredAt: ISODateTime; summary: string; }
export interface CaseDetail extends CaseSummary { customer: CustomerRecord; service: ServiceRecord; documents: CaseDocument[]; activity: CaseActivity[]; }
export interface CaseDocumentInput { type: "electricity_bill" | "supporting_document"; fileName: string; mimeType: string; sizeBytes: number; }
export interface CreateCaseInput { customer: Pick<CustomerRecord, "displayName" | "contactName" | "email" | "phone">; service: Pick<ServiceRecord, "siteAddress" | "electricityAccountNumber" | "notes">; documents: CaseDocumentInput[]; }
export interface CommissionSummary { id: ID; commissionNumber: string; caseId: ID; caseNumber: string; recipientId: ID | null; recipientName: string; recipientKind: "level_1_agent" | "level_2_agent" | "level_3_agent" | "office"; entitlementSen: MoneySen; firstPaymentSen: MoneySen; deferredBalanceSen: MoneySen; paidToDateSen: MoneySen; nextPaymentDate: ISODate | null; nextPaymentSen: MoneySen | null; status: CommissionStatus; }
export interface AgentSummary { id: ID; agentCode: string; displayName: string; currentLevel: 1 | 2 | 3; uplineAgentId: ID | null; uplineName: string | null; successfulCaseCount: number; personalSalesSen: MoneySen; referralSalesSen: MoneySen; commissionEarnedSen: MoneySen; status: "active" | "inactive"; }
export interface DashboardSnapshot { currentUser: CurrentUser; cases: CaseSummary[]; commissions: CommissionSummary[]; agents: AgentSummary[]; }

export interface ReferralInvitation {
  id: ID;
  code: string;
  referringAgentId: ID;
  referringAgentName: string;
  expiresAt: ISODateTime | null;
  valid: boolean;
}

export interface RegistrationProfile {
  fullName: string;
  email: string;
  mobileNumber: string;
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
  profile: RegistrationProfile;
  referralCode: string;
  referringAgentId: ID;
  referringAgentName: string;
  registrationStatus: RegistrationStatus;
  feeStatus: RegistrationFeeStatus;
  emailVerified: boolean;
  profileComplete: boolean;
  acceptedTermsAt: ISODateTime;
  invoice: RegistrationInvoice;
  feeAmountSen: MoneySen;
  paymentDate: ISODate | null;
  paymentReference: string | null;
  paymentRemarks: string | null;
  verifiedAmountSen: MoneySen | null;
  verifiedPaymentDate: ISODate | null;
  bankReference: string | null;
  proof: RegistrationPaymentProof | null;
  rejectionReason: string | null;
  submittedAt: ISODateTime | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  audit: RegistrationAuditEvent[];
}

export interface RegistrationAuditEvent {
  id: ID;
  entityType: "registration" | "registration_fee";
  entityId: ID;
  action: string;
  previousStatus: RegistrationStatus | RegistrationFeeStatus | null;
  newStatus: RegistrationStatus | RegistrationFeeStatus | null;
  actorId: ID;
  actorDisplayName: string;
  occurredAt: ISODateTime;
  reason: string | null;
}

export interface RegistrationPaymentConfig {
  feeAmountSen: MoneySen;
  bankName: string;
  accountName: string;
  accountNumber: string;
  duitNowQrAvailable: boolean;
}

export interface CreateRegistrationInput extends RegistrationProfile {
  password: string;
  passwordConfirmation: string;
  referralCode: string;
  acceptedTerms: boolean;
}

export interface CompleteRegistrationProfileInput extends RegistrationProfile {}

export interface SubmitRegistrationFeeInput {
  registrationId: ID;
  paymentDate: ISODate | null;
  paymentReference: string | null;
  paymentRemarks?: string | null;
  proof: Omit<RegistrationPaymentProof, "id" | "uploadedAt">;
}

export interface VerifyRegistrationFeeInput {
  registrationId: ID;
  verifiedAmountSen: MoneySen;
  paymentDate: ISODate;
  bankReference: string;
  note?: string;
}

export interface RejectRegistrationFeeInput { registrationId: ID; reason: string; }
export interface RegistrationDecisionInput { registrationId: ID; reason?: string; }

export type RegistrationActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: "VALIDATION_ERROR" | "FORBIDDEN" | "NOT_FOUND" | "CONFLICT"; message: string; fieldErrors?: Record<string, string[]> } };
