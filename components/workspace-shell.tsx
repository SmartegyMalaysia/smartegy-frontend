"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { AppShell } from "./app-shell";
import { PreviewUserProvider, usePreviewUser } from "@/lib/preview-user";
import { navigation } from "@/lib/navigation";
import type { UserRole } from "@/lib/types";

function pageTitleFor(pathname: string) {
  if (pathname === "/") return "Sign In";
  if (pathname === "/signup") return "Sign Up";
  if (pathname === "/forgot-password") return "Forgot Password";
  if (pathname === "/reset-password") return "Reset Password";
  if (pathname === "/accept-invitation") return "Accept Invitation";
  if (pathname === "/join" || pathname.startsWith("/join/")) return "Registration";
  if (pathname === "/onboarding/status") return "Onboarding Status";
  if (pathname === "/permission-denied") return "Access Denied";
  if (pathname === "/settings/profile") return "Your Profile";
  if (pathname === "/cases/new") return "New Case";
  if (pathname.startsWith("/cases/")) return "Case Details";
  if (pathname.startsWith("/agents/")) return "Agent Details";
  if (pathname.startsWith("/registrations/")) return "Registration Review";
  if (pathname.startsWith("/commissions/")) return "Commission Details";

  return navigation.find((item) => pathname === item.href)?.label ?? "Workspace";
}

function isPublicRoute(pathname: string) {
  return pathname === "/"
    || pathname === "/signup"
    || pathname === "/forgot-password"
    || pathname === "/reset-password"
    || pathname === "/accept-invitation"
    || pathname === "/join"
    || pathname.startsWith("/join/");
}

function defaultRoleForPath(pathname: string): UserRole {
  if (pathname.startsWith("/approvals") || pathname.startsWith("/users")) return "admin";
  if (pathname.startsWith("/cases") || pathname.startsWith("/agents") || pathname.startsWith("/registrations") || pathname.startsWith("/payouts")) return "staff";
  return "agent";
}

export function WorkspaceShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  useEffect(() => {
    document.title = `${pageTitleFor(pathname)} | Smartegy`;
  }, [pathname]);

  if (isPublicRoute(pathname)) return <>{children}</>;

  return (
    <PreviewUserProvider defaultRole={defaultRoleForPath(pathname)}>
      <AuthenticatedWorkspaceShell
        hideSidebar={pathname === "/settings/profile"}
        onboardingOnly={pathname === "/onboarding/status"}
      >
        {children}
      </AuthenticatedWorkspaceShell>
    </PreviewUserProvider>
  );
}

function AuthenticatedWorkspaceShell({ children, hideSidebar, onboardingOnly }: { children: ReactNode; hideSidebar: boolean; onboardingOnly: boolean }) {
  const { user, setRole, ready, authenticated } = usePreviewUser();
  useEffect(() => {
    if (ready && !authenticated) window.location.replace(new URL("/", window.location.href).toString());
  }, [authenticated, ready]);
  if (ready && !authenticated) return null;
  return (
    <AppShell user={user} onRoleChange={setRole} hideSidebar={hideSidebar} onboardingOnly={onboardingOnly} authLoading={!ready}>
      {children}
    </AppShell>
  );
}
