import type { CaseStatus, CurrentUser } from "./types";

export type CaseActionKind = "resubmit" | "pass_review" | "request_changes" | "cancel" | "delete_case" | "generate_schedule" | "accept_proposal" | "verify_payment" | "reject_payment" | "submit_deposit" | "submit_post_installation_payment" | "propose_installation" | "confirm_installation" | "request_reschedule" | "record_installation" | "verify_savings" | "move_to_trial" | "accept_trial";
export interface CaseAction { kind: CaseActionKind; label: string; variant: "primary" | "secondary" | "danger"; requiresReason?: boolean; }

const staffRoles = new Set(["staff", "admin"]);

export function caseActionLabels(status: CaseStatus, role: CurrentUser["role"], hasPaymentSchedule = false, depositPaid = false, hasPendingPayment = false, postInstallationPaid = false): CaseAction[] {
  if (role === "agent") {
    const actions: CaseAction[] = status === "changes_requested" ? [{ kind: "resubmit", label: "Resubmit for Review", variant: "primary" }] : [];
    if (status === "awaiting_deposit_submission") actions.push({ kind: "submit_deposit", label: "Record Deposit", variant: "primary" });
    if (status === "awaiting_post_installation_payment") actions.push({ kind: "submit_post_installation_payment", label: "Record Post-Installation Payment", variant: "primary" });
    if (status === "installation_pending_confirmation") actions.push({ kind: "confirm_installation", label: "Confirm Installation Date", variant: "primary" });
    if (status === "draft") actions.push({ kind: "delete_case", label: "Delete Case", variant: "danger" });
    if (status !== "draft" && status !== "cancelled" && status !== "completed") actions.push({ kind: "cancel", label: "Cancel Case", variant: "danger", requiresReason: true });
    return actions;
  }
  if (!staffRoles.has(role)) return [];
  let actions: CaseAction[];
  switch (status) {
    case "under_review": actions = [{ kind: "pass_review", label: "Prepare Proposal", variant: "primary" }, { kind: "request_changes", label: "Request Changes", variant: "secondary", requiresReason: true }]; break;
    case "quotation_issued": actions = hasPaymentSchedule ? [] : [{ kind: "accept_proposal", label: "Accept Proposal", variant: "primary" }]; break;
    case "deposit_pending_verification": actions = [{ kind: "verify_payment", label: "Verify Deposit", variant: "primary" }]; break;
    case "awaiting_installation_scheduling": actions = [{ kind: "propose_installation", label: "Set Installation Date", variant: "primary" }]; break;
    case "installation_reschedule_requested": actions = [{ kind: "propose_installation", label: "Set New Installation Date", variant: "primary" }]; break;
    case "installation_pending_confirmation": actions = [{ kind: "propose_installation", label: "Update Installation Date", variant: "primary" }]; break;
    case "installation_scheduled": actions = [{ kind: "record_installation", label: "Record Installation", variant: "primary" }]; break;
    case "post_installation_payment_pending_verification": actions = [{ kind: "verify_payment", label: "Verify Post-Installation Payment", variant: "primary" }]; break;
    case "installed_monitoring": actions = [{ kind: "verify_savings", label: "Verify Savings", variant: "primary" }]; break;
    case "trial_review": actions = [{ kind: "accept_trial", label: "Accept Trial and Generate Commissions", variant: "primary" }]; break;
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
