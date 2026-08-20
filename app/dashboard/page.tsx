"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { ErrorState, LoadingState, StatCard } from "@/components/ui";
import { Icon } from "@/components/icons";
import { formatMoney } from "@/lib/format";
import { CaseQueue } from "@/components/case-queue";
import { dashboardRepository } from "@/lib/mock-repository";
import { roleLabels } from "@/lib/navigation";
import { usePreviewUser } from "@/lib/preview-user";
import type { DashboardSnapshot, UserRole } from "@/lib/types";

export default function DashboardPage() {
  const { role, user, setRole, ready } = usePreviewUser();
  const [timeGreeting, setTimeGreeting] = useState("Good morning");
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setTimeGreeting(getTimeGreeting());
  }, []);
  useEffect(() => {
    if (!ready) return;
    let active = true;
    setLoading(true);
    setFailed(false);
    dashboardRepository.getSnapshot(role)
      .then((nextSnapshot) => { if (active) setSnapshot(nextSnapshot); })
      .catch(() => { if (active) setFailed(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [ready, role, user.id]);
  return <AppShell user={user} onRoleChange={setRole} authLoading={!ready}><div className="page-content dashboard-page-content">{!ready ? <LoadingState /> : <><div className="page-header"><div><p className="eyebrow">{roleLabels[role]} workspace</p><h1>{timeGreeting}, {user.displayName.split(" ")[0]}</h1><p className="page-description">Here&apos;s what needs your attention today.</p></div><div className="page-actions">{role === "agent" && <Link className="button button-primary" href="/cases/new"><Icon name="plus" size={17} /> Submit New Case</Link>}</div></div>{loading ? <LoadingState /> : failed ? <ErrorState onRetry={() => setRole(role)} /> : snapshot && <DashboardContent snapshot={snapshot} role={role} />}</>}</div></AppShell>;
}

function getTimeGreeting(date = new Date()) {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function DashboardContent({ snapshot, role }: { snapshot: DashboardSnapshot; role: UserRole }) {
  const isAgent = role === "agent";
  const activeCases = snapshot.cases.filter((item) => item.status !== "completed");
  const sales = snapshot.cases.reduce((sum, item) => sum + (item.saleAmountSen ?? 0), 0);
  const commissions = snapshot.commissions.reduce((sum, item) => sum + item.entitlementSen, 0);
  const successfulCases = snapshot.cases.filter((item) => item.status === "completed" || item.status === "active_installments").length;
  const pendingReviews = snapshot.cases.filter((item) => item.status === "submitted" || item.status === "under_review").length;
  const pendingPayments = snapshot.cases.filter((item) => item.paymentStatus === "pending_verification").length;
  const payable = snapshot.commissions.filter((item) => item.status === "scheduled" || item.status === "approved").reduce((sum, item) => sum + item.entitlementSen, 0);
  const paid = snapshot.commissions.filter((item) => item.status === "paid").reduce((sum, item) => sum + item.paidToDateSen, 0);
  return <>
    {isAgent ? <><>{/* Current qualification is intentionally hidden from the home dashboard. */}</><div className="stat-grid"><StatCard label="Active cases" value={String(activeCases.length)} detail="Current case queue" accent /><StatCard label="Successful cases" value={String(successfulCases)} detail="Completed or active" /><StatCard label="Personal sales" value={formatMoney(sales)} detail="From available case records" /><StatCard label="Commissions earned" value={formatMoney(commissions)} detail="From commission entries" /></div></> : <>{/* <section className="focus-panel admin-focus"><div><p className="eyebrow">Operational priority</p><h2>Cases needing attention</h2><p className="focus-copy">{pendingReviews} case{pendingReviews === 1 ? "" : "s"} and {pendingPayments} payment{pendingPayments === 1 ? "" : "s"} are waiting for an update.</p><div className="priority-list"><span><i className="priority-dot warning" />Pending review <strong>{pendingReviews}</strong></span><span><i className="priority-dot danger" />Payment verification <strong>{pendingPayments}</strong></span></div></div><div className="focus-side"><span className="priority-number">{String(pendingReviews + pendingPayments).padStart(2, "0")}</span><span>Open priorities</span><Link href="/cases">Open queue <Icon name="arrow" size={14} /></Link></div></section> */}<div className="stat-grid"><StatCard label="Total cases" value={String(snapshot.cases.length)} detail="Available to your role" accent /><StatCard label="Sales this month" value={formatMoney(sales)} detail="From available case records" /><StatCard label="Commission payable" value={formatMoney(payable)} detail="Scheduled or approved" /><StatCard label="Paid commissions" value={formatMoney(paid)} detail="Paid commission entries" /></div></>}
    <div className="dashboard-grid dashboard-grid-agent"><CaseQueue cases={snapshot.cases} isAgent={isAgent} />{/* Team snapshot is intentionally hidden until its replacement is defined. */}</div>
  </>;
}

function TeamSnapshot({ agents }: { agents: DashboardSnapshot["agents"] }) {
  return <section className="panel side-panel"><div className="panel-header"><div><h2>Team snapshot</h2><p>Agent performance</p></div><Link className="text-link" href="/agents">View all <Icon name="arrow" size={14} /></Link></div><div className="team-list">{agents.map((agent) => <div className="team-item" key={agent.id}><span className="avatar avatar-small">{agent.displayName.split(" ").map((name) => name[0]).join("")}</span><div><strong>{agent.displayName}</strong><span>Level {agent.currentLevel} &middot; {agent.successfulCaseCount} successful cases</span></div><span className="team-sales">{formatMoney(agent.personalSalesSen)}</span></div>)}</div></section>;
}






