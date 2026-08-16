import { getSupabaseBrowserClient, normalizeSupabaseError } from "./supabase-browser";
import type { AgentCommissionRecord, CommissionOverview, CurrentUser, ID } from "./types";
import type { AgentCommissionsRepository, CommissionResult } from "./commission-repository";

function rmToSen(value: unknown) { return Math.round(Number(value ?? 0) * 100); }
function failure<T>(error: any): CommissionResult<T> { const normalized = normalizeSupabaseError(error); return { ok: false, error: { code: normalized.code === "FORBIDDEN" ? "FORBIDDEN" : normalized.code === "NOT_FOUND" ? "NOT_FOUND" : "INTERNAL_ERROR", message: normalized.message } }; }
function guard(actor: CurrentUser) { return actor.role === "agent" && Boolean(actor.agentId); }
function mapRow(row: any): AgentCommissionRecord {
  const amountSen = rmToSen(row.amount);
  return { id: row.id, commissionNumber: row.id, caseId: row.case_id, caseNumber: row.case_number, recipientId: row.agent_id, recipientName: "", recipientKind: row.intended_level === "level_1" ? "level_1_agent" : row.intended_level === "level_2" ? "level_2_agent" : row.intended_level === "level_3" ? "level_3_agent" : "office", entitlementSen: amountSen, firstPaymentSen: row.kind === "initial" ? amountSen : 0, deferredBalanceSen: row.kind === "deferred" ? amountSen : 0, paidToDateSen: row.status === "paid" ? amountSen : 0, nextPaymentDate: row.status === "paid" ? null : row.due_date, nextPaymentSen: row.status === "paid" ? null : amountSen, status: row.status, customerDisplayName: row.customer_name, eligibilityStatus: row.status === "withheld" ? "pending" : "eligible", lastUpdatedAt: row.paid_at ?? row.due_date ?? new Date().toISOString(), schedule: [{ id: row.id, sequence: Number(row.installment_no ?? 0), dueDate: row.due_date, amountSen, status: row.status, paidAt: row.paid_at, paymentReference: row.bank_reference, note: null }], withheldReason: row.status === "withheld" ? "Commission withheld pending review" : null, adjustmentNote: null, qualifyingPaymentDate: null };
}
function overview(items: AgentCommissionRecord[]): CommissionOverview { const total = items.reduce((sum, item) => sum + item.entitlementSen, 0); const paid = items.reduce((sum, item) => sum + item.paidToDateSen, 0); const upcoming = items.flatMap((item) => item.schedule.filter((entry) => entry.status !== "paid")).sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0]; return { totalEntitlementSen: total, paidToDateSen: paid, remainingBalanceSen: Math.max(0, total - paid), upcomingPayoutSen: upcoming?.amountSen ?? null, upcomingPayoutDate: upcoming?.dueDate ?? null }; }

export const supabaseAgentCommissionsRepository: AgentCommissionsRepository = {
  async list(actor) {
    if (!guard(actor)) return failure({ code: "42501", message: "Only agents can access their own commission records." });
    const supabase = getSupabaseBrowserClient(); if (!supabase) return failure({ message: "Supabase is not configured" });
    const { data, error } = await supabase.from("agent_commission_statement").select("*").eq("agent_id", actor.agentId).order("due_date", { ascending: true });
    if (error) return failure(error);
    return { ok: true, data: (data ?? []).map(mapRow) };
  },
  async getOverview(actor) { const result = await this.list(actor); return result.ok ? { ok: true, data: overview(result.data) } : result; },
  async getById(actor, commissionId) { const result = await this.list(actor); if (!result.ok) return result; const found = result.data.find((item) => item.id === commissionId); return found ? { ok: true, data: found } : failure({ code: "PGRST116", message: "Commission record not found." }); },
};
