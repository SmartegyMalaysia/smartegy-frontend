"use client";

import { useEffect, useState } from "react";
import type { CurrentUser, UserRole } from "./types";
import { getSupabaseBrowserClient, isDeveloperView } from "./supabase-browser";

const storageKey = "smartegy-preview-role";

const previewUsers: Record<UserRole, CurrentUser> = {
  agent: { id: "user-001", role: "agent", displayName: "Aisha Rahman", email: "aisha@smartegy.example", agentId: "agent-001" },
  staff: { id: "user-002", role: "staff", displayName: "Farid Iskandar", email: "farid@smartegy.example", agentId: null },
  admin: { id: "user-003", role: "admin", displayName: "Mei Tan", email: "mei@smartegy.example", agentId: null },
};

export function usePreviewUser(defaultRole: UserRole = "agent") {
  const [role, setRoleState] = useState<UserRole>(defaultRole);
  const [user, setUser] = useState<CurrentUser>(previewUsers[defaultRole]);
  useEffect(() => {
    if (isDeveloperView()) {
      const storedRole = window.localStorage.getItem(storageKey) as UserRole | null;
      if (storedRole && storedRole in previewUsers) { setRoleState(storedRole); setUser(previewUsers[storedRole]); }
      return;
    }
    const supabase = getSupabaseBrowserClient();
    if (supabase) {
      let active = true;
      const load = async () => {
        const { data: auth } = await supabase.auth.getUser();
        if (!auth.user || !active) return;
        const { data: profile } = await supabase.from("profiles").select("id,role,display_name,phone,account_status").eq("id", auth.user.id).maybeSingle();
        if (!profile || !active) return;
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
      };
      void load();
      const { data: listener } = supabase.auth.onAuthStateChange(() => { void load(); });
      return () => { active = false; listener.subscription.unsubscribe(); };
    }
    const storedRole = window.localStorage.getItem(storageKey) as UserRole | null;
    if (storedRole && storedRole in previewUsers) { setRoleState(storedRole); setUser(previewUsers[storedRole]); }
  }, []);
  function setRole(nextRole: UserRole) {
    if (getSupabaseBrowserClient()) return;
    window.localStorage.setItem(storageKey, nextRole); setRoleState(nextRole); setUser(previewUsers[nextRole]);
  }
  return { role, user, setRole };
}
