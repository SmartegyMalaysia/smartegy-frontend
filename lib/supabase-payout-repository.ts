import { getSupabaseBrowserClient, normalizeSupabaseError } from "./supabase-browser";
import type { AgentMonthlyPayout, CurrentUser, PayoutMonthSummary, PayoutTransaction } from "./types";
import type { PayoutDirectoryQuery, PayoutRepository, PayoutResult } from "./payout-repository";

function rmToSen(value: unknown) { return Math.round(Number(value ?? 0) * 100); }
function failure<T>(error: any): PayoutResult<T> { const normalized = normalizeSupabaseError(error); return { ok: false, error: { code: normalized.code === "FORBIDDEN" ? "FORBIDDEN" : normalized.code === "NOT_FOUND" ? "NOT_FOUND" : "CONFLICT", message: normalized.message } }; }
function allowed(actor: CurrentUser) { return actor.role === "staff" || actor.role === "admin"; }

async function loadTransactions(supabase: any, payoutMonth: string): Promise<PayoutTransaction[]> {
  const { data: rows, error } = await supabase.rpc("get_monthly_payout_transactions", { p_payment_period: `${payoutMonth}-01` });
  if (error) throw error;
  return (rows ?? []).map((row: any) => ({
    id: row.commission_entry_id,
    payoutMonth,
    agentId: row.agent_id,
    agentName: row.agent_name,
    agentCode: row.agent_code,
    bankAccount: { bankName: row.bank_name ?? "Not provided", accountHolderName: row.account_holder_name ?? row.agent_name, accountNumberMasked: row.account_number_masked ?? "Not provided" },
    commissionId: row.commission_entry_id,
    caseNumber: row.case_number,
    customerDisplayName: row.customer_name,
    amountSen: rmToSen(row.amount),
    settlementStatus: row.status === "paid" ? "settled" : "pending",
    settledAt: row.paid_at,
    settledById: null,
    settledByDisplayName: null,
    bankReference: row.bank_reference,
  }) as PayoutTransaction);
}

async function loadDirectory(supabase: any, payoutMonth: string, query: PayoutDirectoryQuery = {}) {
  const { data, error } = await supabase.rpc("get_monthly_payout_directory", { p_payment_period: `${payoutMonth}-01`, p_search: query.search?.trim() || null, p_agent_id: query.agentId || null, p_settlement_status: query.settlementStatus || null, p_page: query.page ?? 1, p_page_size: query.pageSize ?? 5, p_sort_by: query.sortBy ?? "agent", p_sort_direction: query.sortDirection ?? "asc", p_view: query.view ?? "transactions" });
  if (error) throw error;
  const payload = data as Record<string, any>;
  const transactions = (payload.transactions ?? []).map((row: any) => ({ id: row.commission_entry_id, payoutMonth, agentId: row.agent_id, agentName: row.agent_name, agentCode: row.agent_code, bankAccount: { bankName: row.bank_name ?? "Not provided", accountHolderName: row.account_holder_name ?? row.agent_name, accountNumberMasked: row.account_number_masked ?? "Not provided" }, commissionId: row.commission_entry_id, caseNumber: row.case_number, customerDisplayName: row.customer_name, amountSen: rmToSen(row.amount), settlementStatus: row.status === "paid" ? "settled" : "pending", settledAt: row.paid_at, settledById: null, settledByDisplayName: null, bankReference: row.bank_reference }) as PayoutTransaction);
  const agentPayouts = (payload.agent_payouts ?? []).map((row: any) => ({ agentId: row.agent_id, agentName: row.agent_name, agentCode: row.agent_code, bankAccount: { bankName: row.bank_name ?? "Not provided", accountHolderName: row.account_holder_name ?? row.agent_name, accountNumberMasked: row.account_number_masked ?? "Not provided" }, payoutMonth, totalSen: rmToSen(row.total_amount), settledSen: rmToSen(row.settled_amount), pendingSen: rmToSen(row.pending_amount), transactionCount: Number(row.transaction_count ?? 0), settledTransactionCount: Number(row.settled_transaction_count ?? 0), settlementStatus: row.settlement_status }) as AgentMonthlyPayout);
  const totalItems = Number(payload.total_items ?? transactions.length); const totalPages = Number(payload.total_pages ?? 1);
  const summary: PayoutMonthSummary = { payoutMonth, totalSen: agentPayouts.reduce((sum: number, item: AgentMonthlyPayout) => sum + item.totalSen, 0), settledSen: agentPayouts.reduce((sum: number, item: AgentMonthlyPayout) => sum + item.settledSen, 0), pendingSen: agentPayouts.reduce((sum: number, item: AgentMonthlyPayout) => sum + item.pendingSen, 0), agentCount: agentPayouts.length, settledAgentCount: agentPayouts.filter((item: AgentMonthlyPayout) => item.settlementStatus === "settled").length, transactionCount: agentPayouts.reduce((sum: number, item: AgentMonthlyPayout) => sum + item.transactionCount, 0), settledTransactionCount: agentPayouts.reduce((sum: number, item: AgentMonthlyPayout) => sum + item.settledTransactionCount, 0) };
  return { summary, agentPayouts, transactions, totalItems, totalPages };
}

