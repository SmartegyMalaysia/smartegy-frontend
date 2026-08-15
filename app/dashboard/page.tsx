"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Badge, EmptyState, ErrorState, LoadingState, StatCard } from "@/components/ui";
import { DataTable } from "@/components/data-table";
import { Icon } from "@/components/icons";
import { ExportIcon } from "@/components/export-icon";
import { FilterSelect } from "@/components/filter-select";
import { formatDate, formatMoney } from "@/lib/format";
import { dashboardRepository } from "@/lib/mock-repository";
import { roleLabels } from "@/lib/navigation";
import { usePreviewUser } from "@/lib/preview-user";
import { isSupabaseConfigured } from "@/lib/supabase-browser";
import type { CaseStatus, DashboardSnapshot, PaymentStatus, UserRole } from "@/lib/types";

const caseStatuses: Array<CaseStatus | "all"> = ["all", "submitted", "under_review", "pending_payment", "active", "completed"];
const paymentStatuses: Array<PaymentStatus | "all"> = ["all", "not_recorded", "pending_verification", "verified"];
const pageSize = 5;

export default function DashboardPage() {
  const { role, user, setRole } = usePreviewUser();
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  useEffect(() => { setLoading(true); setFailed(false); dashboardRepository.getSnapshot(role).then(setSnapshot).catch(() => setFailed(true)).finally(() => setLoading(false)); }, [role, user.id]);
  return <AppShell user={user} onRoleChange={setRole}><div className="page-content"><div className="page-header"><div><p className="eyebrow">{roleLabels[role]} workspace</p><h1>{role === "agent" ? `Good morning, ${user.displayName.split(" ")[0]}` : "Operations overview"}</h1><p className="page-description">Here&apos;s what needs your attention today.</p></div><div className="page-actions">{role === "agent" && <Link className="button button-primary" href="/cases/new"><Icon name="plus" size={17} /> Submit New Case</Link>}</div></div>{!isSupabaseConfigured() && <div className="preview-banner"><span className="preview-dot" /><div><strong>Development preview</strong><span> Role switching uses mock data only. Production authorization will be enforced server-side.</span></div></div>}{loading ? <LoadingState /> : failed ? <ErrorState onRetry={() => setRole(role)} /> : snapshot && <DashboardContent snapshot={snapshot} role={role} />}</div></AppShell>;
}

function DashboardContent({ snapshot, role }: { snapshot: DashboardSnapshot; role: UserRole }) {
  const isAgent = role === "agent";
  const activeCases = snapshot.cases.filter((item) => item.status !== "completed");
  const sales = snapshot.cases.reduce((sum, item) => sum + (item.saleAmountSen ?? 0), 0);
  const commissions = snapshot.commissions.reduce((sum, item) => sum + item.entitlementSen, 0);
  const successfulCases = snapshot.cases.filter((item) => item.status === "completed" || item.status === "active").length;
  const pendingReviews = snapshot.cases.filter((item) => item.status === "submitted" || item.status === "under_review").length;
  const pendingPayments = snapshot.cases.filter((item) => item.paymentStatus === "pending_verification").length;
  const payable = snapshot.commissions.filter((item) => item.status === "scheduled" || item.status === "approved").reduce((sum, item) => sum + item.entitlementSen, 0);
  const paid = snapshot.commissions.filter((item) => item.status === "paid").reduce((sum, item) => sum + item.paidToDateSen, 0);
  return <>
    {isAgent ? <><>{/* Current qualification is intentionally hidden from the home dashboard. */}</><div className="stat-grid"><StatCard label="Active cases" value={String(activeCases.length)} detail="Current case queue" accent /><StatCard label="Successful cases" value={String(successfulCases)} detail="Completed or active" /><StatCard label="Personal sales" value={formatMoney(sales)} detail="From available case records" /><StatCard label="Commissions earned" value={formatMoney(commissions)} detail="From commission entries" /></div></> : <><section className="focus-panel admin-focus"><div><p className="eyebrow">Operational priority</p><h2>Cases needing attention</h2><p className="focus-copy">{pendingReviews} case{pendingReviews === 1 ? "" : "s"} and {pendingPayments} payment{pendingPayments === 1 ? "" : "s"} are waiting for an update.</p><div className="priority-list"><span><i className="priority-dot warning" />Pending review <strong>{pendingReviews}</strong></span><span><i className="priority-dot danger" />Payment verification <strong>{pendingPayments}</strong></span></div></div><div className="focus-side"><span className="priority-number">{String(pendingReviews + pendingPayments).padStart(2, "0")}</span><span>Open priorities</span><Link href="/cases">Open queue <Icon name="arrow" size={14} /></Link></div></section><div className="stat-grid"><StatCard label="Total cases" value={String(snapshot.cases.length)} detail="Available to your role" accent /><StatCard label="Sales this month" value={formatMoney(sales)} detail="From available case records" /><StatCard label="Commission payable" value={formatMoney(payable)} detail="Scheduled or approved" /><StatCard label="Paid commissions" value={formatMoney(paid)} detail="Paid commission entries" /></div></>}
    <div className="dashboard-grid dashboard-grid-agent"><CaseActivityTable cases={snapshot.cases} isAgent={isAgent} />{/* Team snapshot is intentionally hidden until its replacement is defined. */}</div>
  </>;
}

