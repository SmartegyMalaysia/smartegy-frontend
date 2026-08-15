"use client";

import { TextInput, TextArea } from "@/components/form-controls";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Badge, Button, EmptyState, ErrorState, LoadingState, PermissionDenied, StatCard } from "@/components/ui";
import { DataTable } from "@/components/data-table";
import { DatePicker } from "@/components/date-picker";
import { ExportIcon } from "@/components/export-icon";
import { FilterSelect } from "@/components/filter-select";
import { TableFooter } from "@/components/table-footer";
import { downloadCsv } from "@/lib/export-csv";
import { formatDate, formatMoney } from "@/lib/format";
import { payoutRepository } from "@/lib/payout-repository";
import { usePreviewUser } from "@/lib/preview-user";
import type { AgentMonthlyPayout, PayoutMonthSummary, PayoutSettlementStatus, PayoutTransaction } from "@/lib/types";

type MonthData = { summary: PayoutMonthSummary; agentPayouts: AgentMonthlyPayout[]; transactions: PayoutTransaction[] };
const pageSize = 5;
const payoutStatuses: Array<AgentMonthlyPayout["settlementStatus"] | "all"> = ["all", "pending", "partially_settled", "settled"];
const transactionStatuses: Array<PayoutSettlementStatus | "all"> = ["all", "pending", "settled"];

export default function PayoutsPage() {
  const { user, setRole } = usePreviewUser("staff");
  const [month, setMonth] = useState("2026-09");
  const [data, setData] = useState<MonthData | null>(null);
  const [state, setState] = useState<"loading" | "error" | "permission" | "ready">("loading");
  const [selected, setSelected] = useState<PayoutTransaction | null>(null);
  const [reference, setReference] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);

  const load = useCallback(async () => {
    setState("loading");
    const result = await payoutRepository.getMonth(user, month);
    if (result.ok) { setData(result.data); setState("ready"); }
    else setState(result.error.code === "FORBIDDEN" ? "permission" : "error");
  }, [month, user]);

  useEffect(() => { void load(); }, [load]);

  async function settle() {
    if (!selected) return;
    const result = await payoutRepository.settleTransaction(user, { transactionId: selected.id, bankReference: reference });
    if (result.ok) { setFeedback(`${selected.commissionNumber} was marked settled.`); setSelected(null); setReference(""); void load(); }
    else setFeedback(result.error.message);
  }

  return <AppShell user={user} onRoleChange={setRole}><main className="page-content payouts-page">
    <div className="page-header"><div><p className="eyebrow">Staff finance operations</p><h1>Commission Payouts</h1><p className="page-description">Prepare monthly agent payouts, export bank totals, and manually reconcile settled transactions.</p></div></div>
    {state === "loading" ? <LoadingState/> : state === "permission" ? <PermissionDenied/> : state === "error" || !data ? <ErrorState onRetry={load}/> : <>
      <div className="payout-month-control"><div className="payout-month-field"><span>Payout month</span><DatePicker id="payout-month" mode="month" value={month} surface="white" onChange={setMonth}/></div><Button variant="secondary" size="sm" onClick={() => exportPayouts(data.agentPayouts, month)} disabled={!data.agentPayouts.length}><ExportIcon size={15}/>Export bank totals</Button></div>
      {feedback && <div className="action-feedback" role="status">{feedback}<button type="button" onClick={() => setFeedback(null)} aria-label="Dismiss message">×</button></div>}
      <PayoutSummary summary={data.summary}/>
      <AgentPayoutTable payouts={data.agentPayouts} month={month}/>
      <TransactionTable transactions={data.transactions} month={month} onSettle={setSelected}/>
    </>}
    {selected && <SettlementDialog transaction={selected} reference={reference} setReference={setReference} onCancel={() => { setSelected(null); setReference(""); }} onConfirm={settle}/>} 
  </main></AppShell>;
}

