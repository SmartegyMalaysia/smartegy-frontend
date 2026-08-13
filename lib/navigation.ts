import type { UserRole } from "./types";
export interface NavItem { label: string; href: string; icon: string; roles: UserRole[]; }
export const navigation: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: "grid", roles: ["agent", "staff", "admin"] },
  { label: "Agents", href: "/agents", icon: "users", roles: ["staff", "admin"] },
  { label: "Registrations", href: "/registrations", icon: "file", roles: ["staff", "admin"] },
  { label: "Approvals", href: "/approvals", icon: "chart", roles: ["admin"] },
  { label: "Commissions", href: "/commissions", icon: "wallet", roles: ["agent"] },
  { label: "Payouts", href: "/payouts", icon: "wallet", roles: ["staff", "admin"] },
];
export const roleLabels: Record<UserRole, string> = { agent: "Agent", staff: "Staff", admin: "Admin" };
