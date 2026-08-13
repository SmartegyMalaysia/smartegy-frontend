"use client";

import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { PermissionDenied } from "@/components/ui";
import { usePreviewUser } from "@/lib/preview-user";

export default function PermissionDeniedPage() {
  const { user, setRole } = usePreviewUser();
  return <AppShell user={user} onRoleChange={setRole}><main className="page-content"><PermissionDenied action={<Link className="button button-secondary" href="/dashboard">Return to dashboard</Link>}/></main></AppShell>;
}
