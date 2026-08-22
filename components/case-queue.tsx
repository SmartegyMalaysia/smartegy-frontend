"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { TextInput } from "@/components/form-controls";
import { DataTable } from "@/components/data-table";
import { ExportIcon } from "@/components/export-icon";
import { FilterSelect } from "@/components/filter-select";
import { Badge, EmptyState, ErrorState, LoadingState } from "@/components/ui";
import { formatDate, formatMoney } from "@/lib/format";
import { casesRepository, type CaseDirectoryPage } from "@/lib/case-repository";
import type { CaseStatus, CurrentUser, PaymentStatus } from "@/lib/types";

export type CaseQueueFilter = "all" | "new" | "under_review" | "changes_requested" | "quotation_payment" | "installation_monitoring" | "trial_review" | "commission_active" | "completed_cancelled";
const caseStatuses: CaseQueueFilter[] = ["all", "new", "under_review", "changes_requested", "quotation_payment", "installation_monitoring", "trial_review", "commission_active", "completed_cancelled"];
const caseStatusLabels: Partial<Record<CaseQueueFilter, string>> = { all: "All case stages", new: "New submissions", under_review: "Under review", changes_requested: "Changes requested", quotation_payment: "Quotation / payment", installation_monitoring: "Installation / monitoring", trial_review: "Trial review", commission_active: "Commission-active", completed_cancelled: "Completed / cancelled" };
const paymentStatuses: Array<PaymentStatus | "all"> = ["all", "not_recorded", "pending_verification", "verified"];
const sortOptions = ["updated", "newest", "amount"] as const;
const pageSize = 5;

