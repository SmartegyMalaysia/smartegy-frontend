export type ID = string;
export type ISODate = string;
export type ISODateTime = string;
export type MoneySen = number;
export type UserRole = "agent" | "admin_staff" | "finance_management";
export type CaseStatus = "submitted" | "under_review" | "pending_payment" | "active" | "completed";
export type PaymentStatus = "not_recorded" | "pending_verification" | "verified";
export type CommissionStatus = "calculated" | "scheduled" | "approved" | "paid" | "withheld";
export interface CurrentUser { id: ID; role: UserRole; displayName: string; email: string | null; agentId: ID | null; }
export interface CaseSummary { id: ID; caseNumber: string; customerDisplayName: string; agentId: ID; agentName: string; status: CaseStatus; paymentStatus: PaymentStatus; saleAmountSen: MoneySen | null; submittedAt: ISODateTime; updatedAt: ISODateTime; }
export interface CommissionSummary { id: ID; commissionNumber: string; caseId: ID; caseNumber: string; recipientId: ID | null; recipientName: string; recipientKind: "level_1_agent" | "level_2_agent" | "level_3_agent" | "office"; entitlementSen: MoneySen; firstPaymentSen: MoneySen; deferredBalanceSen: MoneySen; paidToDateSen: MoneySen; nextPaymentDate: ISODate | null; nextPaymentSen: MoneySen | null; status: CommissionStatus; }
export interface AgentSummary { id: ID; agentCode: string; displayName: string; currentLevel: 1 | 2 | 3; uplineAgentId: ID | null; uplineName: string | null; successfulCaseCount: number; personalSalesSen: MoneySen; referralSalesSen: MoneySen; commissionEarnedSen: MoneySen; status: "active" | "inactive"; }
export interface DashboardSnapshot { currentUser: CurrentUser; cases: CaseSummary[]; commissions: CommissionSummary[]; agents: AgentSummary[]; }
