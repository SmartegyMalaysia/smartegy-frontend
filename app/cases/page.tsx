"use client";

import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { CaseQueue } from "@/components/case-queue";
import { PermissionDenied } from "@/components/ui";
import { usePreviewUser } from "@/lib/preview-user";

export default function CasesPage() {
  const { role, user, setRole, ready } = usePreviewUser("staff");
  if (role === "agent") return <AppShell user={user} onRoleChange={setRole}><main className="page-content"><PermissionDenied /></main></AppShell>;
  return <AppShell user={user} onRoleChange={setRole}><div className="page-content cases-page"><div className="page-header"><div><p className="eyebrow">Operations</p><h1>Case queue</h1><p className="page-description">Search, filter, and open cases submitted by your agent network.</p></div></div>{ready ? <CaseQueue actor={user} isAgent={false} showCount title="All cases" description="Review customer submissions, payment state, and recent activity." /> : null}</div></AppShell>;
}
