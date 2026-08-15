import { getSupabaseBrowserClient, normalizeSupabaseError } from "./supabase-browser";
import type { DashboardRepository } from "./mock-repository";
import type { DashboardSnapshot, UserRole } from "./types";

function money(value: unknown) { return Math.round(Number(value ?? 0) * 100); }
function caseStatus(value: string) {
  if (value === "quotation_issued" || value === "awaiting_deposit") return "pending_payment";
  if (value === "installation_scheduled" || value === "installed_monitoring" || value === "trial_review" || value === "active_installments") return "active";
  if (value === "cancelled") return "completed";
  return value;
}

export const supabaseDashboardRepository: DashboardRepository = {
  async getSnapshot(role: UserRole) {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) throw new Error("Supabase is not configured");
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) throw new Error("You must be signed in.");
    const { data: profile, error: profileError } = await supabase.from("profiles").select("id,role,display_name,account_status").eq("id", auth.user.id).single();
    if (profileError) throw new Error(normalizeSupabaseError(profileError).message);
    const { data: agent } = await supabase.from("agents").select("id,agent_code,legal_name,current_level,upline_agent_id,is_active").eq("profile_id", auth.user.id).maybeSingle();
    const [{ data: caseRows, error: caseError }, { data: commissionRows, error: commissionError }, { data: agentRows, error: agentError }] = await Promise.all([
      supabase.from("case_overview").select("*").order("created_at", { ascending: false }).limit(100),
      supabase.from("agent_commission_statement").select("*").order("due_date", { ascending: true }).limit(500),
      supabase.from("agents").select("id,agent_code,legal_name,current_level,upline_agent_id,is_active").limit(500),
    ]);
    if (caseError) throw new Error(normalizeSupabaseError(caseError).message);
    if (commissionError) throw new Error(normalizeSupabaseError(commissionError).message);
    if (agentError) throw new Error(normalizeSupabaseError(agentError).message);
    const cases = (caseRows ?? []).map((row: any) => ({ id: row.id, caseNumber: row.case_number, customerDisplayName: row.customer_name, agentId: row.agent_id, agentName: row.agent_name, status: caseStatus(row.status), paymentStatus: Number(row.outstanding_customer_balance ?? 0) > 0 ? "pending_verification" : "verified", saleAmountSen: row.sale_amount == null ? null : money(row.sale_amount), submittedAt: row.created_at, updatedAt: row.status_changed_at }));
    const commissions = (commissionRows ?? []).map((row: any) => ({ id: row.id, commissionNumber: row.id, caseId: row.case_id, caseNumber: row.case_number, recipientId: row.agent_id, recipientName: role === "agent" ? profile.display_name : row.agent_id, recipientKind: row.intended_level === "level_1" ? "level_1_agent" : row.intended_level === "level_2" ? "level_2_agent" : row.intended_level === "level_3" ? "level_3_agent" : "office", entitlementSen: money(row.amount), firstPaymentSen: row.kind === "initial" ? money(row.amount) : 0, deferredBalanceSen: row.kind === "deferred" ? money(row.amount) : 0, paidToDateSen: row.status === "paid" ? money(row.amount) : 0, nextPaymentDate: row.status === "paid" ? null : row.due_date, nextPaymentSen: row.status === "paid" ? null : money(row.amount), status: row.status }));
    const agents = (agentRows ?? []).map((row: any) => ({ id: row.id, agentCode: row.agent_code, displayName: row.legal_name, currentLevel: Number(row.current_level?.slice(-1) ?? 1) as 1 | 2 | 3, uplineAgentId: row.upline_agent_id, uplineName: null, directAgentCount: 0, successfulCaseCount: 0, personalSalesSen: 0, referralSalesSen: 0, annualSalesSen: 0, commissionEarnedSen: 0, status: row.is_active ? "active" : "inactive", qualification: { currentLevel: Number(row.current_level?.slice(-1) ?? 1) as 1 | 2 | 3, successfulCases: { current: 0, required: null }, directAgents: { current: 0, required: null }, annualSalesSen: { current: 0, required: null }, eligibleForPromotion: false, nextLevel: null }, promotionHistory: [], levelChangeRequests: [] }));
    return { currentUser: { id: profile.id, role: profile.role as UserRole, displayName: profile.display_name, email: auth.user.email ?? null, agentId: agent?.id ?? null, accountStatus: profile.account_status }, cases, commissions, agents } as DashboardSnapshot;
  },
};
