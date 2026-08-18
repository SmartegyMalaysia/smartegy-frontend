"use client";

import { createContext, createElement, useContext, useEffect, useState } from "react";
import type { CurrentUser, UserRole } from "./types";
import { getSupabaseBrowserClient, isDeveloperView, isSupabaseConfigured } from "./supabase-browser";

const storageKey = "smartegy-preview-role";

type PreviewUserContextValue = {
  role: UserRole;
  user: CurrentUser;
  setRole: (nextRole: UserRole) => void;
  ready: boolean;
};

const PreviewUserContext = createContext<PreviewUserContextValue | null>(null);

const previewUsers: Record<UserRole, CurrentUser> = {
  agent: { id: "user-001", role: "agent", displayName: "Aisha Rahman", email: "aisha@smartegy.example", agentId: "agent-001" },
  staff: { id: "user-002", role: "staff", displayName: "Farid Iskandar", email: "farid@smartegy.example", agentId: null },
  admin: { id: "user-003", role: "admin", displayName: "Mei Tan", email: "mei@smartegy.example", agentId: null },
};

function usePreviewUserState(defaultRole: UserRole): PreviewUserContextValue {
  const [role, setRoleState] = useState<UserRole>(defaultRole);
  const [user, setUser] = useState<CurrentUser>(previewUsers[defaultRole]);
  // Keep the first render identical on the server and browser. Configuration,
  // sessionStorage, and localStorage are browser/runtime state and must only
  // affect the tree after hydration.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (isDeveloperView()) {
      const storedRole = window.localStorage.getItem(storageKey) as UserRole | null;
      if (storedRole && storedRole in previewUsers) { setRoleState(storedRole); setUser(previewUsers[storedRole]); }
      setReady(true);
      return;
    }
    const supabase = getSupabaseBrowserClient();
    if (supabase) {
      let active = true;
      const load = async () => {
        const { data: auth } = await supabase.auth.getUser();
        if (!auth.user || !active) { if (active) setReady(true); return; }
        const { data: profile } = await supabase.from("profiles").select("id,role,display_name,phone,account_status").eq("id", auth.user.id).maybeSingle();
        if (!profile || !active) { if (active) setReady(true); return; }
        const { data: agent } = await supabase.from("agents").select("id").eq("profile_id", profile.id).maybeSingle();
        const nextUser: CurrentUser = {
          id: profile.id,
          role: profile.role as UserRole,
          displayName: profile.display_name,
          email: auth.user.email ?? null,
          agentId: agent?.id ?? null,
          accountStatus: profile.account_status as CurrentUser["accountStatus"],
        };
        setRoleState(nextUser.role);
        setUser(nextUser);
        setReady(true);
      };
      void load();
      const { data: listener } = supabase.auth.onAuthStateChange(() => { void load(); });
      return () => { active = false; listener.subscription.unsubscribe(); };
    }
    const storedRole = window.localStorage.getItem(storageKey) as UserRole | null;
    if (storedRole && storedRole in previewUsers) { setRoleState(storedRole); setUser(previewUsers[storedRole]); }
    setReady(true);
  }, []);
  function setRole(nextRole: UserRole) {
    if (getSupabaseBrowserClient()) return;
    window.localStorage.setItem(storageKey, nextRole); setRoleState(nextRole); setUser(previewUsers[nextRole]);
  }
  return { role, user, setRole, ready };
}

export function PreviewUserProvider({ children, defaultRole = "agent" }: { children: React.ReactNode; defaultRole?: UserRole }) {
  const value = usePreviewUserState(defaultRole);
  return createElement(PreviewUserContext.Provider, { value }, children);
}

export function usePreviewUser(_defaultRole: UserRole = "agent"): PreviewUserContextValue {
  const value = useContext(PreviewUserContext);
  if (!value) throw new Error("usePreviewUser must be used within PreviewUserProvider");
  return value;
}
