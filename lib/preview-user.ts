"use client";

import { useEffect, useState } from "react";
import type { CurrentUser, UserRole } from "./types";

const storageKey = "smartegy-preview-role";

const previewUsers: Record<UserRole, CurrentUser> = {
  agent: { id: "user-001", role: "agent", displayName: "Aisha Rahman", email: "aisha@smartegy.example", agentId: "agent-001" },
  staff: { id: "user-002", role: "staff", displayName: "Farid Iskandar", email: "farid@smartegy.example", agentId: null },
  admin: { id: "user-003", role: "admin", displayName: "Mei Tan", email: "mei@smartegy.example", agentId: null },
};

export function usePreviewUser(defaultRole: UserRole = "agent") {
  const [role, setRoleState] = useState<UserRole>(defaultRole);
  useEffect(() => {
    const storedRole = window.localStorage.getItem(storageKey) as UserRole | null;
    if (storedRole && storedRole in previewUsers) setRoleState(storedRole);
  }, []);
  function setRole(role: UserRole) { window.localStorage.setItem(storageKey, role); setRoleState(role); }
  return { role, user: previewUsers[role], setRole };
}