function aggregate(payoutMonth: string, items: PayoutTransaction[]) {
  const groups = new Map<string, PayoutTransaction[]>();
  items.forEach((item) => groups.set(item.agentId, [...(groups.get(item.agentId) ?? []), item]));
  const agentPayouts: AgentMonthlyPayout[] = Array.from(groups.values()).map((entries) => {
    const first = entries[0];
    const totalSen = entries.reduce((sum, item) => sum + item.amountSen, 0);
    const settledEntries = entries.filter((item) => item.settlementStatus === "settled");
    const settledSen = settledEntries.reduce((sum, item) => sum + item.amountSen, 0);
    const settlementStatus: AgentMonthlyPayout["settlementStatus"] = settledEntries.length === entries.length ? "settled" : settledEntries.length ? "partially_settled" : "pending";
    return { agentId: first.agentId, agentName: first.agentName, agentCode: first.agentCode, bankAccount: first.bankAccount, payoutMonth, totalSen, settledSen, pendingSen: totalSen - settledSen, transactionCount: entries.length, settledTransactionCount: settledEntries.length, settlementStatus };
  }).toSorted((a, b) => a.agentName.localeCompare(b.agentName));
  const settledItems = items.filter((item) => item.settlementStatus === "settled");
  const totalSen = items.reduce((sum, item) => sum + item.amountSen, 0);
  const settledSen = settledItems.reduce((sum, item) => sum + item.amountSen, 0);
  const summary: PayoutMonthSummary = { payoutMonth, totalSen, settledSen, pendingSen: totalSen - settledSen, agentCount: agentPayouts.length, settledAgentCount: agentPayouts.filter((item) => item.settlementStatus === "settled").length, transactionCount: items.length, settledTransactionCount: settledItems.length };
  return { summary, agentPayouts };
}

export const supabasePayoutRepository: PayoutRepository = {
  async getMonth(actor, payoutMonth, query = {}) {
    if (!allowed(actor)) return failure({ code: "42501", message: "Only staff and administrators can view payout data." });
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return failure({ message: "Supabase is not configured" });
    try { return { ok: true, data: await loadDirectory(supabase, payoutMonth, query) }; } catch (error) { return failure(error); }
  },
  async exportMonth(actor, payoutMonth) {
    if (!allowed(actor)) return failure({ code: "42501", message: "Only staff and administrators can export payout data." });
    const response = await fetch(`/api/payouts/export?month=${encodeURIComponent(payoutMonth)}`, { credentials: "same-origin" });
    if (!response.ok) return failure({ code: response.status === 403 ? "42501" : "PGRST000", message: "Unable to export payout data." });
    const blob = await response.blob();
    const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `smartegy-payouts-${payoutMonth}.csv`; link.click(); URL.revokeObjectURL(link.href);
    return { ok: true, data: true };
  },
  async exportTransactions(actor, payoutMonth, query = {}) {
    if (!allowed(actor)) return failure({ code: "42501", message: "Only staff and administrators can export payout data." });
    const params = new URLSearchParams({ month: payoutMonth, view: "transactions" });
    if (query.search?.trim()) params.set("search", query.search.trim());
    if (query.agentId) params.set("agentId", query.agentId);
    if (query.settlementStatus && query.settlementStatus !== "all") params.set("settlementStatus", query.settlementStatus);
    const response = await fetch(`/api/payouts/export?${params.toString()}`, { credentials: "same-origin" });
    if (!response.ok) return failure({ code: response.status === 403 ? "42501" : "PGRST000", message: "Unable to export payout transactions." });
    const blob = await response.blob();
    const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `smartegy-payout-transactions-${payoutMonth}.csv`; link.click(); URL.revokeObjectURL(link.href);
    return { ok: true, data: true };
  },
  async settleTransaction(actor, input) {
    if (!allowed(actor)) return failure({ code: "42501", message: "Only staff and administrators can settle payouts." });
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return failure({ message: "Supabase is not configured" });
    if (!input.bankReference.trim()) return failure({ message: "Enter the bank settlement reference." });
    const { data, error } = await supabase.rpc("set_commission_status", { p_entry_ids: [input.transactionId], p_status: "paid", p_reason: "Payout settled", p_bank_reference: input.bankReference.trim() });
    if (error) return failure(error);
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return failure({ code: "PGRST116", message: "Payout transaction not found or is not approved." });
    const refreshed = await loadTransactions(supabase, input.payoutMonth ?? new Date().toISOString().slice(0, 7));
    const found = refreshed.find((item) => item.id === input.transactionId);
    return found ? { ok: true, data: found } : failure({ code: "PGRST116", message: "Payout transaction not found." });
  },
};
