import { mockDashboard } from "./mock-data";
import type { AgentCommissionRecord, CommissionOverview, CommissionStatus, CurrentUser, ID } from "./types";

export type CommissionResult<T> = { ok: true; data: T } | { ok: false; error: { code: "FORBIDDEN" | "NOT_FOUND" | "INTERNAL_ERROR"; message: string } };

function addMonths(date: string, months: number) { const next = new Date(`${date}T00:00:00Z`); next.setUTCMonth(next.getUTCMonth() + months); return next.toISOString().slice(0, 10); }
function buildSchedule(id: string, deferredBalanceSen: number, startDate: string, paidSequences: number[] = []): AgentCommissionRecord["schedule"] {
  const base = Math.floor(deferredBalanceSen / 17);
  const remainder = deferredBalanceSen - base * 16;
  return Array.from({ length: 17 }, (_, index) => { const sequence = index + 1; const paid = paidSequences.includes(sequence); return { id: `${id}-instalment-${sequence}`, sequence, dueDate: addMonths(startDate, index), amountSen: sequence === 17 ? remainder : base, status: paid ? "paid" : "scheduled", paidAt: paid ? `${addMonths(startDate, index)}T09:00:00Z` : null, paymentReference: paid ? `SMG-PAY-${String(sequence).padStart(3, "0")}` : null, note: null }; });
}

const source = mockDashboard("agent").commissions[0];
const records: AgentCommissionRecord[] = source ? [{ ...source, customerDisplayName: "Kencana Packaging Sdn Bhd", eligibilityStatus: "eligible", lastUpdatedAt: "2026-08-04T07:00:00Z", qualifyingPaymentDate: "2026-07-31", schedule: buildSchedule(source.id, source.deferredBalanceSen, "2026-09-15"), withheldReason: null, adjustmentNote: null }] : [];

export interface AgentCommissionsRepository {
  getOverview(actor: CurrentUser): Promise<CommissionResult<CommissionOverview>>;
  list(actor: CurrentUser): Promise<CommissionResult<AgentCommissionRecord[]>>;
  getById(actor: CurrentUser, commissionId: ID): Promise<CommissionResult<AgentCommissionRecord>>;
}

function access(actor: CurrentUser) { return actor.role === "agent" && Boolean(actor.agentId); }
function forbidden<T>(): CommissionResult<T> { return { ok: false, error: { code: "FORBIDDEN", message: "Only agents can access their own commission records." } }; }
function overview(): CommissionOverview { const totalEntitlementSen = records.reduce((sum, item) => sum + item.entitlementSen, 0); const paidToDateSen = records.reduce((sum, item) => sum + item.paidToDateSen, 0); const remainingBalanceSen = records.reduce((sum, item) => sum + item.deferredBalanceSen, 0); const upcoming = records.flatMap((item) => item.schedule.filter((entry) => entry.status === "scheduled")).sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0]; return { totalEntitlementSen, paidToDateSen, remainingBalanceSen, upcomingPayoutSen: upcoming?.amountSen ?? null, upcomingPayoutDate: upcoming?.dueDate ?? null }; }

export const mockAgentCommissionsRepository: AgentCommissionsRepository = {
  async getOverview(actor) { await new Promise((resolve) => setTimeout(resolve, 90)); if (!access(actor)) return forbidden(); return { ok: true, data: overview() }; },
  async list(actor) { await new Promise((resolve) => setTimeout(resolve, 120)); if (!access(actor)) return forbidden(); return { ok: true, data: records.filter((item) => item.recipientId === actor.agentId) }; },
  async getById(actor, commissionId) { await new Promise((resolve) => setTimeout(resolve, 90)); if (!access(actor)) return forbidden(); const record = records.find((item) => item.id === commissionId && item.recipientId === actor.agentId); return record ? { ok: true, data: record } : { ok: false, error: { code: "NOT_FOUND", message: "Commission record not found." } }; },
};

export const commissionStatuses: Array<CommissionStatus | "all"> = ["all", "calculated", "scheduled", "approved", "paid", "withheld", "adjusted", "reversed"];

import { isSupabaseConfigured } from "./supabase-browser";
import { supabaseAgentCommissionsRepository } from "./supabase-commission-repository";
export const agentCommissionsRepository: AgentCommissionsRepository = isSupabaseConfigured() ? supabaseAgentCommissionsRepository : mockAgentCommissionsRepository;