function AgentPayoutTable({ payouts, month }: { payouts: AgentMonthlyPayout[]; month: string }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<AgentMonthlyPayout["settlementStatus"] | "all">("all");
  const [page, setPage] = useState(1);
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return payouts.filter((payout) => (!query || [payout.agentName, payout.agentCode, payout.bankAccount.bankName, payout.bankAccount.accountHolderName].some((value) => value.toLowerCase().includes(query))) && (status === "all" || payout.settlementStatus === status));
  }, [payouts, search, status]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const visible = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const reset = () => { setSearch(""); setStatus("all"); setPage(1); };
  return <section className="panel payout-panel">
    <div className="panel-header"><div><h2>Agent monthly payouts</h2><p>One total per agent for the selected month. Bank details are restricted to authorised staff.</p></div><span className="case-count">{filtered.length} agents</span></div>
    <div className="case-filters payout-table-filters" aria-label="Agent monthly payout filters"><label><span>Search</span><TextInput type="search" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Agent, ID, or bank"/></label><label><span>Payout status</span><FilterSelect allLabel="All payout statuses" value={status} options={payoutStatuses} labels={{ all: "All statuses", partially_settled: "Partially settled" }} onChange={(value) => { setStatus(value); setPage(1); }}/></label><button className="text-button case-filter-reset" type="button" disabled={!search && status === "all"} onClick={reset}>Clear filters</button></div>
    {visible.length ? <DataTable caption="Agent monthly payouts" headers={["Agent", "Bank destination", "Monthly total", "Settled", "Pending", "Transactions", "Payout status"]}>{visible.map((payout) => <AgentPayoutRow key={payout.agentId} payout={payout}/>)}</DataTable> : <EmptyState title="No matching payouts" description="Try changing or clearing the filters."/>}
    <TableFooter currentPage={currentPage} totalPages={totalPages} visibleCount={visible.length} totalCount={filtered.length} onPageChange={setPage} onExport={() => exportPayouts(filtered, month)} exportLabel="Export payouts"/>
  </section>;
}

function TransactionTable({ transactions, month, onSettle }: { transactions: PayoutTransaction[]; month: string; onSettle: (transaction: PayoutTransaction) => void }) {
  const [search, setSearch] = useState("");
  const [agent, setAgent] = useState("all");
  const [status, setStatus] = useState<PayoutSettlementStatus | "all">("all");
  const [page, setPage] = useState(1);
  const agentOptions = useMemo(() => Array.from(new Set(transactions.map((transaction) => transaction.agentName))).toSorted(), [transactions]);
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return transactions.filter((transaction) => (!query || [transaction.agentName, transaction.agentCode, transaction.commissionNumber, transaction.caseNumber, transaction.customerDisplayName].some((value) => value.toLowerCase().includes(query))) && (agent === "all" || transaction.agentName === agent) && (status === "all" || transaction.settlementStatus === status));
  }, [transactions, search, agent, status]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const visible = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const reset = () => { setSearch(""); setAgent("all"); setStatus("all"); setPage(1); };
  return <section className="panel payout-panel">
    <div className="panel-header"><div><h2>Transaction reconciliation</h2><p>After bank processing, mark each commission payout transaction as settled.</p></div><span className="case-count">{filtered.length} transactions</span></div>
    <div className="case-filters payout-table-filters" aria-label="Transaction reconciliation filters"><label><span>Search</span><TextInput type="search" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Agent, commission, case, or customer"/></label><label><span>Agent</span><FilterSelect allLabel="All agents" value={agent} options={["all", ...agentOptions]} onChange={(value) => { setAgent(value); setPage(1); }}/></label><label><span>Settlement</span><FilterSelect allLabel="All settlement states" value={status} options={transactionStatuses} onChange={(value) => { setStatus(value); setPage(1); }}/></label><button className="text-button case-filter-reset" type="button" disabled={!search && agent === "all" && status === "all"} onClick={reset}>Clear filters</button></div>
    {visible.length ? <DataTable caption="Payout transaction reconciliation" headers={["Agent", "Commission", "Case", "Amount", "Settlement", "Bank reference", "Action"]}>{visible.map((transaction) => <tr key={transaction.id}><td><span className="table-primary">{transaction.agentName}</span><span className="table-secondary">{transaction.agentCode}</span></td><td>{transaction.commissionNumber}</td><td>{transaction.caseNumber}<span className="table-secondary">{transaction.customerDisplayName}</span></td><td className="commission-money">{formatMoney(transaction.amountSen)}</td><td><Badge status={transaction.settlementStatus}/>{transaction.settledAt && <span className="table-secondary">{formatDate(transaction.settledAt)}</span>}</td><td>{transaction.bankReference ?? <span className="muted-cell">Not recorded</span>}</td><td>{transaction.settlementStatus === "pending" ? <Button size="sm" className="agent-promote-button" onClick={() => onSettle(transaction)}>Mark settled</Button> : <span className="muted-cell">Settled</span>}</td></tr>)}</DataTable> : <EmptyState title="No matching transactions" description="Try changing or clearing the filters."/>}
    <TableFooter currentPage={currentPage} totalPages={totalPages} visibleCount={visible.length} totalCount={filtered.length} onPageChange={setPage} onExport={() => exportTransactions(filtered, month)} exportLabel="Export transactions"/>
  </section>;
}

