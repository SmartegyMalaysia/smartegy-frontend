"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Badge, EmptyState, ErrorState, LoadingState, PermissionDenied } from "@/components/ui";
import { DataTable } from "@/components/data-table";
import { FilterSelect } from "@/components/filter-select";
import { TextInput } from "@/components/form-controls";
import { formatMoney } from "@/lib/format";
import { agentRepository, type AgentDirectoryPage, type AgentQualificationFilter } from "@/lib/agent-repository";
import { usePreviewUser } from "@/lib/preview-user";
import type { AgentLevel, AgentSummary } from "@/lib/types";

const pageSize = 5;
const allValue = "all";

export default function AgentsPage() {
  const { user, setRole, ready } = usePreviewUser("staff");
  const [data, setData] = useState<AgentDirectoryPage | null>(null);
  const [state, setState] = useState<"loading" | "error" | "permission" | "ready">("loading");
  const [hasLoaded, setHasLoaded] = useState(false);
  const [search, setSearch] = useState("");
  const [level, setLevel] = useState<AgentLevel | typeof allValue>(allValue);
  const [upline, setUpline] = useState(allValue);
  const [status, setStatus] = useState<"active" | "inactive" | typeof allValue>(allValue);
  const [qualification, setQualification] = useState<AgentQualificationFilter>(allValue);
  const [page, setPage] = useState(1);
  const requestId = useRef(0);
  const hasLoaded = useRef(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!ready) return;
    const currentRequest = ++requestId.current;
    setRefreshing(true);
    const result = await agentRepository.listPage(user, {
      search,
      level: level === allValue ? undefined : level,
      uplineAgentId: upline === allValue ? undefined : upline,
      status: status === allValue ? undefined : status,
      qualification,
      page,
      pageSize,
    });
    if (currentRequest !== requestId.current) return;
    if (result.ok) {
      hasLoaded.current = true;
      setData(result.data);
      setState("ready");
    } else {
      
      if (!hasLoaded.current) setState(result.error.code === "FORBIDDEN" ? "permission" : "error");
      // setState(result.error.code === "FORBIDDEN" ? "permission" : "error"); setHasLoaded(true);
    }
    setRefreshing(false);
  }, [level, page, qualification, ready, search, status, upline, user]);

  useEffect(() => {
    void load();
  }, [load]);

  const filterOptions = data?.filterOptions;
  const totalItems = data?.totalItems ?? 0;
  const totalPages = data?.totalPages ?? 1;
  const currentPage = Math.min(page, totalPages);
  const hasFilters = Boolean(search) || level !== allValue || upline !== allValue || status !== allValue || qualification !== allValue;
  const clearFilters = () => { setSearch(""); setLevel(allValue); setUpline(allValue); setStatus(allValue); setQualification(allValue); setPage(1); };


  return <AppShell user={user} onRoleChange={setRole}><main className="page-content agents-page"><div className="page-header"><div><p className="eyebrow">Staff operations</p><h1>Agents</h1><p className="page-description">Review agent performance, qualification progress, and level-change eligibility.</p></div></div>{state === "loading" && !data ? <LoadingState/> : state === "permission" && !data ? <PermissionDenied/> : state === "error" && !data ? <ErrorState onRetry={load}/> : !data || !filterOptions ? <LoadingState/> : <section className="panel recent-panel case-table-panel"><div className="panel-header case-table-header"><div><h2>All agents</h2><p>Open an agent to review details or apply a manual promotion override.</p></div><span className="case-count">{totalItems} agents {refreshing && <span className="table-secondary" role="status" aria-live="polite">Updating…</span>}</span></div><div className="case-filters agent-filters" aria-label="Agent filters"><label><span>Search</span><TextInput type="search" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Agent name, ID, or upline" /></label><label><span>Level</span><FilterSelect allLabel="All levels" value={String(level)} options={[allValue, ...filterOptions.levels.map(String)]} labels={{ all: "All levels", 1: "Level 1", 2: "Level 2", 3: "Level 3" }} onChange={(value) => { setLevel(value === allValue ? allValue : Number(value) as AgentLevel); setPage(1); }}/></label><label><span>Upline</span><FilterSelect allLabel="All uplines" value={upline} options={[allValue, ...filterOptions.uplines.map((item) => item.value)]} labels={Object.fromEntries(filterOptions.uplines.map((item) => [item.value, item.label]))} onChange={(value) => { setUpline(value); setPage(1); }}/></label><label><span>Status</span><FilterSelect allLabel="All statuses" value={status} options={[allValue, ...filterOptions.statuses]} onChange={(value) => { setStatus(value as typeof status); setPage(1); }}/></label><label><span>Qualification</span><FilterSelect allLabel="All qualification states" value={qualification} options={[allValue, ...filterOptions.qualifications]} labels={{ all: "All states", eligible: "Ready to promote", in_progress: "In progress" }} onChange={(value) => { setQualification(value as AgentQualificationFilter); setPage(1); }}/></label><button className="text-button case-filter-reset" type="button" disabled={!hasFilters} onClick={clearFilters}>Clear filters</button></div>{data.items.length ? <><div className="desktop-case-table agent-table"><DataTable caption="All Smartegy agents" headers={["Agent", "Level", "Upline", "Successful Cases", "Direct Agents", "Personal Sales", "Referral Sales", "Commission Earned", "Eligibility"]}>{data.items.map((agent) => <AgentRow key={agent.id} agent={agent}/>)}</DataTable></div><div className="case-table-footer"><span className="case-page-summary">Showing {((currentPage - 1) * pageSize) + 1}&ndash;{Math.min(currentPage * pageSize, totalItems)} of {totalItems}</span><div className="pagination" aria-label="Agent table pagination"><button className="pagination-button" type="button" aria-label="Previous page" disabled={currentPage === 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>&lsaquo;</button><span>Page {currentPage} of {totalPages}</span><button className="pagination-button" type="button" aria-label="Next page" disabled={currentPage === totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>&rsaquo;</button></div></div></> : <EmptyState title="No matching agents" description="Try changing or clearing the filters."/>}</section>}</main></AppShell>;

  //return <AppShell user={user} onRoleChange={setRole}><main className="page-content agents-page"><div className="page-header"><div><p className="eyebrow">Staff operations</p><h1>Agents</h1><p className="page-description">Review agent performance, qualification progress, and level-change eligibility.</p></div></div>{state === "loading" && !hasLoaded ? <LoadingState/> : state === "permission" ? <PermissionDenied/> : state === "error" ? <ErrorState onRetry={load}/> : !data || !filterOptions ? <LoadingState/> : <section className="panel recent-panel case-table-panel" aria-busy={state === "loading"}><div className="panel-header case-table-header"><div><h2>All agents</h2><p>Open an agent to review details or apply a manual promotion override.</p></div><span className="case-count">{totalItems} agents</span></div><div className="case-filters agent-filters" aria-label="Agent filters"><label><span>Search</span><TextInput type="search" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Agent name, ID, or upline" /></label><label><span>Level</span><FilterSelect allLabel="All levels" value={String(level)} options={[allValue, ...filterOptions.levels.map(String)]} labels={{ all: "All levels", 1: "Level 1", 2: "Level 2", 3: "Level 3" }} onChange={(value) => { setLevel(value === allValue ? allValue : Number(value) as AgentLevel); setPage(1); }}/></label><label><span>Upline</span><FilterSelect allLabel="All uplines" value={upline} options={[allValue, ...filterOptions.uplines.map((item) => item.value)]} labels={Object.fromEntries(filterOptions.uplines.map((item) => [item.value, item.label]))} onChange={(value) => { setUpline(value); setPage(1); }}/></label><label><span>Status</span><FilterSelect allLabel="All statuses" value={status} options={[allValue, ...filterOptions.statuses]} onChange={(value) => { setStatus(value as typeof status); setPage(1); }}/></label><label><span>Qualification</span><FilterSelect allLabel="All qualification states" value={qualification} options={[allValue, ...filterOptions.qualifications]} labels={{ all: "All states", eligible: "Ready to promote", in_progress: "In progress" }} onChange={(value) => { setQualification(value as AgentQualificationFilter); setPage(1); }}/></label><button className="text-button case-filter-reset" type="button" disabled={!hasFilters} onClick={clearFilters}>Clear filters</button></div>{data.items.length ? <><div className="desktop-case-table agent-table"><DataTable caption="All Smartegy agents" headers={["Agent", "Level", "Upline", "Successful Cases", "Direct Agents", "Personal Sales", "Referral Sales", "Commission Earned", "Eligibility"]}>{data.items.map((agent) => <AgentRow key={agent.id} agent={agent}/>)}</DataTable></div><div className="case-table-footer"><span className="case-page-summary">Showing {((currentPage - 1) * pageSize) + 1}&ndash;{Math.min(currentPage * pageSize, totalItems)} of {totalItems}</span><div className="pagination" aria-label="Agent table pagination"><button className="pagination-button" type="button" aria-label="Previous page" disabled={currentPage === 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>&lsaquo;</button><span>Page {currentPage} of {totalPages}</span><button className="pagination-button" type="button" aria-label="Next page" disabled={currentPage === totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>&rsaquo;</button></div></div></> : <EmptyState title="No matching agents" description="Try changing or clearing the filters."/>}</section>}</main></AppShell>;

}

