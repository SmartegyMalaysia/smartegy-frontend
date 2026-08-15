import { getSupabaseBrowserClient, normalizeSupabaseError } from "./supabase-browser";
import type { AgentMonthlyPayout, CurrentUser, PayoutMonthSummary, PayoutTransaction } from "./types";
import type { PayoutRepository, PayoutResult } from "./payout-repository";

function rmToSen(value: unknown) { return Math.round(Number(value ?? 0) * 100); }
function failure<T>(error: any): PayoutResult<T> { const normalized = normalizeSupabaseError(error); return { ok: false, error: { code: normalized.code === "FORBIDDEN" ? "FORBIDDEN" : normalized.code === "NOT_FOUND" ? "NOT_FOUND" : "CONFLICT", message: normalized.message } }; }
function allowed(actor: CurrentUser) { return actor.role === "staff" || actor.role === "admin"; }

async function loadTransactions(supabase: any, payoutMonth: string): Promise<PayoutTransaction[]> {
  const start = `${payoutMonth}-01`; const end = new Date(`${start}T00:00:00Z`); end.setUTCMonth(end.getUTCMonth() + 1);
  const { data: entries, error } = await supabase.from("commission_entries").select("*").in("status", ["approved", "paid"]).gte("due_date", start).lt("due_date", end.toISOString().slice(0, 10)).eq("recipient_type", "agent");
  if (error) throw error;
  const agentIds = Array.from(new Set((entries ?? []).map((row: any) => row.recipient_agent_id).filter(Boolean)));
  const caseIds = Array.from(new Set((entries ?? []).map((row: any) => row.case_id).filter(Boolean)));
  const [{ data: agents, error: agentsError }, { data: cases, error: casesError }] = await Promise.all([
    agentIds.length ? supabase.from("agents").select("id,agent_code,legal_name").in("id", agentIds) : { data: [], error: null },
    caseIds.length ? supabase.from("cases").select("id,case_number,customer_id").in("id", caseIds) : { data: [], error: null },
  ]);
  if (agentsError) throw agentsError; if (casesError) throw casesError;
  const customerIds = Array.from(new Set((cases ?? []).map((row: any) => row.customer_id).filter(Boolean)));
  const { data: customers, error: customersError } = customerIds.length ? await supabase.from("customers").select("id,legal_name").in("id", customerIds) : { data: [], error: null };
  if (customersError) throw customersError;
  const agentRows: any[] = agents ?? []; const caseRows: any[] = cases ?? []; const customerRows: any[] = customers ?? [];
  const agentMap = new Map<string, any>(agentRows.map((row: any) => [row.id, row])); const caseMap = new Map<string, any>(caseRows.map((row: any) => [row.id, row])); const customerMap = new Map<string, any>(customerRows.map((row: any) => [row.id, row]));
  const details = agentIds.length ? await supabase.from("agent_payment_details").select("agent_id,bank_name,account_holder_name,account_number").in("agent_id", agentIds) : { data: [], error: null }; if (details.error) throw details.error;
  const detailMap = new Map<string, any>((details.data ?? []).map((row: any) => [row.agent_id, row]));
  return (entries ?? []).map((row: any) => { const agent = agentMap.get(row.recipient_agent_id); const currentCase = caseMap.get(row.case_id); const customer = currentCase ? customerMap.get(currentCase.customer_id) : null; const account = detailMap.get(row.recipient_agent_id); return { id: row.id, payoutMonth, agentId: row.recipient_agent_id, agentName: agent?.legal_name ?? "Unknown agent", agentCode: agent?.agent_code ?? "", bankAccount: { bankName: account?.bank_name ?? "Not provided", accountHolderName: account?.account_holder_name ?? agent?.legal_name ?? "", accountNumberMasked: account?.account_number ? `•••• ${String(account.account_number).slice(-4)}` : "Not provided" }, commissionId: row.id, commissionNumber: row.id, caseNumber: currentCase?.case_number ?? "", customerDisplayName: customer?.legal_name ?? "", amountSen: rmToSen(row.amount), settlementStatus: row.status === "paid" ? "settled" : "pending", settledAt: row.paid_at, settledById: row.paid_by, settledByDisplayName: null, bankReference: row.bank_reference } as PayoutTransaction; });
}

function aggregate(payoutMonth: string, items: PayoutTransaction[]) {
  const groups = new Map<string, PayoutTransaction[]>(); items.forEach((item) => groups.set(item.agentId, [...(groups.get(item.agentId) ?? []), item]));
  const agentPayouts: AgentMonthlyPayout[] = Array.from(groups.values()).map((entries) => { const first = entries[0]; const totalSen = entries.reduce((sum, item) => sum + item.amountSen, 0); const settledSen = entries.filter((item) => item.settlementStatus === "settled").reduce((sum, item) => sum + item.amountSen, 0); const settledTransactionCount = entries.filter((item) => item.settlementStatus === "settled").length; return { agentId: first.agentId, agentName: first.agentName, agentCode: first.agentCode, bankAccount: first.bankAccount, payoutMonth, totalSen, settledSen, pendingSen: totalSen - settledSen, transactionCount: entries.length, settledTransactionCount, settlementStatus: settledTransactionCount === entries.length ? "settled" : settledTransactionCount ? "partially_settled" : "pending" }; });
  const totalSen = items.reduce((sum, item) => sum + item.amountSen, 0); const settledSen = items.filter((item) => item.settlementStatus === "settled").reduce((sum, item) => sum + item.amountSen, 0); const settledTransactionCount = items.filter((item) => item.settlementStatus === "settled").length;
  const summary: PayoutMonthSummary = { payoutMonth, totalSen, settledSen, pendingSen: totalSen - settledSen, agentCount: agentPayouts.length, settledAgentCount: agentPayouts.filter((item) => item.settlementStatus === "settled").length, transactionCount: items.length, settledTransactionCount };
  return { summary, agentPayouts };
}

export const supabasePayoutRepository: PayoutRepository = {
  async getMonth(actor, payoutMonth) { if (!allowed(actor)) return failure({ code: "42501", message: "Only staff and administrators can view payout data." }); const supabase = getSupabaseBrowserClient(); if (!supabase) return failure({ message: "Supabase is not configured" }); try { const transactions = await loadTransactions(supabase, payoutMonth); return { ok: true, data: { ...aggregate(payoutMonth, transactions), transactions } }; } catch (error) { return failure(error); } },
  async settleTransaction(actor, input) { if (!allowed(actor)) return failure({ code: "42501", message: "Only staff and administrators can settle payouts." }); const supabase = getSupabaseBrowserClient(); if (!supabase) return failure({ message: "Supabase is not configured" }); if (!input.bankReference.trim()) return failure({ message: "Enter the bank settlement reference." }); const { data, error } = await supabase.rpc("set_commission_status", { p_entry_ids: [input.transactionId], p_status: "paid", p_reason: "Payout settled", p_bank_reference: input.bankReference.trim() }); if (error) return failure(error); const row = Array.isArray(data) ? data[0] : data; if (!row) return failure({ code: "PGRST116", message: "Payout transaction not found or is not approved." }); const refreshed = await loadTransactions(supabase, new Date().toISOString().slice(0, 7)); const found = refreshed.find((item) => item.id === input.transactionId); return found ? { ok: true, data: found } : failure({ code: "PGRST116", message: "Payout transaction not found." }); },
};
