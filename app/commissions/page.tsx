"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Badge, EmptyState, ErrorState, LoadingState } from "@/components/ui";
import { Icon } from "@/components/icons";
import { FilterSelect } from "@/components/filter-select";
import { DatePicker } from "@/components/date-picker";
import { DataTable } from "@/components/data-table";
import { formatDate, formatMoney } from "@/lib/format";
import { commissionStatuses, mockAgentCommissionsRepository } from "@/lib/commission-repository";
import { usePreviewUser } from "@/lib/preview-user";
import type { AgentCommissionRecord, CommissionOverview, CommissionStatus } from "@/lib/types";

const pageSize = 5;
type SortKey = "updated" | "next" | "balance" | "newest";

export default function CommissionsPage() {
  const { user, setRole } = usePreviewUser();
  const [records, setRecords] = useState<AgentCommissionRecord[]>([]);
  const [overview, setOverview] = useState<CommissionOverview | null>(null);
  const [state, setState] = useState<"loading" | "error" | "permission">("loading");
  useEffect(() => { Promise.all([mockAgentCommissionsRepository.list(user), mockAgentCommissionsRepository.getOverview(user)]).then(([listResult, overviewResult]) => { if (!listResult.ok) { setState(listResult.error.code === "FORBIDDEN" ? "permission" : "error"); return; } if (!overviewResult.ok) { setState(overviewResult.error.code === "FORBIDDEN" ? "permission" : "error"); return; } setRecords(listResult.data); setOverview(overviewResult.data); setState("loading"); }); }, [user]);
  return <AppShell user={user} onRoleChange={setRole}><main className="page-content commissions-page"><div className="page-header"><div><p className="eyebrow">Agent workspace</p><h1>My Commissions</h1><p className="page-description">A transparent view of your earned, paid, and scheduled commissions.</p></div></div>{state === "loading" && !overview ? <LoadingState /> : state === "permission" ? <ErrorState /> : state === "error" || !overview ? <ErrorState /> : <><CommissionOverviewCards overview={overview} /><CommissionRecords records={records} /></>}</main></AppShell>;
}

function CommissionOverviewCards({ overview }: { overview: CommissionOverview }) {
  return <div className="commission-overview-grid"><SummaryCard label="Total commission entitlement" value={formatMoney(overview.totalEntitlementSen)} detail="Authoritative total returned for your records"/><SummaryCard label="Paid to date" value={formatMoney(overview.paidToDateSen)} detail="Recorded payments only"/><SummaryCard label="Upcoming payout" value={formatMoney(overview.upcomingPayoutSen)} detail={overview.upcomingPayoutDate ? `Next scheduled date: ${formatDate(overview.upcomingPayoutDate)}` : "No scheduled payout yet"} accent/><SummaryCard label="Remaining balance" value={formatMoney(overview.remainingBalanceSen)} detail="Outstanding deferred balance"/></div>;
}

function SummaryCard({ label, value, detail, accent = false }: { label: string; value: string; detail: string; accent?: boolean }) { return <section className={`commission-summary-card ${accent ? "commission-summary-accent" : ""}`}><p className="eyebrow">{label}</p><strong>{value}</strong><span>{detail}</span></section>; }