function AgentRow({ agent }: { agent: AgentSummary }) {
  const router = useRouter();
  const qualification = agent.qualification;
  const open = () => router.push(`/agents/${agent.id}`);
  const eligibility = qualification.nextLevel === null ? "Highest Level" : qualification.eligibleForPromotion ? "Eligible for Promotion" : "In Progress";
  return <tr className="agent-table-row case-table-row" tabIndex={0} role="link" aria-label={`Open details for ${agent.displayName}`} onClick={open} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); open(); } }}><td><span className="table-primary">{agent.displayName} <Badge status={agent.status}/></span><span className="table-secondary">{agent.agentCode}</span></td><td>Level {agent.currentLevel}</td><td>{agent.uplineName ?? <span className="muted-cell">Direct registration</span>}</td><td>{agent.successfulCaseCount}</td><td>{agent.directAgentCount}</td><td className="commission-money">{formatMoney(agent.personalSalesSen)}</td><td className="commission-money">{formatMoney(agent.referralSalesSen)}</td><td className="commission-money">{formatMoney(agent.commissionEarnedSen)}</td><td><span className={`qualification-status ${qualification.eligibleForPromotion ? "qualification-ready" : qualification.nextLevel === null ? "" : "qualification-in-progress"}`}>{eligibility}</span></td></tr>;
}