function CaseActivityTable({ cases, isAgent }: { cases: DashboardSnapshot["cases"]; isAgent: boolean }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<CaseStatus | "all">("all");
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus | "all">("all");
  const [agentFilter, setAgentFilter] = useState("all");
  const [page, setPage] = useState(1);
  const agentOptions = Array.from(new Set(cases.map((item) => item.agentName))).sort();
  const filteredCases = cases.filter((item) => { const query = search.trim().toLowerCase(); const matchesSearch = !query || item.caseNumber.toLowerCase().includes(query) || item.customerDisplayName.toLowerCase().includes(query); return matchesSearch && (status === "all" || item.status === status) && (paymentStatus === "all" || item.paymentStatus === paymentStatus) && (agentFilter === "all" || item.agentName === agentFilter); });
  const totalPages = Math.max(1, Math.ceil(filteredCases.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const visibleCases = filteredCases.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  function resetPage() { setPage(1); }
  function exportCases() { const rows = [["Case", "Customer", ...(isAgent ? [] : ["Agent"]), "Amount", "Status", "Payment", "Updated"], ...filteredCases.map((item) => [item.caseNumber, item.customerDisplayName, ...(isAgent ? [] : [item.agentName]), formatMoney(item.saleAmountSen), item.status, item.paymentStatus, item.updatedAt])]; const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n"); const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); link.download = "smartegy-cases.csv"; link.click(); URL.revokeObjectURL(link.href); }
  return <section className="panel recent-panel case-table-panel"><div className="panel-header case-table-header"><div><h2>{isAgent ? "Case activity" : "Recent cases"}</h2><p>{isAgent ? "All of your cases, with filters to find the next action." : "Latest activity across your workspace"}</p></div>{isAgent && <span className="case-count">{filteredCases.length} of {cases.length} cases</span>}</div><div className="case-filters" aria-label="Case filters"><label><span>Search</span><input type="search" value={search} onChange={(event) => { setSearch(event.target.value); resetPage(); }} placeholder="Case number or customer" /></label><label><span>Status</span><FilterSelect allLabel="All statuses" value={status} options={caseStatuses} onChange={(value) => { setStatus(value); resetPage(); }} /></label><label><span>Payment</span><FilterSelect allLabel="All payment states" value={paymentStatus} options={paymentStatuses} onChange={(value) => { setPaymentStatus(value); resetPage(); }} /></label>{!isAgent && <label><span>Agent</span><FilterSelect allLabel="All agents" value={agentFilter} options={agentOptions} onChange={(value) => { setAgentFilter(value); resetPage(); }} /></label>}<button className="text-button case-filter-reset" type="button" disabled={!search && status === "all" && paymentStatus === "all" && agentFilter === "all"} onClick={() => { setSearch(""); setStatus("all"); setPaymentStatus("all"); setAgentFilter("all"); resetPage(); }}>Clear filters</button></div>{visibleCases.length ? <><div className="desktop-case-table"><DataTable caption="All cases" headers={isAgent ? ["Case", "Customer", "Amount", "Status", "Payment", "Updated"] : ["Case", "Customer", "Agent", "Amount", "Status", "Payment", "Updated"]}>{visibleCases.map((item) => <tr className="case-table-row" key={item.id} tabIndex={0} role="link" aria-label={`Open case ${item.caseNumber}`} onClick={() => router.push(`/cases/${item.id}`)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); router.push(`/cases/${item.id}`); } }}><td><span className="table-primary">{item.caseNumber}</span></td><td>{item.customerDisplayName}{isAgent && <span className="table-secondary">{item.agentName}</span>}</td>{!isAgent && <td>{item.agentName}</td>}<td className="commission-money">{formatMoney(item.saleAmountSen)}</td><td><Badge status={item.status} /></td><td><Badge status={item.paymentStatus} /></td><td className="muted-cell">{formatDate(item.updatedAt)}</td></tr>)}</DataTable></div><MobileCaseList cases={visibleCases} isAgent={isAgent} /></> : <EmptyState title="No matching cases" description="Try changing or clearing the filters." />}<div className="case-table-footer"><span className="case-page-summary">Showing {visibleCases.length ? (currentPage - 1) * pageSize + 1 : 0}&ndash;{Math.min(currentPage * pageSize, filteredCases.length)} of {filteredCases.length}</span><div className="case-table-actions"><button className="button button-secondary button-sm" type="button" onClick={exportCases} disabled={!filteredCases.length}><ExportIcon size={15} /><span>Export</span></button><div className="pagination" aria-label="Case table pagination"><button className="pagination-button" type="button" aria-label="Previous page" disabled={currentPage === 1} onClick={() => setPage((value) => value - 1)}>&lsaquo;</button><span>Page {currentPage} of {totalPages}</span><button className="pagination-button" type="button" aria-label="Next page" disabled={currentPage === totalPages} onClick={() => setPage((value) => value + 1)}>&rsaquo;</button></div></div></div></section>;
}

