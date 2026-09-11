import type { CaseStatus, CurrentUser } from "./types";

export type CaseActionKind = "resubmit" | "pass_review" | "request_changes" | "cancel" | "delete_case" | "generate_schedule" | "accept_proposal" | "verify_payment" | "reject_payment" | "submit_deposit" | "submit_post_installation_payment" | "submit_installment_payment" | "propose_installation" | "confirm_installation" | "request_reschedule" | "record_installation" | "verify_savings" | "move_to_trial" | "accept_trial";
export interface CaseAction { kind: CaseActionKind; label: string; variant: "primary" | "secondary" | "danger"; requiresReason?: boolean; }

export const caseFlowStages = [
  "Customer Details",
  "Admin Review & Quotation",
  "Bank Downpayment & Signed Proposal",
  "Installation",
  "Post-Installation Payment",
  "Recurring Balance",
] as const;

export type CaseFlowStage = (typeof caseFlowStages)[number];

const caseFlowStageByStatus: Record<CaseStatus, number> = {
  draft: 0,
  changes_requested: 0,
  under_review: 1,
  quotation_issued: 1,
  awaiting_deposit_submission: 2,
  deposit_pending_verification: 2,
  awaiting_installation_scheduling: 3,
  installation_pending_confirmation: 3,
  installation_reschedule_requested: 3,
  installation_scheduled: 3,
  awaiting_post_installation_payment: 4,
  post_installation_payment_pending_verification: 4,
  installed_monitoring: 4,
  trial_review: 4,
  active_installments: 5,
  completed: 5,
  cancelled: 0,
};

export function getCaseFlowStageIndex(status: CaseStatus) {
  return caseFlowStageByStatus[status];
}

const staffRoles = new Set(["staff", "admin"]);

export function caseActionLabels(status: CaseStatus, role: CurrentUser["role"], hasPaymentSchedule = false, depositPaid = false, hasPendingPayment = false, postInstallationPaid = false, pendingPaymentAmountSen = 0, paymentBalanceSen = Number.MAX_SAFE_INTEGER): CaseAction[] {
  if (role === "agent") {
    const actions: CaseAction[] = status === "changes_requested" ? [{ kind: "resubmit", label: "Resubmit for Review", variant: "primary" }] : [];
    // Proposal acceptance owns the hand-off from quotation to deposit. Keep
    // this action available for every quotation-issued case; older records
    // may already have a schedule while still carrying this status.
    if (status === "quotation_issued") actions.push({ kind: "accept_proposal", label: "Accept Proposal", variant: "primary" });
    const canSubmitMore = paymentBalanceSen > pendingPaymentAmountSen;
    if (canSubmitMore && (status === "awaiting_deposit_submission" || (status === "deposit_pending_verification" && hasPaymentSchedule && !depositPaid))) actions.push({ kind: "submit_deposit", label: status === "deposit_pending_verification" ? "Record Another Downpayment" : "Record Downpayment", variant: "primary" });
    else if (canSubmitMore && (status === "awaiting_post_installation_payment" || (status === "post_installation_payment_pending_verification" && hasPaymentSchedule && !postInstallationPaid))) actions.push({ kind: "submit_post_installation_payment", label: status === "post_installation_payment_pending_verification" ? "Record Another Post-Installation Payment" : "Record Post-Installation Payment", variant: "primary" });
    else if (canSubmitMore && status === "active_installments") actions.push({ kind: "submit_installment_payment", label: "Record Installment Payment", variant: "primary" });
    if (status === "installation_pending_confirmation") actions.push({ kind: "confirm_installation", label: "Confirm Installation Date", variant: "primary" });
    if (status === "installed_monitoring") actions.push({ kind: "verify_savings", label: "Record Savings", variant: "primary" });
    if (status === "draft") actions.push({ kind: "delete_case", label: "Delete Case", variant: "danger" });
    if (status !== "draft" && status !== "cancelled" && status !== "completed") actions.push({ kind: "cancel", label: "Cancel Case", variant: "danger", requiresReason: true });
    return actions;
  }
  if (!staffRoles.has(role)) return [];
  let actions: CaseAction[];
  switch (status) {
    case "under_review": actions = [{ kind: "pass_review", label: "Prepare Proposal", variant: "primary" }, { kind: "request_changes", label: "Request Changes", variant: "secondary", requiresReason: true }]; break;
    case "quotation_issued": actions = []; break;
    case "deposit_pending_verification": actions = hasPendingPayment ? [{ kind: "verify_payment", label: "Verify Deposit", variant: "primary" }] : []; break;
    case "awaiting_installation_scheduling": actions = [{ kind: "propose_installation", label: "Set Installation Date", variant: "primary" }]; break;
    case "installation_reschedule_requested": actions = [{ kind: "propose_installation", label: "Set New Installation Date", variant: "primary" }]; break;
    case "installation_pending_confirmation": actions = [{ kind: "propose_installation", label: "Update Installation Date", variant: "primary" }]; break;
    case "installation_scheduled": actions = [{ kind: "record_installation", label: "Record Installation", variant: "primary" }]; break;
    case "post_installation_payment_pending_verification": actions = hasPendingPayment ? [{ kind: "verify_payment", label: "Verify Post-Installation Payment", variant: "primary" }] : []; break;
    case "active_installments": actions = hasPendingPayment ? [{ kind: "verify_payment", label: "Verify Installment Payment", variant: "primary" }] : []; break;
    case "installed_monitoring": actions = []; break;
    case "trial_review": actions = [{ kind: "accept_trial", label: "Start Recurring Balance", variant: "primary" }]; break;
    default: actions = [];
  }
  if (status !== "draft" && status !== "cancelled" && status !== "completed") actions.push({ kind: "cancel", label: "Cancel Case", variant: "danger", requiresReason: true });
  return actions;
}

export function canEditCase(actor: CurrentUser, status: CaseStatus, caseAgentId: string) {
  return actor.role === "agent" ? actor.agentId === caseAgentId && status === "changes_requested" : staffRoles.has(actor.role);
}

export function canDeleteCase(actor: CurrentUser, status: CaseStatus, caseAgentId: string) {
  return staffRoles.has(actor.role) || (actor.role === "agent" && actor.agentId === caseAgentId && status === "draft");
}

export function canProcessCases(actor: CurrentUser) { return staffRoles.has(actor.role); }