export function CaseQueue({ actor, isAgent, showCount = false, title, description }: { actor: CurrentUser; isAgent: boolean; showCount?: boolean; title?: string; description?: string }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [stage, setStage] = useState<CaseQueueFilter>("all");
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus | "all">("all");
  const [agentFilter, setAgentFilter] = useState("all");
  const [sort, setSort] = useState<(typeof sortOptions)[number]>("updated");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<CaseDirectoryPage | null>(null);
  const [state, setState] = useState<"loading" | "error" | "ready">("loading");
  const requestId = useRef(0);
  const hasLoaded = useRef(false);
  const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async () => {
    const currentRequest = ++requestId.current;
    setRefreshing(true);
    const result = await casesRepository.listPage(actor, { search, stage: stage === "all" ? undefined : stage, paymentStatus: paymentStatus === "all" ? undefined : paymentStatus, agentId: agentFilter === "all" ? undefined : agentFilter, page, pageSize, sortBy: sort, sortDirection: sort === "amount" ? "desc" : "desc" });
    if (currentRequest !== requestId.current) return;
    if (result.ok) { hasLoaded.current = true; setData(result.data); setState("ready"); } else if (!hasLoaded.current) setState("error");
    setRefreshing(false);
  }, [actor, agentFilter, page, paymentStatus, search, sort, stage]);
  useEffect(() => { void load(); }, [load]);
  const totalItems = data?.totalItems ?? 0;
  const totalPages = data?.totalPages ?? 1;
  const currentPage = Math.min(page, totalPages);
  const visibleCases = data?.items ?? [];
  const heading = title ?? (isAgent ? "Case activity" : "Recent cases");
  const supportingText = description ?? (isAgent ? "All of your cases, with filters to find the next action." : "Latest activity across your workspace");
  const hasFilters = Boolean(search) || stage !== "all" || paymentStatus !== "all" || agentFilter !== "all" || sort !== "updated";
  const reset = () => { setSearch(""); setStage("all"); setPaymentStatus("all"); setAgentFilter("all"); setSort("updated"); setPage(1); };
  async function exportCases() { await casesRepository.export(actor, { search, stage: stage === "all" ? undefined : stage, paymentStatus: paymentStatus === "all" ? undefined : paymentStatus, agentId: agentFilter === "all" ? undefined : agentFilter, sortBy: sort, sortDirection: "desc" }); }
  function openCase(caseId: string) { router.push(`/cases/${caseId}`); }
  if (state === "loading" && !data) return <section className="panel recent-panel case-table-panel"><LoadingState/></section>;
  if (state === "error" && !data) return <section className="panel recent-panel case-table-panel"><ErrorState onRetry={load}/></section>;
  return <section className="panel recent-panel case-table-panel">
    <div className="panel-header case-table-header"><div><h2>{heading}</h2><p>{supportingText}</p></div>{(isAgent || showCount) && <span className="case-count">{totalItems} cases {refreshing && <span className="table-secondary" role="status" aria-live="polite">Updating…</span>}</span>}</div>
    <div className="case-filters" aria-label="Case filters">
      <label><span>Search</span><TextInput type="search" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Case number or customer" /></label>
      <label><span>Stage</span><FilterSelect allLabel="All case stages" labels={caseStatusLabels} value={stage} options={caseStatuses} onChange={(value) => { setStage(value as CaseQueueFilter); setPage(1); }} /></label>
      <label><span>Payment</span><FilterSelect allLabel="All payment states" value={paymentStatus} options={paymentStatuses} onChange={(value) => { setPaymentStatus(value as PaymentStatus | "all"); setPage(1); }} /></label>
      {!isAgent && <label><span>Agent</span><FilterSelect allLabel="All agents" value={agentFilter} options={["all", ...(data?.agentOptions ?? []).map((item) => item.value)]} labels={Object.fromEntries((data?.agentOptions ?? []).map((item) => [item.value, item.label]))} onChange={(value) => { setAgentFilter(value); setPage(1); }} /></label>}
      <label><span>Sort by</span><FilterSelect allLabel="Recently updated" value={sort} options={[...sortOptions]} labels={{ updated: "Recently updated", newest: "Newest", amount: "Amount" }} onChange={(value) => { setSort(value as (typeof sortOptions)[number]); setPage(1); }} /></label>
      <button className="text-button case-filter-reset" type="button" disabled={!hasFilters} onClick={reset}>Clear filters</button>
    </div>
    {visibleCases.length ? <><div className="desktop-case-table"><DataTable caption="All cases" headers={isAgent ? ["Case", "Customer", "Amount", "Status", "Payment", "Updated"] : ["Case", "Customer", "Agent", "Amount", "Status", "Payment", "Updated"]}>{visibleCases.map((item) => <tr className="case-table-row" key={item.id} tabIndex={0} role="link" aria-label={`Open case ${item.caseNumber}`} onClick={() => openCase(item.id)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openCase(item.id); } }}><td><Link className="table-primary" href={`/cases/${item.id}`}>{item.caseNumber}</Link></td><td>{item.customerDisplayName}{isAgent && <span className="table-secondary">{item.agentName}</span>}</td>{!isAgent && <td>{item.agentName}</td>}<td className="commission-money">{formatMoney(item.saleAmountSen)}</td><td><Badge status={item.status} /></td><td><Badge status={item.paymentStatus} /></td><td className="muted-cell">{formatDate(item.updatedAt)}</td></tr>)}</DataTable></div><MobileCaseList cases={visibleCases} isAgent={isAgent} /></> : <EmptyState title="No matching cases" description="Try changing or clearing the filters." />}
    <div className="case-table-footer"><span className="case-page-summary">Showing {visibleCases.length ? (currentPage - 1) * pageSize + 1 : 0}&ndash;{Math.min(currentPage * pageSize, totalItems)} of {totalItems}</span><div className="case-table-actions"><button className="button button-secondary button-sm" type="button" onClick={() => void exportCases()} disabled={!totalItems}><ExportIcon size={15} /><span>Export</span></button><div className="pagination" aria-label="Case table pagination"><button className="pagination-button" type="button" aria-label="Previous page" disabled={currentPage === 1} onClick={() => setPage((value) => value - 1)}>&lsaquo;</button><span>Page {currentPage} of {totalPages}</span><button className="pagination-button" type="button" aria-label="Next page" disabled={currentPage === totalPages} onClick={() => setPage((value) => value + 1)}>&rsaquo;</button></div></div></div>
  </section>;
}

function MobileCaseList({ cases, isAgent }: { cases: CaseDirectoryPage["items"]; isAgent: boolean }) { return <div className="mobile-case-list" aria-label="Cases">{cases.map((item) => <article className="case-card" key={item.id}><div className="case-card-header"><div><Link className="table-primary" href={`/cases/${item.id}`}>{item.caseNumber}</Link><span className="case-card-customer">{item.customerDisplayName}</span></div><Link className="case-card-action" href={`/cases/${item.id}`}>Open case</Link></div>{!isAgent && <p className="case-card-agent">Agent: {item.agentName}</p>}<div className="case-card-statuses"><Badge status={item.status} /><Badge status={item.paymentStatus} /></div><p className="case-card-updated">Updated {formatDate(item.updatedAt)} · {formatMoney(item.saleAmountSen)}</p></article>)}</div>; }
