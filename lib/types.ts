export type ID = string;
export type ISODate = string;
export type ISODateTime = string;
export type MoneySen = number;
export type UserRole = "agent" | "staff" | "admin";
export type AccountStatus = "invited" | "active" | "inactive";
export type CaseStatus = "draft" | "submitted" | "under_review" | "changes_requested" | "quotation_issued" | "awaiting_deposit" | "installation_scheduled" | "installed_monitoring" | "trial_review" | "active_installments" | "completed" | "cancelled";
export type PaymentStatus = "not_recorded" | "pending_verification" | "verified";
export type CommissionStatus = "calculated" | "scheduled" | "approved" | "paid" | "withheld" | "adjusted" | "reversed";
export type RegistrationStatus = "draft" | "pending_approval" | "active" | "rejected" | "suspended";
export type RegistrationFeeStatus = "unpaid" | "pending_verification" | "verified" | "rejected" | "waived" | "refunded";
export type AgentLevel = 1 | 2 | 3;
export type PayoutSettlementStatus = "pending" | "settled";
export type RegistrationDocumentType = "payment_proof";
export type DocumentType = "electricity_bill" | "supporting_document" | "quotation" | "invoice" | "receipt" | "other";
export interface CurrentUser { id: ID; role: UserRole; displayName: string; email: string | null; agentId: ID | null; accountStatus?: AccountStatus; emailVerified?: boolean; }
export interface ManageUser { id: ID; displayName: string; email: string | null; phone: string | null; role: UserRole; accountStatus: AccountStatus; agentCode: string | null; lastActiveAt: ISODateTime | null; createdAt: ISODateTime; }
export interface UpdateManageUserInput { displayName: string; phone: string; role: UserRole; accountStatus: AccountStatus; }
export interface CaseSummary { id: ID; caseNumber: string; customerDisplayName: string; agentId: ID; agentName: string; status: CaseStatus; paymentStatus: PaymentStatus; saleAmountSen: MoneySen | null; submittedAt: ISODateTime; updatedAt: ISODateTime; }
export interface CustomerRecord { id: ID; displayName: string; companyRegistrationNumber: string | null; contactName: string | null; email: string | null; phone: string | null; }
export interface ServiceRecord { siteAddress: string; electricityAccountNumber: string | null; notes: string | null; }
export interface CaseDocument { id: ID; caseId: ID; type: DocumentType; fileName: string; mimeType: string; sizeBytes: number; uploadedBy: ID; uploadedAt: ISODateTime; bucketId?: string; objectPath?: string; visibleToAgent?: boolean; }
export interface CaseActivity { id: ID; action: string; actorDisplayName: string; occurredAt: ISODateTime; summary: string; }
export type PaymentScheduleKind = "deposit" | "post_installation" | "installment" | "adjustment";
export type PaymentScheduleStatus = "scheduled" | "partially_paid" | "paid" | "waived" | "cancelled";
export type CasePaymentStatus = "pending_verification" | "verified" | "rejected" | "reversed";
export interface PaymentSchedule { id: ID; caseId: ID; sequence: number; kind: PaymentScheduleKind; dueDate: ISODate; amountDueSen: MoneySen; amountPaidSen: MoneySen; status: PaymentScheduleStatus; }
export interface CasePayment { id: ID; caseId: ID; amountSen: MoneySen; paymentDate: ISODate; reference: string | null; status: CasePaymentStatus; recordedBy: ID; recordedAt: ISODateTime; verifiedBy: ID | null; verifiedAt: ISODateTime | null; }
export interface CaseDetail extends CaseSummary { customer: CustomerRecord; service: ServiceRecord; documents: CaseDocument[]; activity: CaseActivity[]; quote?: { saleAmountSen: MoneySen | null; averageMonthlyKwh: number | null; averageTnbRate: number | null; quotedSavingsKwh: number | null; quotedMonthlySavingsSen: MoneySen | null; } | null; verifiedSavings?: { savingsKwh: number | null; monthlySavingsSen: MoneySen | null; verifiedAt: ISODateTime | null; } | null; installationDate?: ISODate | null; monitoringStartedOn?: ISODate | null; trialDecisionOn?: ISODate | null; customerContinues?: boolean | null; installmentTermMonths?: 10 | 20 | null; paymentSchedules?: PaymentSchedule[]; payments?: CasePayment[]; financialDocuments?: Array<{ id: ID; documentNumber: string; type: "invoice" | "receipt"; amountSen: MoneySen; issueDate: ISODate; status: string; createdAt: ISODateTime; }>; commissionIds?: ID[]; }
export interface UpdateCaseInput { customer?: Partial<Pick<CustomerRecord, "displayName" | "companyRegistrationNumber" | "contactName" | "email" | "phone">>; service?: Partial<Pick<ServiceRecord, "siteAddress" | "notes">>; quote?: Partial<{ saleAmountSen: MoneySen; averageMonthlyKwh: number; averageTnbRate: number; quotedSavingsKwh: number; quotedMonthlySavingsSen: MoneySen }>; }
export interface GeneratePaymentScheduleInput { depositDue: ISODate; postInstallationDue: ISODate; }
export interface RecordPaymentInput { amountSen: MoneySen; paymentDate: ISODate; reference?: string | null; }
export interface VerifyPaymentInput { paymentId: ID; allocations: Array<{ scheduleId: ID; amountSen: MoneySen }>; }
export interface AcceptTrialInput { installmentStart: ISODate; termMonths: 10 | 20; }
export interface CaseDocumentInput { type: "electricity_bill" | "supporting_document"; fileName: string; mimeType: string; sizeBytes: number; file?: File; }
export interface CreateCaseInput { customer: Pick<CustomerRecord, "displayName" | "contactName" | "email" | "phone">; service: Pick<ServiceRecord, "siteAddress" | "notes">; documents: CaseDocumentInput[]; }
export interface CommissionSummary { id: ID; caseId: ID; caseNumber: string; recipientId: ID | null; recipientName: string; recipientKind: "level_1_agent" | "level_2_agent" | "level_3_agent" | "office"; entitlementSen: MoneySen; firstPaymentSen: MoneySen; deferredBalanceSen: MoneySen; paidToDateSen: MoneySen; nextPaymentDate: ISODate | null; nextPaymentSen: MoneySen | null; status: CommissionStatus; }
export interface CommissionScheduleEntry { id: ID; sequence: number; dueDate: ISODate; amountSen: MoneySen; status: CommissionStatus; paidAt: ISODateTime | null; paymentReference: string | null; note: string | null; }
export interface AgentCommissionRecord extends CommissionSummary { customerDisplayName: string; eligibilityStatus: "eligible" | "pending"; lastUpdatedAt: ISODateTime; schedule: CommissionScheduleEntry[]; withheldReason: string | null; adjustmentNote: string | null; qualifyingPaymentDate: ISODate | null; }
export interface CommissionOverview { totalEntitlementSen: MoneySen; paidToDateSen: MoneySen; remainingBalanceSen: MoneySen; upcomingPayoutSen: MoneySen | null; upcomingPayoutDate: ISODate | null; }
export interface AgentQualificationProgress { currentLevel: AgentLevel; successfulCases: { current: number; required: number | null }; directAgents: { current: number; required: number | null }; annualSalesSen: { current: MoneySen; required: MoneySen | null }; eligibleForPromotion: boolean; nextLevel: AgentLevel | null; }
export interface AgentPromotionAudit { id: ID; agentId: ID; previousLevel: AgentLevel; newLevel: AgentLevel; actorId: ID; actorDisplayName: string; occurredAt: ISODateTime; note: string | null; }
export interface AgentLevelChangeRequest { id: ID; agentId: ID; previousLevel: AgentLevel; requestedLevel: AgentLevel; requestedById: ID; requestedByDisplayName: string; requestedAt: ISODateTime; status: "pending" | "approved" | "rejected"; reviewedById: ID | null; reviewedByDisplayName: string | null; reviewedAt: ISODateTime | null; reason: string | null; }
export interface AgentLevelChangeApproval extends AgentLevelChangeRequest { agent: AgentSummary; }
export interface AgentSummary { id: ID; agentCode: string; displayName: string; currentLevel: AgentLevel; uplineAgentId: ID | null; uplineName: string | null; directAgentCount: number; successfulCaseCount: number; personalSalesSen: MoneySen; referralSalesSen: MoneySen; annualSalesSen: MoneySen; commissionEarnedSen: MoneySen; status: "active" | "inactive"; qualification: AgentQualificationProgress; promotionHistory: AgentPromotionAudit[]; levelChangeRequests: AgentLevelChangeRequest[]; }
export interface AgentWorkspaceDetail { agent: AgentSummary; sales: CaseSummary[]; commissions: CommissionSummary[]; uplineAgents: AgentSummary[]; downlineAgents: AgentSummary[]; }
export interface PayoutBankAccount { bankName: string; accountHolderName: string; accountNumberMasked: string; }
export interface PayoutTransaction { id: ID; payoutMonth: string; agentId: ID; agentName: string; agentCode: string; bankAccount: PayoutBankAccount; commissionId: ID; caseNumber: string; customerDisplayName: string; amountSen: MoneySen; settlementStatus: PayoutSettlementStatus; settledAt: ISODateTime | null; settledById: ID | null; settledByDisplayName: string | null; bankReference: string | null; }
export interface AgentMonthlyPayout { agentId: ID; agentName: string; agentCode: string; bankAccount: PayoutBankAccount; payoutMonth: string; totalSen: MoneySen; settledSen: MoneySen; pendingSen: MoneySen; transactionCount: number; settledTransactionCount: number; settlementStatus: PayoutSettlementStatus | "partially_settled"; }
export interface PayoutMonthSummary { payoutMonth: string; totalSen: MoneySen; settledSen: MoneySen; pendingSen: MoneySen; agentCount: number; settledAgentCount: number; transactionCount: number; settledTransactionCount: number; }
export interface DashboardSnapshot { currentUser: CurrentUser; cases: CaseSummary[]; commissions: CommissionSummary[]; agents: AgentSummary[]; }

