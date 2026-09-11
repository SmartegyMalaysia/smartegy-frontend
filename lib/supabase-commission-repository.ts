import { getSupabaseBrowserClient, normalizeSupabaseError } from "./supabase-browser";
import { aggregateCommissionRows, filterAndSortCommissionRecords, type CommissionRow } from "./commission-aggregation";
import type { AgentCommissionRecord, CommissionOverview, CurrentUser } from "./types";
import type { AgentCommissionsRepository, CommissionDirectoryQuery, CommissionResult } from "./commission-repository";

function failure<T>(error: any): CommissionResult<T> { const normalized = normalizeSupabaseError(error); return { ok: false, error: { code: normalized.code === "FORBIDDEN" ? "FORBIDDEN" : normalized.code === "NOT_FOUND" ? "NOT_FOUND" : "INTERNAL_ERROR", message: normalized.message } }; }
function guard(actor: CurrentUser) { return actor.role === "agent" && Boolean(actor.agentId); }
function overview(items: AgentCommissionRecord[]): CommissionOverview { const total = items.reduce((sum, item) => sum + item.entitlementSen, 0); const paid = items.reduce((sum, item) => sum + item.paidToDateSen, 0); const remaining = items.reduce((sum, item) => sum + item.deferredBalanceSen, 0); const upcoming = items.flatMap((item) => item.schedule.filter((entry) => entry.status !== "paid" && entry.status !== "withheld")).sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0]; return { totalEntitlementSen: total, paidToDateSen: paid, remainingBalanceSen: remaining, upcomingPayoutSen: upcoming?.amountSen ?? null, upcomingPayoutDate: upcoming?.dueDate ?? null }; }

export const supabaseAgentCommissionsRepository: AgentCommissionsRepository = {
  async list(actor) {
    if (!guard(actor)) return failure({ code: "42501", message: "Only agents can access their own commission records." });
    const supabase = getSupabaseBrowserClient(); if (!supabase) return failure({ message: "Supabase is not configured" });
    const { data, error } = await supabase.from("agent_commission_statement").select("*").eq("agent_id", actor.agentId).order("due_date", { ascending: true });
    if (error) return failure(error);
    return { ok: true, data: aggregateCommissionRows((data ?? []) as CommissionRow[]) };
  },
  async listPage(actor, query: CommissionDirectoryQuery) {
    if (!guard(actor)) return failure({ code: "42501", message: "Only agents can access their own commission records." });
    const supabase = getSupabaseBrowserClient(); if (!supabase) return failure({ message: "Supabase is not configured" });
    const { data, error } = await supabase.from("agent_commission_statement").select("*").eq("agent_id", actor.agentId).order("due_date", { ascending: true });
    if (error) return failure(error);
    const filtered = filterAndSortCommissionRecords(aggregateCommissionRows((data ?? []) as CommissionRow[]), query);
    const pageSize = Math.min(10000, Math.max(1, query.pageSize ?? 5)); const page = Math.max(1, query.page ?? 1);
    return { ok: true, data: { items: filtered.slice((page - 1) * pageSize, page * pageSize), totalItems: filtered.length, totalPages: Math.max(1, Math.ceil(filtered.length / pageSize)) } };
  },
  async export(actor, query: CommissionDirectoryQuery) {
    if (!guard(actor)) return failure({ code: "42501", message: "Only agents can export their own commission records." });
    const params = new URLSearchParams(); if (query.search) params.set("search", query.search); if (query.status) params.set("status", query.status); if (query.month) params.set("month", query.month); if (query.sortBy) params.set("sort_by", query.sortBy); if (query.sortDirection) params.set("sort_direction", query.sortDirection);
    try { const response = await fetch(`/api/exports/commissions?${params.toString()}`, { credentials: "same-origin" }); if (!response.ok) return failure({ code: response.status === 403 ? "42501" : "PGRST000", message: "Unable to export commissions." }); const blob = await response.blob(); const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = "smartegy-commissions.csv"; link.click(); URL.revokeObjectURL(link.href); return { ok: true, data: true }; } catch (error) { return failure(error); }
  },
  async getOverview(actor) { const result = await this.list(actor); return result.ok ? { ok: true, data: overview(result.data) } : result; },
  async getById(actor, commissionId) { const result = await this.list(actor); if (!result.ok) return result; const found = result.data.find((item) => item.id === commissionId); return found ? { ok: true, data: found } : failure({ code: "PGRST116", message: "Commission record not found." }); },
};
