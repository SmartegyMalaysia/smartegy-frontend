"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AppShell } from "./app-shell";
import { PreviewUserProvider, usePreviewUser } from "@/lib/preview-user";
import type { UserRole } from "@/lib/types";

function isPublicRoute(pathname: string) {
  return pathname === "/"
    || pathname === "/signup"
    || pathname === "/forgot-password"
    || pathname === "/reset-password"
    || pathname === "/join"
    || pathname.startsWith("/join/")
    || pathname === "/onboarding/status";
}

function defaultRoleForPath(pathname: string): UserRole {
  if (pathname.startsWith("/approvals") || pathname.startsWith("/users")) return "admin";
  if (pathname.startsWith("/cases") || pathname.startsWith("/agents") || pathname.startsWith("/registrations") || pathname.startsWith("/payouts")) return "staff";
  return "agent";
}

export function WorkspaceShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  if (isPublicRoute(pathname)) return <>{children}</>;

  return (
    <PreviewUserProvider defaultRole={defaultRoleForPath(pathname)}>
      <AuthenticatedWorkspaceShell hideSidebar={pathname === "/settings/profile"}>
        {children}
      </AuthenticatedWorkspaceShell>
    </PreviewUserProvider>
  );
}

function AuthenticatedWorkspaceShell({ children, hideSidebar }: { children: ReactNode; hideSidebar: boolean }) {
  const { user, setRole, ready } = usePreviewUser();
  return (
    <AppShell user={user} onRoleChange={setRole} hideSidebar={hideSidebar} authLoading={!ready}>
      {children}
    </AppShell>
  );
}
