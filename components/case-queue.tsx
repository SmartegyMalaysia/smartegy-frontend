"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { TextInput } from "@/components/form-controls";
import { DataTable } from "@/components/data-table";
import { ExportIcon } from "@/components/export-icon";
import { FilterSelect } from "@/components/filter-select";
import { Badge, EmptyState } from "@/components/ui";
import { Icon } from "@/components/icons";
import { formatDate, formatMoney } from "@/lib/format";
import type { CaseStatus, DashboardSnapshot, PaymentStatus } from "@/lib/types";

const caseStatuses: Array<CaseStatus | "all"> = ["all", "submitted", "under_review", "pending_payment", "active", "completed"];
const paymentStatuses: Array<PaymentStatus | "all"> = ["all", "not_recorded", "pending_verification", "verified"];
const pageSize = 5;

export function CaseQueue({ cases, isAgent, showCount = false, title, description }: { cases: DashboardSnapshot["cases"]; isAgent: boolean; showCount?: boolean; title?: string; description?: string }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<CaseStatus | "all">("all");
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus | "all">("all");
  const [agentFilter, setAgentFilter] = useState("all");
  const [page, setPage] = useState(1);
  const agentOptions = Array.from(new Set(cases.map((item) => item.agentName))).sort();
  const filteredCases = cases.filter((item) => {
    const query = search.trim().toLowerCase();
    const matchesSearch = !query || item.caseNumber.toLowerCase().includes(query) || item.customerDisplayName.toLowerCase().includes(query);
    return matchesSearch && (status === "all" || item.status === status) && (paymentStatus === "all" || item.paymentStatus === paymentStatus) && (agentFilter === "all" || item.agentName === agentFilter);
  });
  const totalPages = Math.max(1, Math.ceil(filteredCases.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const visibleCases = filteredCases.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const heading = title ?? (isAgent ? "Case activity" : "Recent cases");
  const supportingText = description ?? (isAgent ? "All of your cases, with filters to find the next action." : "Latest activity across your workspace");

  function resetPage() { setPage(1); }
  function openCase(caseId: string) { router.push(`/cases/${caseId}`); }
  function exportCases() {
    const rows = [["Case", "Customer", ...(isAgent ? [] : ["Agent"]), "Amount", "Status", "Payment", "Updated"], ...filteredCases.map((item) => [item.caseNumber, item.customerDisplayName, ...(isAgent ? [] : [item.agentName]), formatMoney(item.saleAmountSen), item.status, item.paymentStatus, item.updatedAt])];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    link.download = "smartegy-cases.csv";
    link.click();
    URL.revokeObjectURL(link.href);
  }

  return <section className="panel recent-panel case-table-panel">
    <div className="panel-header case-table-header"><div><h2>{heading}</h2><p>{supportingText}</p></div>{(isAgent || showCount) && <span className="case-count">{filteredCases.length} of {cases.length} cases</span>}</div>
    <div className="case-filters" aria-label="Case filters">
      <label><span>Search</span><TextInput type="search" value={search} onChange={(event) => { setSearch(event.target.value); resetPage(); }} placeholder="Case number or customer" /></label>
      <label><span>Status</span><FilterSelect allLabel="All statuses" value={status} options={caseStatuses} onChange={(value) => { setStatus(value); resetPage(); }} /></label>
      <label><span>Payment</span><FilterSelect allLabel="All payment states" value={paymentStatus} options={paymentStatuses} onChange={(value) => { setPaymentStatus(value); resetPage(); }} /></label>
      {!isAgent && <label><span>Agent</span><FilterSelect allLabel="All agents" value={agentFilter} options={agentOptions} onChange={(value) => { setAgentFilter(value); resetPage(); }} /></label>}
      <button className="text-button case-filter-reset" type="button" disabled={!search && status === "all" && paymentStatus === "all" && agentFilter === "all"} onClick={() => { setSearch(""); setStatus("all"); setPaymentStatus("all"); setAgentFilter("all"); resetPage(); }}>Clear filters</button>
    </div>
    {visibleCases.length ? <><div className="desktop-case-table"><DataTable caption="All cases" headers={isAgent ? ["Case", "Customer", "Amount", "Status", "Payment", "Updated"] : ["Case", "Customer", "Agent", "Amount", "Status", "Payment", "Updated"]}>{visibleCases.map((item) => <tr className="case-table-row" key={item.id} tabIndex={0} role="link" aria-label={`Open case ${item.caseNumber}`} onClick={() => openCase(item.id)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openCase(item.id); } }}><td><Link className="table-primary" href={`/cases/${item.id}`}>{item.caseNumber}</Link></td><td>{item.customerDisplayName}{isAgent && <span className="table-secondary">{item.agentName}</span>}</td>{!isAgent && <td>{item.agentName}</td>}<td className="commission-money">{formatMoney(item.saleAmountSen)}</td><td><Badge status={item.status} /></td><td><Badge status={item.paymentStatus} /></td><td className="muted-cell">{formatDate(item.updatedAt)}</td></tr>)}</DataTable></div><MobileCaseList cases={visibleCases} isAgent={isAgent} /></> : <EmptyState title="No matching cases" description="Try changing or clearing the filters." />}
    <div className="case-table-footer"><span className="case-page-summary">Showing {visibleCases.length ? (currentPage - 1) * pageSize + 1 : 0}&ndash;{Math.min(currentPage * pageSize, filteredCases.length)} of {filteredCases.length}</span><div className="case-table-actions"><button className="button button-secondary button-sm" type="button" onClick={exportCases} disabled={!filteredCases.length}><ExportIcon size={15} /><span>Export</span></button><div className="pagination" aria-label="Case table pagination"><button className="pagination-button" type="button" aria-label="Previous page" disabled={currentPage === 1} onClick={() => setPage((value) => value - 1)}>&lsaquo;</button><span>Page {currentPage} of {totalPages}</span><button className="pagination-button" type="button" aria-label="Next page" disabled={currentPage === totalPages} onClick={() => setPage((value) => value + 1)}>&rsaquo;</button></div></div></div>
  </section>;
}

function MobileCaseList({ cases, isAgent }: { cases: DashboardSnapshot["cases"]; isAgent: boolean }) {
  return <div className="mobile-case-list" aria-label="Cases">{cases.map((item) => <article className="case-card" key={item.id}><div className="case-card-header"><div><Link className="table-primary" href={`/cases/${item.id}`}>{item.caseNumber}</Link><span className="case-card-customer">{item.customerDisplayName}</span></div><Link className="case-card-action" href={`/cases/${item.id}`}>Open case <Icon name="arrow" size={14} /></Link></div>{!isAgent && <p className="case-card-agent">Agent: {item.agentName}</p>}<div className="case-card-statuses"><Badge status={item.status} /><Badge status={item.paymentStatus} /></div><p className="case-card-updated">Updated {formatDate(item.updatedAt)} &middot; {formatMoney(item.saleAmountSen)}</p></article>)}</div>;
}
