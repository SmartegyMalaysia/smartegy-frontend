import type { UserRole } from "./types";
export interface NavItem { label: string; href: string; icon: string; roles: UserRole[]; }
export const navigation: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: "grid", roles: ["agent", "admin_staff", "finance_management"] },
  { label: "Cases", href: "/cases", icon: "folder", roles: ["agent", "admin_staff", "finance_management"] },
  { label: "Agents", href: "/agents", icon: "users", roles: ["admin_staff", "finance_management"] },
  { label: "Registrations", href: "/registrations", icon: "users", roles: ["admin_staff", "finance_management"] },
  { label: "Commissions", href: "/commissions", icon: "wallet", roles: ["agent", "admin_staff", "finance_management"] },
  { label: "Invoices & receipts", href: "/documents", icon: "file", roles: ["admin_staff", "finance_management"] },
  { label: "Reports", href: "/reports", icon: "chart", roles: ["admin_staff", "finance_management"] },
  { label: "Settings", href: "/settings/profile", icon: "settings", roles: ["agent", "admin_staff", "finance_management"] },
];
export const roleLabels: Record<UserRole, string> = { agent: "Agent", admin_staff: "Admin / Staff", finance_management: "Finance / Management" };
