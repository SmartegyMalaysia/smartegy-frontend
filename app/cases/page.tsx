"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { CaseQueue } from "@/components/case-queue";
import { ErrorState, LoadingState, PermissionDenied } from "@/components/ui";
import { dashboardRepository } from "@/lib/mock-repository";
import { usePreviewUser } from "@/lib/preview-user";
import type { DashboardSnapshot } from "@/lib/types";

export default function CasesPage() {
  const { role, user, setRole } = usePreviewUser("staff");
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    if (role === "agent") {
      setSnapshot(null);
      setLoading(false);
      setFailed(false);
      return () => { active = false; };
    }
    setLoading(true);
    setFailed(false);
    dashboardRepository.getSnapshot(role).then((data) => { if (active) setSnapshot(data); }).catch(() => { if (active) setFailed(true); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [role, user.id, refreshKey]);

  if (role === "agent") return <AppShell user={user} onRoleChange={setRole}><main className="page-content"><PermissionDenied /></main></AppShell>;
  return <AppShell user={user} onRoleChange={setRole}><div className="page-content cases-page"><div className="page-header"><div><p className="eyebrow">Operations</p><h1>Case queue</h1><p className="page-description">Search, filter, and open cases submitted by your agent network.</p></div></div>{loading ? <LoadingState /> : failed ? <ErrorState onRetry={() => setRefreshKey((value) => value + 1)} /> : snapshot && <CaseQueue cases={snapshot.cases} isAgent={false} showCount title="All cases" description="Review customer submissions, payment state, and recent activity." />}</div></AppShell>;
}
