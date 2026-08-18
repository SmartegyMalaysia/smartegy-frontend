import type { CaseStatus, CurrentUser } from "./types";

export type CaseActionKind = "start_review" | "pass_review" | "request_changes" | "cancel" | "issue_quotation" | "generate_schedule" | "verify_payment" | "schedule_installation" | "record_installation" | "verify_savings" | "move_to_trial" | "accept_trial" | "mark_completed";
export interface CaseAction { kind: CaseActionKind; label: string; variant: "primary" | "secondary" | "danger"; requiresReason?: boolean; }

const staffRoles = new Set(["staff", "admin"]);

export function caseActionLabels(status: CaseStatus, role: CurrentUser["role"]): CaseAction[] {
  if (role === "agent") return status === "changes_requested" ? [{ kind: "start_review", label: "Resubmit for review", variant: "primary" }] : [];
  if (!staffRoles.has(role)) return [];
  switch (status) {
    case "submitted": return [{ kind: "start_review", label: "Start review", variant: "primary" }, { kind: "cancel", label: "Cancel case", variant: "danger", requiresReason: true }];
    case "under_review": return [{ kind: "pass_review", label: "Pass review", variant: "primary" }, { kind: "request_changes", label: "Request changes", variant: "secondary", requiresReason: true }, { kind: "cancel", label: "Cancel case", variant: "danger", requiresReason: true }];
    case "quotation_issued": return [{ kind: "generate_schedule", label: "Generate payment schedule", variant: "secondary" }, { kind: "issue_quotation", label: "Issue quotation", variant: "primary" }, { kind: "cancel", label: "Cancel case", variant: "danger", requiresReason: true }];
    case "awaiting_deposit": return [{ kind: "verify_payment", label: "Verify payment", variant: "secondary" }, { kind: "schedule_installation", label: "Schedule installation", variant: "primary" }, { kind: "cancel", label: "Cancel case", variant: "danger", requiresReason: true }];
    case "installation_scheduled": return [{ kind: "record_installation", label: "Record installation", variant: "primary" }, { kind: "cancel", label: "Cancel case", variant: "danger", requiresReason: true }];
    case "installed_monitoring": return [{ kind: "verify_savings", label: "Verify savings", variant: "secondary" }, { kind: "move_to_trial", label: "Move to trial review", variant: "primary" }, { kind: "cancel", label: "Cancel case", variant: "danger", requiresReason: true }];
    case "trial_review": return [{ kind: "accept_trial", label: "Accept trial and generate commissions", variant: "primary" }, { kind: "cancel", label: "Cancel case", variant: "danger", requiresReason: true }];
    case "active_installments": return [{ kind: "mark_completed", label: "Mark completed", variant: "primary" }, { kind: "cancel", label: "Cancel case", variant: "danger", requiresReason: true }];
    default: return [];
  }
}

export function canEditCase(actor: CurrentUser, status: CaseStatus, caseAgentId: string) {
  return actor.role === "agent" ? actor.agentId === caseAgentId && status === "changes_requested" : staffRoles.has(actor.role);
}

export function canProcessCases(actor: CurrentUser) { return staffRoles.has(actor.role); }
