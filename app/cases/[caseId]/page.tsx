"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { CaseWorkspace } from "@/components/case-workspace";
import { Badge, ErrorState, LoadingState } from "@/components/ui";
import { casesRepository } from "@/lib/case-repository";
import { usePreviewUser } from "@/lib/preview-user";
import type { CaseDetail } from "@/lib/types";

export default function CaseDetailPage() {
  const { user, setRole } = usePreviewUser("staff");
  const params = useParams<{ caseId: string }>();
  const router = useRouter();
  const caseId = params.caseId;
  const [caseDetail, setCaseDetail] = useState<CaseDetail | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error" | "permission">("loading");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    setState("loading");
    casesRepository.getById(user, caseId).then((result) => { if (!active) return; if (result.ok) { setCaseDetail(result.data); setState("ready"); } else setState(result.error.code === "FORBIDDEN" ? "permission" : "error"); });
    return () => { active = false; };
  }, [user, caseId, refreshKey]);

  const retry = () => setRefreshKey((value) => value + 1);
  const backHref = user.role === "agent" ? "/dashboard" : "/cases";
  return <AppShell user={user} onRoleChange={setRole}><main className="page-content case-detail-page">{state === "loading" ? <LoadingState /> : state === "permission" ? <ErrorState onRetry={retry} /> : state === "error" || !caseDetail ? <ErrorState onRetry={retry} /> : <><Link className="back-link" href={backHref}>&lt; Back to {user.role === "agent" ? "Dashboard" : "Case Queue"}</Link><div className="case-detail-header"><div><p className="eyebrow">Case workspace</p><h1>{caseDetail.customer.displayName}</h1><p className="page-description">{caseDetail.caseNumber} · {caseDetail.agentName}</p></div><Badge status={caseDetail.status} /></div><CaseWorkspace initialCase={caseDetail} user={user} onChanged={setCaseDetail} onDeleted={() => router.push(backHref)} /></>}</main></AppShell>;
}
