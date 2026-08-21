import { getSupabaseBrowserClient, normalizeSupabaseError } from "./supabase-browser";
import type { DashboardRepository } from "./mock-repository";
import type { CaseStatus, CurrentUser, DashboardSnapshot, UserRole } from "./types";

function money(value: unknown) { return Math.round(Number(value ?? 0) * 100); }
function caseStatus(value: string) { return value as CaseStatus; }

export const supabaseDashboardRepository: DashboardRepository = {
  async getSnapshot(actor: CurrentUser) {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) throw new Error("Supabase is not configured");
    const { data, error } = await supabase.rpc("get_dashboard_snapshot");
    if (error) throw new Error(normalizeSupabaseError(error).message);
    const payload = data as Record<string, any>;
    const cases = (payload.cases ?? []).map((row: any) => ({ id: row.id, caseNumber: row.case_number, customerDisplayName: row.customer_name, agentId: row.agent_id, agentName: row.agent_name, status: caseStatus(row.status), paymentStatus: row.payment_status, saleAmountSen: row.sale_amount == null ? null : money(row.sale_amount), submittedAt: row.created_at, updatedAt: row.status_changed_at }));
    const commissions = (payload.commissions ?? []).map((row: any) => ({ id: row.id, caseId: row.case_id, caseNumber: row.case_number, recipientId: row.agent_id, recipientName: actor.role === "agent" ? actor.displayName : row.agent_id, recipientKind: row.intended_level === "level_1" ? "level_1_agent" : row.intended_level === "level_2" ? "level_2_agent" : row.intended_level === "level_3" ? "level_3_agent" : "office", entitlementSen: money(row.amount), firstPaymentSen: row.kind === "initial" ? money(row.amount) : 0, deferredBalanceSen: row.kind === "deferred" ? money(row.amount) : 0, paidToDateSen: row.status === "paid" ? money(row.amount) : 0, nextPaymentDate: row.status === "paid" ? null : row.due_date, nextPaymentSen: row.status === "paid" ? null : money(row.amount), status: row.status }));
    const agents = (payload.agents ?? []).map((row: any) => row);
    return { currentUser: actor, cases, commissions, agents } as DashboardSnapshot;
  },
};