function CommissionRecords({ records }: { records: AgentCommissionRecord[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<CommissionStatus | "all">("all");
  const [month, setMonth] = useState("");
  const [sort, setSort] = useState<SortKey>("updated");
  const [page, setPage] = useState(1);
  const filtered = useMemo(() => { const query = search.trim().toLowerCase(); return records.filter((record) => { const matchesSearch = !query || record.caseNumber.toLowerCase().includes(query) || record.customerDisplayName.toLowerCase().includes(query); const matchesStatus = status === "all" || record.status === status; const matchesMonth = !month || record.nextPaymentDate?.startsWith(month); return matchesSearch && matchesStatus && matchesMonth; }).toSorted((a, b) => sort === "balance" ? b.deferredBalanceSen - a.deferredBalanceSen : sort === "next" ? (a.nextPaymentDate ?? "9999").localeCompare(b.nextPaymentDate ?? "9999") : sort === "newest" ? b.qualifyingPaymentDate?.localeCompare(a.qualifyingPaymentDate ?? "") ?? 0 : b.lastUpdatedAt.localeCompare(a.lastUpdatedAt)); }, [month, records, search, sort, status]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const visible = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  function resetPage() { setPage(1); }
  const clearDisabled = !search && status === "all" && !month && sort === "updated";
  const statusOptions = commissionStatuses;
  const sortOptions: SortKey[] = ["updated", "next", "balance", "newest"];
  const sortLabels: Record<SortKey, string> = { updated: "Latest updated", next: "Next payout date", balance: "Highest balance", newest: "Newest eligible case" };
  return <section className="panel commission-records-panel"><div className="panel-header commission-records-header"><div><h2>Commission records</h2><p>{records.length ? "Eligible case commissions returned from the trusted commission service." : "Your commissions will appear after an eligible case payment is verified."}</p></div><span className="case-count">{filtered.length} records</span></div><div className="commission-filters" aria-label="Commission filters"><label><span>Search</span><input type="search" value={search} onChange={(event) => { setSearch(event.target.value); resetPage(); }} placeholder="Case number or customer" /></label><label><span>Status</span><FilterSelect allLabel="All statuses" value={status} options={statusOptions} onChange={(value) => { setStatus(value); resetPage(); }} /></label><div className="commission-filter-field"><span className="commission-filter-label-emphasis">Payment month</span><DatePicker id="payment-month" mode="month" value={month} placeholder="MM/YYYY" onChange={(value) => { setMonth(value); resetPage(); }} /></div><label><span>Sort by</span><FilterSelect allLabel="Latest updated" value={sort} options={sortOptions} labels={sortLabels} onChange={(value) => { setSort(value); resetPage(); }} /></label><button className="text-button commission-filter-reset" type="button" disabled={clearDisabled} onClick={() => { setSearch(""); setStatus("all"); setMonth(""); setSort("updated"); resetPage(); }}>Clear filters</button></div>{visible.length ? <><div className="desktop-commission-table"><DataTable caption="My commission records" headers={["Case", "Customer", "My entitlement", "Paid", "Remaining", "Status", "Next payout", "Updated"]}>{visible.map((record) => <tr className="commission-table-row" key={record.id} tabIndex={0} role="link" aria-label={`Open commission for ${record.caseNumber}`} onClick={() => router.push(`/commissions/${record.id}`)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); router.push(`/commissions/${record.id}`); } }}><td><span className="table-primary">{record.caseNumber}</span><span className="table-secondary">{record.commissionNumber}</span></td><td>{record.customerDisplayName}</td><td className="commission-money">{formatMoney(record.entitlementSen)}</td><td className="commission-money">{formatMoney(record.paidToDateSen)}</td><td className="commission-money">{formatMoney(record.deferredBalanceSen)}</td><td><Badge status={record.status}/></td><td>{record.nextPaymentDate ? <><span className="table-primary">{formatMoney(record.nextPaymentSen)}</span><span className="table-secondary">{formatDate(record.nextPaymentDate)}</span></> : <span className="muted-cell">Not scheduled</span>}</td><td className="muted-cell">{formatDate(record.lastUpdatedAt)}</td></tr>)}</DataTable></div><div className="mobile-commission-list">{visible.map((record) => <Link className="commission-card" href={`/commissions/${record.id}`} key={record.id}><div className="commission-card-top"><div><span className="table-primary">{record.caseNumber}</span><strong>{record.customerDisplayName}</strong></div><Badge status={record.status}/></div><div className="commission-card-grid"><span><small>My entitlement</small><b>{formatMoney(record.entitlementSen)}</b></span><span><small>Paid</small><b>{formatMoney(record.paidToDateSen)}</b></span><span><small>Remaining</small><b>{formatMoney(record.deferredBalanceSen)}</b></span><span><small>Next payout</small><b>{record.nextPaymentDate ? formatDate(record.nextPaymentDate) : "Not scheduled"}</b></span></div><span className="commission-card-action">View schedule <Icon name="arrow" size={14}/></span></Link>)}</div></> : <EmptyState title="No eligible commissions yet" description="Commissions will appear after a case meets the approved eligibility requirements."/>}<div className="case-table-footer"><span className="case-page-summary">Showing {visible.length ? (currentPage - 1) * pageSize + 1 : 0}&ndash;{Math.min(currentPage * pageSize, filtered.length)} of {filtered.length}</span><div className="pagination" aria-label="Commission pagination"><button className="pagination-button" type="button" aria-label="Previous page" disabled={currentPage === 1} onClick={() => setPage((value) => value - 1)}>&lsaquo;</button><span>Page {currentPage} of {totalPages}</span><button className="pagination-button" type="button" aria-label="Next page" disabled={currentPage === totalPages} onClick={() => setPage((value) => value + 1)}>&rsaquo;</button></div></div></section>;
}
