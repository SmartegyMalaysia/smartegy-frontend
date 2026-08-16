import { getSupabaseBrowserClient, normalizeSupabaseError } from "./supabase-browser";
import type { AgentLevel, AgentLevelChangeApproval, AgentLevelChangeRequest, AgentPromotionAudit, AgentSummary, AgentWorkspaceDetail, CurrentUser, ID } from "./types";
import type { AgentRepository, AgentResult } from "./agent-repository";

function level(value: unknown): AgentLevel { return value === "level_3" ? 3 : value === "level_2" ? 2 : 1; }
function rmToSen(value: unknown) { return Math.round(Number(value ?? 0) * 100); }
function errorResult<T>(error: any): AgentResult<T> { const normalized = normalizeSupabaseError(error); const code = normalized.code === "NOT_FOUND" ? "NOT_FOUND" : normalized.code === "FORBIDDEN" ? "FORBIDDEN" : normalized.code === "DUPLICATE" ? "CONFLICT" : "NOT_ELIGIBLE"; return { ok: false, error: { code, message: normalized.message } }; }
function permitted(actor: CurrentUser) { return actor.role === "staff" || actor.role === "admin"; }
function admin(actor: CurrentUser) { return actor.role === "admin"; }

function qualification(row: any, current: AgentLevel) {
  const next = current < 3 ? (current + 1) as AgentLevel : null;
  const successfulCases = Number(row?.personal_successful_cases ?? 0);
  const directAgents = Number(row?.active_direct_recruits ?? 0);
  const annualSalesSen = rmToSen(row?.annual_organization_sales);
  const eligibleForPromotion = current === 1 ? Boolean(row?.level_2_eligible) : current === 2 ? Boolean(row?.level_3_eligible) : false;
  return { currentLevel: current, successfulCases: { current: successfulCases, required: current === 1 ? 6 : null }, directAgents: { current: directAgents, required: current === 1 ? 1 : null }, annualSalesSen: { current: annualSalesSen, required: current === 2 ? 300000000 : null }, eligibleForPromotion, nextLevel: eligibleForPromotion ? next : null };
}

function mapRequest(row: any, agent: AgentSummary): AgentLevelChangeApproval {
  return { id: row.id, agentId: agent.id, previousLevel: Math.max(1, level(row.metrics_snapshot?.current_level ?? agent.currentLevel)) as AgentLevel, requestedLevel: level(row.requested_level), requestedById: row.requested_by, requestedByDisplayName: row.requested_by_name ?? "Staff", requestedAt: row.requested_at, status: row.status, reviewedById: row.reviewed_by, reviewedByDisplayName: row.reviewed_by_name ?? null, reviewedAt: row.reviewed_at, reason: row.review_reason ?? null, agent };
}

async function mapAgent(row: any, supabase: any): Promise<AgentSummary> {
  const currentLevel = level(row.current_level);
  const [{ data: metrics }, { data: history }, { data: requests }] = await Promise.all([
    supabase.rpc("get_agent_qualification_progress", { p_agent_id: row.id }),
    supabase.from("agent_level_history").select("*").eq("agent_id", row.id).order("effective_at", { ascending: false }),
    supabase.from("promotion_requests").select("*").eq("agent_id", row.id).order("requested_at", { ascending: false }),
  ]);
  const metric = Array.isArray(metrics) ? metrics[0] : metrics;
  const mappedHistory: AgentPromotionAudit[] = (history ?? []).map((item: any) => ({ id: item.id, agentId: item.agent_id, previousLevel: level(item.from_level), newLevel: level(item.to_level), actorId: item.approved_by ?? "system", actorDisplayName: "Administrator", occurredAt: item.effective_at, note: item.reason }));
  const summary: AgentSummary = { id: row.id, agentCode: row.agent_code, displayName: row.legal_name, currentLevel, uplineAgentId: row.upline_agent_id, uplineName: row.upline?.legal_name ?? null, directAgentCount: Number(metric?.active_direct_recruits ?? 0), successfulCaseCount: Number(metric?.personal_successful_cases ?? 0), personalSalesSen: 0, referralSalesSen: rmToSen(metric?.annual_organization_sales), annualSalesSen: rmToSen(metric?.annual_organization_sales), commissionEarnedSen: 0, status: row.is_active ? "active" : "inactive", qualification: qualification(metric, currentLevel), promotionHistory: mappedHistory, levelChangeRequests: (requests ?? []).map((item: any) => ({ id: item.id, agentId: item.agent_id, previousLevel: currentLevel, requestedLevel: level(item.requested_level), requestedById: item.requested_by, requestedByDisplayName: "Staff", requestedAt: item.requested_at, status: item.status, reviewedById: item.reviewed_by, reviewedByDisplayName: null, reviewedAt: item.reviewed_at, reason: item.review_reason ?? null })) };
  return summary;
}