function exportPayouts(payouts: AgentMonthlyPayout[], month: string) { downloadCsv(`smartegy-payouts-${month}.csv`, [["Agent", "Agent ID", "Bank", "Account holder", "Account number", "Payout month", "Monthly payout total", "Pending total", "Settlement status"], ...payouts.map((payout) => [payout.agentName, payout.agentCode, payout.bankAccount.bankName, payout.bankAccount.accountHolderName, payout.bankAccount.accountNumberMasked, payout.payoutMonth, formatMoney(payout.totalSen), formatMoney(payout.pendingSen), payout.settlementStatus])]); }
function exportTransactions(transactions: PayoutTransaction[], month: string) { downloadCsv(`smartegy-payout-transactions-${month}.csv`, [["Agent", "Agent ID", "Commission", "Case", "Customer", "Amount", "Settlement status", "Bank reference", "Settled at"], ...transactions.map((transaction) => [transaction.agentName, transaction.agentCode, transaction.commissionNumber, transaction.caseNumber, transaction.customerDisplayName, formatMoney(transaction.amountSen), transaction.settlementStatus, transaction.bankReference ?? "", transaction.settledAt ?? ""])]); }
function PayoutSummary({ summary }: { summary: PayoutMonthSummary }) { return <div className="stat-grid payout-summary"><StatCard label="Monthly payout total" value={formatMoney(summary.totalSen)} detail={`${summary.agentCount} agents`}/><StatCard label="Pending settlement" value={formatMoney(summary.pendingSen)} detail={`${summary.transactionCount - summary.settledTransactionCount} transactions remaining`} accent/><StatCard label="Settled" value={formatMoney(summary.settledSen)} detail={`${summary.settledAgentCount} fully settled agents`}/><StatCard label="Transactions" value={String(summary.transactionCount)} detail={`${summary.settledTransactionCount} settled`}/></div>; }
function AgentPayoutRow({ payout }: { payout: AgentMonthlyPayout }) { const label = payout.settlementStatus === "partially_settled" ? "Partially settled" : payout.settlementStatus; return <tr><td><span className="table-primary">{payout.agentName}</span><span className="table-secondary">{payout.agentCode}</span></td><td>{payout.bankAccount.bankName}<span className="table-secondary">{payout.bankAccount.accountHolderName} · {payout.bankAccount.accountNumberMasked}</span></td><td className="commission-money">{formatMoney(payout.totalSen)}</td><td className="commission-money">{formatMoney(payout.settledSen)}</td><td className="commission-money">{formatMoney(payout.pendingSen)}</td><td>{payout.settledTransactionCount}/{payout.transactionCount}</td><td>{label === "Partially settled" ? <span className="badge badge-warning"><span className="badge-dot"/>Partially settled</span> : <Badge status={payout.settlementStatus}/>}</td></tr>; }
function SettlementDialog({ transaction, reference, setReference, onCancel, onConfirm }: { transaction: PayoutTransaction; reference: string; setReference: (value: string) => void; onCancel: () => void; onConfirm: () => void }) { return <div className="dialog-backdrop" role="presentation"><div className="dialog" role="dialog" aria-modal="true" aria-labelledby="settlement-dialog-title"><h2 id="settlement-dialog-title">Mark payout settled?</h2><p>This records {formatMoney(transaction.amountSen)} for {transaction.agentName} ({transaction.commissionNumber}) as settled. It does not initiate a bank transfer.</p><label className="settlement-field" htmlFor="bank-reference">Bank settlement reference<TextInput id="bank-reference" value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Bank transaction reference" autoFocus/></label><div className="dialog-actions"><Button variant="secondary" onClick={onCancel}>Cancel</Button><Button className="agent-promote-button" disabled={!reference.trim()} onClick={onConfirm}>Mark settled</Button></div></div></div>; }
