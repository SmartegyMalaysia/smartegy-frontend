"use client";

import { TextInput } from "./form-controls";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "./app-shell";
import { Badge, EmptyState, ErrorState, LoadingState, PermissionDenied } from "./ui";
import { DataTable } from "./data-table";
import { ExportIcon } from "./export-icon";
import { FilterSelect } from "./filter-select";
import { DatePicker } from "./date-picker";
import { registrationRepository } from "@/lib/registration-repository";
import { usePreviewUser } from "@/lib/preview-user";
import type { AgentRegistration, RegistrationFeeStatus, RegistrationQueueQuery, RegistrationStatus } from "@/lib/types";

const pageSize = 5;
const registrationStatuses: Array<RegistrationStatus | "all"> = ["all", "draft", "pending_approval", "active", "rejected", "suspended"];
const feeStatuses: Array<RegistrationFeeStatus | "all"> = ["all", "unpaid", "pending_verification", "verified", "rejected", "waived", "refunded"];
const profileStatuses: Array<"all" | "complete" | "incomplete"> = ["all", "complete", "incomplete"];

export function RegistrationQueuePage() {
  const { role, user, setRole, ready } = usePreviewUser("staff");
  const [registrations, setRegistrations] = useState<AgentRegistration[]>([]);
  const [query, setQuery] = useState<RegistrationQueueQuery>({ sort: "priority" });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const requestId = useRef(0);
  const hasLoaded = useRef(false);

  const load = useCallback(async () => {
    const currentRequest = ++requestId.current;
    setRefreshing(true);
    const result = await registrationRepository.listForStaff(user, query);
    if (currentRequest !== requestId.current) return;
    if (result.ok) {
      hasLoaded.current = true;
      setRegistrations(result.data);
      setFailed(false);
    } else if (!hasLoaded.current) {
      setFailed(true);
    }
    setLoading(false);
    setRefreshing(false);
  }, [query, user]);

  useEffect(() => { if (ready) void load(); }, [load, ready]);
  useEffect(() => { setPage(1); }, [query]);

  const totalPages = Math.max(1, Math.ceil(registrations.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const visible = registrations.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const update = (key: keyof RegistrationQueueQuery, value: string) => setQuery((current) => ({ ...current, [key]: value || undefined }));
  const reset = () => setQuery({ sort: "priority" });
  const hasFilters = Object.keys(query).some((key) => key !== "sort" && Boolean(query[key as keyof RegistrationQueueQuery]));

  async function exportRegistrations() {
    setExporting(true);
    await registrationRepository.exportForStaff(user, query);
    setExporting(false);
  }

  return <AppShell user={user} onRoleChange={setRole} authLoading={!ready}>
    <div className="page-content registration-page-content">
      {!ready ? <LoadingState/> : <>
        <div className="page-header"><div><p className="eyebrow">Staff operations</p><h1>Agent Registration</h1><p className="page-description">Find applications awaiting profile and payment review.</p></div></div>
        <div className="preview-banner"><span className="preview-dot"/><div><strong>Manual verification</strong><span> Payment Proof Is Reviewed by authorised staff. No payment is verified automatically.</span></div></div>
        {role === "agent" ? <PermissionDenied/> : loading && !hasLoaded.current ? <LoadingState/> : failed && !hasLoaded.current ? <ErrorState onRetry={load}/> : <section className="panel recent-panel case-table-panel">
          <div className="panel-header case-table-header"><div><h2>Agent Registrations</h2><p>Select an application to review its payment proof and audit history.</p></div><span className="case-count">{registrations.length} applications {refreshing && <span className="table-secondary" role="status" aria-live="polite">Updating…</span>}</span></div>
          <QueueFilters query={query} update={update} reset={reset} hasFilters={hasFilters}/>
          {registrations.length === 0 ? <EmptyState title={query.search || hasFilters ? "No matching applications" : "No registrations yet"} description={query.search || hasFilters ? "Try changing or clearing the filters." : "New applications will appear after applicants submit their registration."}/> : <>
            <div className="desktop-case-table"><DataTable caption="Agent registration queue" headers={["User ID", "Name", "Phone number", "Email", "Upline agent", "Payment verified", "Profile"]}>{visible.map((registration) => <RegistrationRow key={registration.id} registration={registration}/>)}</DataTable></div>
            <div className="case-table-footer"><span className="case-page-summary">Showing {visible.length ? (currentPage - 1) * pageSize + 1 : 0}&ndash;{Math.min(currentPage * pageSize, registrations.length)} of {registrations.length}</span><div className="case-table-actions"><button className="button button-secondary button-sm" type="button" onClick={() => void exportRegistrations()} disabled={exporting || !registrations.length}><ExportIcon size={15}/>{exporting ? "Exporting…" : "Export"}</button><div className="pagination" aria-label="Registration queue pagination"><button className="pagination-button" type="button" aria-label="Previous page" disabled={currentPage === 1} onClick={() => setPage((value) => value - 1)}>&lsaquo;</button><span>Page {currentPage} of {totalPages}</span><button className="pagination-button" type="button" aria-label="Next page" disabled={currentPage === totalPages} onClick={() => setPage((value) => value + 1)}>&rsaquo;</button></div></div></div>
          </>}
        </section>}
      </>}
    </div>
  </AppShell>;
}

function QueueFilters({ query, update, reset, hasFilters }: { query: RegistrationQueueQuery; update: (key: keyof RegistrationQueueQuery, value: string) => void; reset: () => void; hasFilters: boolean }) {
  return <div className="case-filters registration-case-filters" aria-label="Registration queue filters"><label><span>Search</span><TextInput type="search" value={query.search ?? ""} onChange={(event) => update("search", event.target.value)} placeholder="Application, name, email, mobile, or referrer" /></label><label><span>Registration</span><FilterSelect allLabel="All registration statuses" value={query.registrationStatus ?? "all"} options={registrationStatuses} onChange={(value) => update("registrationStatus", value)} /></label><label><span>Fee</span><FilterSelect allLabel="All fee statuses" value={query.feeStatus ?? "all"} options={feeStatuses} onChange={(value) => update("feeStatus", value)} /></label><label><span>Profile</span><FilterSelect allLabel="All profile states" value={query.profileComplete ?? "all"} options={profileStatuses} labels={{ all: "All profiles", complete: "Complete", incomplete: "Incomplete" }} onChange={(value) => update("profileComplete", value)} /></label><div className="commission-filter-field"><span>Submitted from</span><DatePicker id="registration-submitted-from" value={query.submittedFrom ?? ""} placeholder="DD/MM/YYYY" onChange={(value) => update("submittedFrom", value)} /></div><div className="commission-filter-field"><span>Submitted to</span><DatePicker id="registration-submitted-to" value={query.submittedTo ?? ""} placeholder="DD/MM/YYYY" onChange={(value) => update("submittedTo", value)} /></div><button className="text-button case-filter-reset" type="button" onClick={reset} disabled={!hasFilters}>Clear filters</button></div>;
}

function ReadinessBadge({ complete, completeLabel, incompleteLabel }: { complete: boolean; completeLabel: string; incompleteLabel: string }) { return <span className={`badge ${complete ? "badge-success" : "badge-warning"}`}><span className="badge-dot" aria-hidden="true" />{complete ? completeLabel : incompleteLabel}</span>; }
function RegistrationRow({ registration }: { registration: AgentRegistration }) {
  const router = useRouter();
  const open = () => router.push(`/registrations/${encodeURIComponent(registration.applicationNumber)}`);
  return <tr className="case-table-row" tabIndex={0} role="link" aria-label={`Review registration for ${registration.profile.fullName}`} onClick={open} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); open(); } }}><td><span className="table-primary">{registration.applicationNumber}</span></td><td>{registration.profile.fullName}</td><td>{registration.profile.mobileNumber}</td><td>{registration.profile.email}</td><td>{registration.referringAgentName}</td><td><Badge status={registration.feeStatus}/></td><td><ReadinessBadge complete={registration.profileComplete} completeLabel="Complete" incompleteLabel="Incomplete"/></td></tr>;
}