function MobileCaseList({ cases, isAgent }: { cases: DashboardSnapshot["cases"]; isAgent: boolean }) {
  return <div className="mobile-case-list" aria-label="Cases">{cases.map((item) => <article className="case-card" key={item.id}><div className="case-card-header"><div><Link className="table-primary" href={`/cases/${item.id}`}>{item.caseNumber}</Link><span className="case-card-customer">{item.customerDisplayName}</span></div><Link className="case-card-action" href={`/cases/${item.id}`}>Open case <Icon name="arrow" size={14} /></Link></div>{!isAgent && <p className="case-card-agent">Agent: {item.agentName}</p>}<div className="case-card-statuses"><Badge status={item.status} /><Badge status={item.paymentStatus} /></div><p className="case-card-updated">Updated {formatDate(item.updatedAt)} &middot; {formatMoney(item.saleAmountSen)}</p></article>)}</div>;
}

function TeamSnapshot({ agents }: { agents: DashboardSnapshot["agents"] }) {
  return <section className="panel side-panel"><div className="panel-header"><div><h2>Team snapshot</h2><p>Agent performance</p></div><Link className="text-link" href="/agents">View all <Icon name="arrow" size={14} /></Link></div><div className="team-list">{agents.map((agent) => <div className="team-item" key={agent.id}><span className="avatar avatar-small">{agent.displayName.split(" ").map((name) => name[0]).join("")}</span><div><strong>{agent.displayName}</strong><span>Level {agent.currentLevel} &middot; {agent.successfulCaseCount} successful cases</span></div><span className="team-sales">{formatMoney(agent.personalSalesSen)}</span></div>)}</div></section>;
}






