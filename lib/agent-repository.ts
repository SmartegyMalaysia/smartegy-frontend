import { buildQualification, mockAgents, mockCases, mockCommissions } from "./mock-data";
import type { AgentLevel, AgentLevelChangeApproval, AgentLevelChangeRequest, AgentPromotionAudit, AgentSummary, AgentWorkspaceDetail, CurrentUser, ID } from "./types";

type AgentErrorCode = "FORBIDDEN" | "NOT_FOUND" | "NOT_ELIGIBLE" | "CONFLICT";
export type AgentResult<T> = { ok: true; data: T } | { ok: false; error: { code: AgentErrorCode; message: string } };
export interface AgentRepository { list(actor: CurrentUser): Promise<AgentResult<AgentSummary[]>>; getById(actor: CurrentUser, agentId: ID): Promise<AgentResult<AgentWorkspaceDetail>>; listLevelChangeApprovals(actor: CurrentUser): Promise<AgentResult<AgentLevelChangeApproval[]>>; requestLevelChange(actor: CurrentUser, input: { agentId: ID; direction: "promote" | "demote"; reason?: string }): Promise<AgentResult<AgentSummary>>; reviewLevelChange(actor: CurrentUser, input: { agentId: ID; requestId: ID; decision: "approve" | "reject"; note?: string }): Promise<AgentResult<AgentSummary>>; }

let agents: AgentSummary[] = structuredClone(mockAgents);
function permitted(actor: CurrentUser) { return actor.role === "staff" || actor.role === "admin"; }
function admin(actor: CurrentUser) { return actor.role === "admin"; }
function fail<T>(code: AgentErrorCode, message: string): AgentResult<T> { return { ok: false, error: { code, message } }; }
function promotionRequirements(agent: AgentSummary) { const qualification = agent.qualification; if (qualification.nextLevel === null) return "Agent is already at the highest level."; const missing: string[] = []; if (qualification.successfulCases.required !== null && qualification.successfulCases.current < qualification.successfulCases.required) missing.push(`${qualification.successfulCases.required - qualification.successfulCases.current} more successful case${qualification.successfulCases.required - qualification.successfulCases.current === 1 ? "" : "s"}`); if (qualification.directAgents.required !== null && qualification.directAgents.current < qualification.directAgents.required) missing.push(`${qualification.directAgents.required - qualification.directAgents.current} more direct agent${qualification.directAgents.required - qualification.directAgents.current === 1 ? "" : "s"}`); if (qualification.annualSalesSen.required !== null && qualification.annualSalesSen.current < qualification.annualSalesSen.required) missing.push("annual sales threshold"); return missing.join(", "); }

export const mockAgentRepository: AgentRepository = {
  async list(actor) { if (!permitted(actor)) return fail("FORBIDDEN", "Only staff and administrators can view all agents."); return { ok: true, data: structuredClone(agents) }; },
  async getById(actor, agentId) {
    if (!permitted(actor)) return fail("FORBIDDEN", "Only staff and administrators can view agent details.");
    const agent = agents.find((item) => item.id === agentId); if (!agent) return fail("NOT_FOUND", "Agent not found.");
    const uplineAgents: AgentSummary[] = []; let uplineId = agent.uplineAgentId;
    while (uplineId) { const upline = agents.find((item) => item.id === uplineId); if (!upline) break; uplineAgents.push(structuredClone(upline)); uplineId = upline.uplineAgentId; }
    return { ok: true, data: { agent: structuredClone(agent), sales: structuredClone(mockCases.filter((sale) => sale.agentId === agent.id)), commissions: structuredClone(mockCommissions.filter((commission) => commission.recipientId === agent.id)), uplineAgents, downlineAgents: structuredClone(agents.filter((item) => item.uplineAgentId === agent.id)) } };
  },
  async listLevelChangeApprovals(actor) {
    if (!admin(actor)) return fail("FORBIDDEN", "Only an administrator can view level-change approvals.");
    const approvals = agents.flatMap((agent) => agent.levelChangeRequests.map((request) => ({ ...request, agent: structuredClone(agent) }))).toSorted((a, b) => {
      if (a.status === "pending" && b.status !== "pending") return -1;
      if (a.status !== "pending" && b.status === "pending") return 1;
      return b.requestedAt.localeCompare(a.requestedAt);
    });
    return { ok: true, data: approvals };
  },
  async requestLevelChange(actor, input) {
    if (!permitted(actor)) return fail("FORBIDDEN", "Only staff and administrators can request a level change.");
    const agent = agents.find((item) => item.id === input.agentId); if (!agent) return fail("NOT_FOUND", "Agent not found.");
    if (agent.levelChangeRequests.some((request) => request.status === "pending")) return fail("CONFLICT", "This agent already has a level-change request awaiting admin review.");
    const requestedLevel = input.direction === "promote" ? agent.qualification.nextLevel : agent.currentLevel > 1 ? (agent.currentLevel - 1) as AgentLevel : null;
    if (input.direction === "promote" && (!agent.qualification.eligibleForPromotion || requestedLevel === null)) return fail("NOT_ELIGIBLE", `This agent is not eligible for promotion: ${promotionRequirements(agent)}`);
    if (requestedLevel === null) return fail("NOT_ELIGIBLE", "A Level 1 agent cannot be demoted.");
    const request: AgentLevelChangeRequest = { id: `level-change-${Date.now()}`, agentId: agent.id, previousLevel: agent.currentLevel, requestedLevel, requestedById: actor.id, requestedByDisplayName: actor.displayName, requestedAt: new Date().toISOString(), status: "pending", reviewedById: null, reviewedByDisplayName: null, reviewedAt: null, reason: input.reason?.trim() || null };
    agent.levelChangeRequests.unshift(request); return { ok: true, data: structuredClone(agent) };
  },
  async reviewLevelChange(actor, input) {
    if (!admin(actor)) return fail("FORBIDDEN", "Only an administrator can approve or reject a level-change request.");
    const agent = agents.find((item) => item.id === input.agentId); if (!agent) return fail("NOT_FOUND", "Agent not found.");
    const request = agent.levelChangeRequests.find((item) => item.id === input.requestId); if (!request) return fail("NOT_FOUND", "Level-change request not found.");
    if (request.status !== "pending") return fail("CONFLICT", "This level-change request has already been reviewed.");
    request.status = input.decision === "approve" ? "approved" : "rejected"; request.reviewedById = actor.id; request.reviewedByDisplayName = actor.displayName; request.reviewedAt = new Date().toISOString(); if (input.note?.trim()) request.reason = input.note.trim();
    if (input.decision === "approve") { const previousLevel = agent.currentLevel; agent.currentLevel = request.requestedLevel; agent.qualification = buildQualification(request.requestedLevel, agent.successfulCaseCount, agent.directAgentCount, agent.annualSalesSen); const audit: AgentPromotionAudit = { id: `agent-level-change-${Date.now()}`, agentId: agent.id, previousLevel, newLevel: request.requestedLevel, actorId: actor.id, actorDisplayName: actor.displayName, occurredAt: request.reviewedAt, note: request.reason }; agent.promotionHistory.unshift(audit); }
    return { ok: true, data: structuredClone(agent) };
  },
};

export function resetMockAgents() { agents = structuredClone(mockAgents); }

import { isSupabaseConfigured } from "./supabase-browser";
import { supabaseAgentRepository } from "./supabase-agent-repository";

export const agentRepository: AgentRepository = isSupabaseConfigured() ? supabaseAgentRepository : mockAgentRepository;
