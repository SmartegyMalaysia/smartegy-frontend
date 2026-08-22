import type { CaseStatus, CurrentUser } from "./types";

export type CaseActionKind = "resubmit" | "pass_review" | "request_changes" | "cancel" | "delete_case" | "generate_schedule" | "verify_payment" | "record_installation" | "verify_savings" | "move_to_trial" | "accept_trial";
export interface CaseAction { kind: CaseActionKind; label: string; variant: "primary" | "secondary" | "danger"; requiresReason?: boolean; }

const staffRoles = new Set(["staff", "admin"]);

export function caseActionLabels(status: CaseStatus, role: CurrentUser["role"], hasPaymentSchedule = false, depositPaid = false): CaseAction[] {
  if (role === "agent") {
    const actions: CaseAction[] = status === "changes_requested" ? [{ kind: "resubmit", label: "Resubmit for Review", variant: "primary" }] : [];
    if (status === "draft") actions.push({ kind: "delete_case", label: "Delete Case", variant: "danger" });
    return actions;
  }
  if (!staffRoles.has(role)) return [];
  switch (status) {
    case "under_review": return [{ kind: "pass_review", label: "Start Quotation", variant: "primary" }, { kind: "request_changes", label: "Request Changes", variant: "secondary", requiresReason: true }, { kind: "cancel", label: "Cancel Case", variant: "danger", requiresReason: true }];
    case "quotation_issued": return [...(hasPaymentSchedule ? [] : [{ kind: "generate_schedule" as const, label: "Generate Payment Schedule", variant: "secondary" as const }]), { kind: "cancel", label: "Cancel Case", variant: "danger", requiresReason: true }];
    case "awaiting_deposit": return [...(depositPaid ? [] : [{ kind: "verify_payment" as const, label: "Record Deposit", variant: "primary" as const }]), ...(depositPaid ? [{ kind: "record_installation" as const, label: "Record Installation", variant: "primary" as const }] : []), { kind: "cancel", label: "Cancel Case", variant: "danger", requiresReason: true }];
    case "installation_scheduled": return [{ kind: "record_installation", label: "Record Installation", variant: "primary" }, { kind: "cancel", label: "Cancel Case", variant: "danger", requiresReason: true }];
    case "installed_monitoring": return [{ kind: "verify_savings", label: "Verify Savings", variant: "primary" }, { kind: "cancel", label: "Cancel Case", variant: "danger", requiresReason: true }];
    case "trial_review": return [{ kind: "accept_trial", label: "Accept Trial and Generate Commissions", variant: "primary" }, { kind: "cancel", label: "Cancel Case", variant: "danger", requiresReason: true }];
    case "active_installments": return [{ kind: "cancel", label: "Cancel Case", variant: "danger", requiresReason: true }];
    default: return [];
  }
}

export function canEditCase(actor: CurrentUser, status: CaseStatus, caseAgentId: string) {
  return actor.role === "agent" ? actor.agentId === caseAgentId && status === "changes_requested" : staffRoles.has(actor.role);
}

export function canDeleteCase(actor: CurrentUser, status: CaseStatus, caseAgentId: string) {
  return staffRoles.has(actor.role) || (actor.role === "agent" && actor.agentId === caseAgentId && status === "draft");
}

export function canProcessCases(actor: CurrentUser) { return staffRoles.has(actor.role); }