export const supabaseAgentRepository: AgentRepository = {
  async list(actor) {
    if (!permitted(actor)) return errorResult({ code: "42501", message: "Only staff and administrators can view all agents." });
    const supabase = getSupabaseBrowserClient(); if (!supabase) return errorResult({ message: "Supabase is not configured" });
    const { data, error } = await supabase.from("agents").select("*,upline:agents!upline_agent_id(legal_name)").order("legal_name");
    if (error) return errorResult(error);
    try { return { ok: true, data: await Promise.all((data ?? []).map((row: any) => mapAgent(row, supabase))) }; } catch (error) { return errorResult(error); }
  },
  async getById(actor, agentId) {
    if (!permitted(actor)) return errorResult({ code: "42501", message: "Only staff and administrators can view agent details." });
    const supabase = getSupabaseBrowserClient(); if (!supabase) return errorResult({ message: "Supabase is not configured" });
    const { data, error } = await supabase.from("agents").select("*,upline:agents!upline_agent_id(legal_name)").eq("id", agentId).single();
    if (error) return errorResult(error);
    try {
      const agent = await mapAgent(data, supabase);
      const [{ data: sales }, { data: commissions }, { data: uplines }, { data: downlines }] = await Promise.all([
        supabase.from("case_overview").select("*").eq("agent_id", agentId).order("created_at", { ascending: false }),
        supabase.from("agent_commission_statement").select("*").eq("agent_id", agentId).order("due_date"),
        supabase.from("agents").select("*,upline:agents!upline_agent_id(legal_name)").eq("id", data.upline_agent_id),
        supabase.from("agents").select("*,upline:agents!upline_agent_id(legal_name)").eq("upline_agent_id", agentId),
      ]);
      const mapSale = (row: any) => ({ id: row.id, caseNumber: row.case_number, customerDisplayName: row.customer_name, agentId: row.agent_id, agentName: row.agent_name, status: row.status, paymentStatus: Number(row.outstanding_customer_balance ?? 0) > 0 ? "pending_verification" : "verified", saleAmountSen: row.sale_amount == null ? null : rmToSen(row.sale_amount), submittedAt: row.created_at, updatedAt: row.status_changed_at });
      const mapCommission = (row: any) => ({ id: row.id, commissionNumber: row.id, caseId: row.case_id, caseNumber: row.case_number, recipientId: row.agent_id, recipientName: agent.displayName, recipientKind: row.intended_level === "level_1" ? "level_1_agent" : row.intended_level === "level_2" ? "level_2_agent" : "level_3_agent", entitlementSen: rmToSen(row.amount), firstPaymentSen: row.kind === "initial" ? rmToSen(row.amount) : 0, deferredBalanceSen: row.kind === "deferred" ? rmToSen(row.amount) : 0, paidToDateSen: row.status === "paid" ? rmToSen(row.amount) : 0, nextPaymentDate: row.status === "paid" ? null : row.due_date, nextPaymentSen: row.status === "paid" ? null : rmToSen(row.amount), status: row.status });
      return { ok: true, data: { agent, sales: (sales ?? []).map(mapSale), commissions: (commissions ?? []).map(mapCommission), uplineAgents: await Promise.all((uplines ?? []).map((row: any) => mapAgent(row, supabase))), downlineAgents: await Promise.all((downlines ?? []).map((row: any) => mapAgent(row, supabase))) } as AgentWorkspaceDetail };
    } catch (error) { return errorResult(error); }
  },
  async listLevelChangeApprovals(actor) {
    if (!admin(actor)) return errorResult({ code: "42501", message: "Only an administrator can view level-change approvals." });
    const supabase = getSupabaseBrowserClient(); if (!supabase) return errorResult({ message: "Supabase is not configured" });
    const { data, error } = await supabase.from("promotion_requests").select("*,agent:agents!promotion_requests_agent_id_fkey(*)").order("requested_at", { ascending: false });
    if (error) return errorResult(error);
    try { return { ok: true, data: await Promise.all((data ?? []).map(async (row: any) => mapRequest(row, await mapAgent(row.agent, supabase)))) }; } catch (error) { return errorResult(error); }
  },
  async requestLevelChange(actor, input) {
    if (!permitted(actor)) return errorResult({ code: "42501", message: "Only staff and administrators can request a level change." });
    if (input.direction === "demote") return errorResult({ message: "Demotions are not supported by the backend workflow." });
    const supabase = getSupabaseBrowserClient(); if (!supabase) return errorResult({ message: "Supabase is not configured" });
    const { data: agent, error: agentError } = await supabase.from("agents").select("*,upline:agents!upline_agent_id(legal_name)").eq("id", input.agentId).single();
    if (agentError) return errorResult(agentError);
    const requestedLevel = level(agent.current_level) === 1 ? "level_2" : "level_3";
    const { error } = await supabase.rpc("request_agent_promotion", { p_agent_id: input.agentId, p_requested_level: requestedLevel });
    if (error) return errorResult(error);
    return { ok: true, data: await mapAgent(agent, supabase) };
  },
  async reviewLevelChange(actor, input) {
    if (!admin(actor)) return errorResult({ code: "42501", message: "Only an administrator can approve or reject a level-change request." });
    const supabase = getSupabaseBrowserClient(); if (!supabase) return errorResult({ message: "Supabase is not configured" });
    const { error } = await supabase.rpc("review_agent_promotion", { p_request_id: input.requestId, p_approve: input.decision === "approve", p_reason: input.note?.trim() || "Reviewed by administrator" });
    if (error) return errorResult(error);
    const { data: agent, error: agentError } = await supabase.from("agents").select("*,upline:agents!upline_agent_id(legal_name)").eq("id", input.agentId).single();
    if (agentError) return errorResult(agentError);
    return { ok: true, data: await mapAgent(agent, supabase) };
  },
};
