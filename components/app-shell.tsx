"use client";

import { createContext, useContext, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { createAvatar } from "@dicebear/core";
import { initials as avatarStyle } from "@dicebear/collection";
import { navigation, roleLabels } from "@/lib/navigation";
import type { CurrentUser, UserRole } from "@/lib/types";
import { Icon } from "./icons";
import { BrandLogo } from "./brand-logo";
import { logout as authLogout } from "@/lib/auth-repository";
import { isSupabaseConfigured } from "@/lib/supabase-browser";

function ProfileMenuIcon() { return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="3.2"/><path d="M5 20a7 7 0 0 1 14 0"/></svg>; }
function LogoutMenuIcon() { return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8"/><path d="M11 12h9M17 8l4 4-4 4"/></svg>; }

function breadcrumbFor(pathname: string, restricted: boolean) {
  if (restricted) return ["Onboarding", "Registration"];
  if (pathname === "/settings/profile") return ["Settings", "Your profile"];
  const match = navigation.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
  if (!match) return ["Workspace", "Dashboard"];
  if (pathname === match.href) return ["Workspace", match.label];
  const detailLabel = match.label === "Agents" ? "Agent Details" : match.label === "Registrations" ? "Registration Review" : `${match.label.slice(0, -1)} Details`;
  return [match.label, detailLabel];
}

const AppShellContext = createContext(false);

export function AppShell(props: { user: CurrentUser; children: React.ReactNode; onRoleChange: (role: UserRole) => void; onboardingOnly?: boolean; hideSidebar?: boolean; authLoading?: boolean }) {
  const nested = useContext(AppShellContext);
  return nested ? <>{props.children}</> : <AppShellFrame {...props} />;
}

function AppShellFrame({ user, children, onRoleChange, onboardingOnly = false, hideSidebar = false, authLoading = false }: { user: CurrentUser; children: React.ReactNode; onRoleChange: (role: UserRole) => void; onboardingOnly?: boolean; hideSidebar?: boolean; authLoading?: boolean }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const pathname = usePathname();
  useEffect(() => { setPreviewMode(!isSupabaseConfigured()); }, []);
  const pendingAgent = !authLoading && user.role === "agent" && user.accountStatus !== "active";
  const restricted = Boolean(!authLoading && (onboardingOnly || pendingAgent));
  const links = authLoading || restricted ? [] : navigation.filter((item) => item.roles.includes(user.role));
  const breadcrumb = breadcrumbFor(pathname, authLoading ? false : restricted);
  const nav = <nav aria-label="Primary navigation" aria-busy={authLoading}>{!restricted && <p className="nav-label">Workspace</p>}{authLoading ? <div className="sidebar-nav-loading" aria-hidden="true"><span /><span /><span /><span /></div> : links.map((item) => <Link onClick={() => setMobileOpen(false)} className={`nav-link ${pathname === item.href || pathname.startsWith(`${item.href}/`) ? "nav-link-active" : ""}`} href={item.href} key={item.href}><Icon name={item.icon}/><span>{item.label}</span></Link>)}</nav>;
  return <AppShellContext.Provider value>
  <div className="app-shell" aria-busy={authLoading}>
    {!hideSidebar && <aside className={`sidebar ${collapsed ? "sidebar-collapsed" : ""} ${mobileOpen ? "sidebar-mobile-open" : ""}`}>
      <BrandLogo className="brand" variant="stacked" compactVariant="icon" />
      {nav}
      <div className="sidebar-footer">{!authLoading && !restricted && previewMode && <><div className="preview-note"><span className="preview-dot"/>Preview mode</div><label className="role-select-label" htmlFor="role-switcher">View as</label><select id="role-switcher" value={user.role} onChange={(event) => onRoleChange(event.target.value as UserRole)}>{Object.entries(roleLabels).map(([role, label]) => <option key={role} value={role}>{label}</option>)}</select></>}</div>
      {!restricted && !authLoading && <button className="collapse-button" aria-label={collapsed ? "Expand navigation" : "Collapse navigation"} onClick={() => setCollapsed(!collapsed)}><Icon name="chevron"/><span>{collapsed ? "" : "Collapse sidebar"}</span></button>}
    </aside>}
    {!hideSidebar && mobileOpen && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setMobileOpen(false)}/>}<div className={`shell-main ${hideSidebar ? "shell-main-full" : ""}`}><header className="topbar">{!hideSidebar && <button className="mobile-menu" aria-label="Open navigation" aria-expanded={mobileOpen} title="Open navigation" onClick={() => setMobileOpen(true)}><Icon name="menu"/><span className="mobile-menu-label">Menu</span></button>}<div className="breadcrumb">{breadcrumb[0]} <span>/</span> <strong>{breadcrumb[1]}</strong></div>{authLoading ? <span className="auth-loading-label" aria-live="polite">Loading account…</span> : <UserMenu user={user}/>}</header><main>{children}</main></div>
  </div>
  </AppShellContext.Provider>;
}

function UserMenu({ user }: { user: CurrentUser }) {
  const router = useRouter();
  const avatarSrc = createAvatar(avatarStyle, { seed: user.displayName, backgroundColor: ["d3edf1"], radius: 50, size: 64 }).toDataUri();
  async function logout() { if (!window.confirm("Log out of your Smartegy account?")) return; await authLogout(); router.replace("/"); router.refresh(); }
  return <details className="user-menu"><summary aria-label={`Account menu for ${user.displayName}`}><Image className="avatar avatar-image" src={avatarSrc} alt="" width={32} height={32} unoptimized/><span className="user-name">{user.displayName}</span><Icon name="chevron" size={14}/></summary><div className="user-menu-popover"><Link href="/settings/profile"><ProfileMenuIcon/><span>Your Profile</span></Link><button type="button" onClick={logout}><LogoutMenuIcon/><span>Log Out</span></button></div></details>;
}
