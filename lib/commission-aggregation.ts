import type { AgentCommissionRecord, CommissionPaymentKind, CommissionStatus, ID } from "./types";

export type CommissionRow = {
  id: ID;
  case_id: ID;
  agent_id: ID;
  case_number: string;
  customer_name: string;
  intended_level: string | null;
  kind: CommissionPaymentKind;
  installment_no: number | null;
  due_date: string;
  amount: number;
  status: CommissionStatus;
  paid_at: string | null;
  bank_reference: string | null;
};

export type CommissionAggregationQuery = {
  search?: string;
  status?: CommissionStatus;
  month?: string;
  sortBy?: "updated" | "next" | "balance" | "newest";
  sortDirection?: "asc" | "desc";
};

function rmToSen(value: unknown) { return Math.round(Number(value ?? 0) * 100); }
function recipientKind(level: string | null): AgentCommissionRecord["recipientKind"] { return level === "level_1" ? "level_1_agent" : level === "level_2" ? "level_2_agent" : level === "level_3" ? "level_3_agent" : "office"; }
function sumRows(rows: CommissionRow[]) { return rows.reduce((sum, row) => sum + rmToSen(row.amount), 0); }
function aggregateStatus(rows: CommissionRow[]): CommissionStatus {
  if (rows.some((row) => row.status === "withheld")) return "withheld";
  if (rows.some((row) => row.status === "scheduled")) return "scheduled";
  if (rows.some((row) => row.status === "approved")) return "approved";
  if (rows.every((row) => row.status === "paid")) return "paid";
  return rows[0]?.status ?? "scheduled";
}
function rowDate(row: CommissionRow) { return row.paid_at ?? row.due_date; }

export function aggregateCommissionRows(input: CommissionRow[]): AgentCommissionRecord[] {
  const groups = new Map<string, CommissionRow[]>();
  for (const row of input) {
    const key = `${row.case_id}:${row.agent_id}:${row.intended_level ?? "office"}`;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }

  return Array.from(groups.values()).map((rows) => {
    const ordered = [...rows].sort((a, b) => a.due_date.localeCompare(b.due_date) || Number(a.installment_no ?? 0) - Number(b.installment_no ?? 0));
    const first = ordered[0]!;
    const initialRows = ordered.filter((row) => row.kind === "initial");
    const deferredRows = ordered.filter((row) => row.kind === "deferred");
    const schedule = deferredRows.map((row) => ({ id: row.id, sequence: Number(row.installment_no ?? 0), dueDate: row.due_date, amountSen: rmToSen(row.amount), status: row.status, paidAt: row.paid_at, paymentReference: row.bank_reference, note: null }));
    const unpaidDeferred = deferredRows.filter((row) => row.status !== "paid");
    const next = ordered.find((row) => row.status !== "paid" && row.status !== "withheld");
    const latest = [...ordered].sort((a, b) => rowDate(b).localeCompare(rowDate(a)))[0]!;
    return {
      id: initialRows[0]?.id ?? first.id,
      caseId: first.case_id,
      caseNumber: first.case_number,
      recipientId: first.agent_id,
      recipientName: "",
      recipientKind: recipientKind(first.intended_level),
      entitlementSen: sumRows(ordered),
      paymentKinds: Array.from(new Set(ordered.map((row) => row.kind))),
      firstPaymentSen: sumRows(initialRows),
      deferredBalanceSen: sumRows(unpaidDeferred),
      paidToDateSen: sumRows(ordered.filter((row) => row.status === "paid")),
      nextPaymentDate: next?.due_date ?? null,
      nextPaymentSen: next ? rmToSen(next.amount) : null,
      status: aggregateStatus(ordered),
      customerDisplayName: first.customer_name,
      eligibilityStatus: (ordered.some((row) => row.status === "withheld") ? "pending" : "eligible") as AgentCommissionRecord["eligibilityStatus"],
      lastUpdatedAt: latest.paid_at ?? latest.due_date,
      schedule,
      withheldReason: ordered.some((row) => row.status === "withheld") ? "Commission withheld pending review" : null,
      adjustmentNote: null,
      qualifyingPaymentDate: null,
    };
  }).sort((a, b) => b.lastUpdatedAt.localeCompare(a.lastUpdatedAt));
}

export function filterAndSortCommissionRecords(items: AgentCommissionRecord[], query: CommissionAggregationQuery) {
  const term = query.search?.trim().toLowerCase() ?? "";
  const filtered = items.filter((item) => {
    const searchMatch = !term || `${item.caseNumber} ${item.customerDisplayName}`.toLowerCase().includes(term);
    const statusMatch = !query.status || item.status === query.status;
    const monthMatch = !query.month || item.nextPaymentDate?.startsWith(query.month) || item.schedule.some((entry) => entry.dueDate.startsWith(query.month!));
    return searchMatch && statusMatch && monthMatch;
  });
  const direction = query.sortDirection === "asc" ? 1 : -1;
  return [...filtered].sort((a, b) => {
    const value = query.sortBy === "balance" ? b.deferredBalanceSen - a.deferredBalanceSen : query.sortBy === "next" ? (a.nextPaymentDate ?? "9999").localeCompare(b.nextPaymentDate ?? "9999") : b.lastUpdatedAt.localeCompare(a.lastUpdatedAt);
    return value * direction;
  });
}
