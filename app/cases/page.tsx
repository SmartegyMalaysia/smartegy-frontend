"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { CaseQueue } from "@/components/case-queue";
import { LoadingState, PermissionDenied } from "@/components/ui";
import { usePreviewUser } from "@/lib/preview-user";

export default function CasesPage() {
  const { role, user, setRole, ready } = usePreviewUser("staff");
  const router = useRouter();
  useEffect(() => { if (ready && role === "admin") router.replace("/dashboard"); }, [ready, role, router]);
  return <AppShell user={user} onRoleChange={setRole} authLoading={!ready || role === "admin"}><div className="page-content cases-page">{!ready || role === "admin" ? <LoadingState /> : role === "agent" ? <PermissionDenied /> : <><div className="page-header"><div><p className="eyebrow">Operations</p><h1>Case Queue</h1><p className="page-description">Search, filter, and open cases submitted by your agent network.</p></div></div><CaseQueue actor={user} isAgent={false} showCount title="All Cases" description="Review customer submissions, payment state, and recent activity." /></>}</div></AppShell>;
}
