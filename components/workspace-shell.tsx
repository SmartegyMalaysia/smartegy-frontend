"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { AppShell } from "./app-shell";
import { PreviewUserProvider, usePreviewUser } from "@/lib/preview-user";
import { navigation } from "@/lib/navigation";
import type { UserRole } from "@/lib/types";
import { useIdleLogout } from "@/lib/use-idle-logout";
import { Button } from "./ui";
import { PopupModal } from "./popup-modal";

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
  const { warningSecondsRemaining, staySignedIn } = useIdleLogout(ready && authenticated, user.id);
  useEffect(() => {
    if (ready && !authenticated) window.location.replace(new URL("/", window.location.href).toString());
  }, [authenticated, ready]);
  if (ready && !authenticated) return null;
  return (
    <>
      <AppShell user={user} onRoleChange={setRole} hideSidebar={hideSidebar} onboardingOnly={onboardingOnly} authLoading={!ready}>
        {children}
      </AppShell>
      <PopupModal
        open={warningSecondsRemaining !== null}
        title="You are about to be signed out"
        description="For your security, you will be signed out because of inactivity."
        icon={<span aria-hidden="true">!</span>}
        tone="danger"
        size="sm"
        onClose={staySignedIn}
        showCloseButton={false}
        closeOnBackdrop={false}
        closeOnEscape={false}
        footer={<div className="dialog-actions"><Button onClick={staySignedIn}>Stay signed in</Button></div>}
      >
        <p className="inactivity-countdown" role="timer" aria-live="polite">
          {warningSecondsRemaining ?? 0} seconds remaining
        </p>
      </PopupModal>
    </>
  );
}