export interface AgentProfile {
  id: ID;
  profile: RegistrationProfile;
  agentNumber: string;
  applicationNumber: string;
  accountStatus: "active" | "inactive";
  registrationStatus: RegistrationStatus;
  feeStatus: RegistrationFeeStatus;
  emailVerified: boolean;
  joinedDate: ISODate;
  referralCode: string;
  uplineName: string | null;
  currentLevel: AgentLevel;
  profileComplete: boolean;
}

export interface UpdateAgentProfileInput { fullName: string; mobileNumber: string; email: string; }

export type ProfileActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: "VALIDATION_ERROR" | "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" | "INTERNAL_ERROR"; message: string; fieldErrors?: Record<string, string[]> } };

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

export interface RegistrationPaymentProofAccess {
  fileName: string;
  mimeType: string;
  accessToken: string;
  expiresAt: ISODateTime;
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
  referralCode: string | null;
  referringAgentId: ID | null;
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
  proof: Omit<RegistrationPaymentProof, "id" | "uploadedAt"> & { file?: File };
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

export interface RegistrationQueueQuery {
  search?: string;
  registrationStatus?: RegistrationStatus | "all";
  feeStatus?: RegistrationFeeStatus | "all";
  profileComplete?: "complete" | "incomplete" | "all";
  emailVerified?: "verified" | "unverified" | "all";
  submittedFrom?: ISODate;
  submittedTo?: ISODate;
  sort?: "priority" | "newest" | "oldest" | "fee_status" | "recently_updated";
}

export type RegistrationActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: "VALIDATION_ERROR" | "FORBIDDEN" | "NOT_FOUND" | "CONFLICT"; message: string; fieldErrors?: Record<string, string[]> } };
