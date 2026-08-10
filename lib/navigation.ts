import type { UserRole } from "./types";
export interface NavItem { label: string; href: string; icon: string; roles: UserRole[]; }
export const navigation: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: "grid", roles: ["agent", "staff", "admin"] },
  { label: "Cases", href: "/cases", icon: "folder", roles: ["agent", "staff", "admin"] },
  { label: "Agents", href: "/agents", icon: "users", roles: ["staff", "admin"] },
  { label: "Registrations", href: "/registrations", icon: "users", roles: ["staff", "admin"] },
  { label: "Commissions", href: "/commissions", icon: "wallet", roles: ["agent", "staff", "admin"] },
  { label: "Invoices & receipts", href: "/documents", icon: "file", roles: ["staff", "admin"] },
  { label: "Reports", href: "/reports", icon: "chart", roles: ["staff", "admin"] },
  { label: "Settings", href: "/settings/profile", icon: "settings", roles: ["agent", "staff", "admin"] },
];
export const roleLabels: Record<UserRole, string> = { agent: "Agent", staff: "Staff", admin: "Admin" };
