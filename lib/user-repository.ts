import { getSupabaseBrowserClient, isSupabaseConfigured, normalizeSupabaseError } from "./supabase-browser";
import type { AccountStatus, CurrentUser, ManageUser, UpdateManageUserInput, UserRole } from "./types";

type UserErrorCode = "FORBIDDEN" | "NOT_FOUND" | "VALIDATION_ERROR" | "CONFLICT" | "INTERNAL_ERROR";
export type UserResult<T> = { ok: true; data: T } | { ok: false; error: { code: UserErrorCode; message: string; fieldErrors?: Record<string, string[]> } };
export interface UserRepository { list(actor: CurrentUser): Promise<UserResult<ManageUser[]>>; update(actor: CurrentUser, userId: string, input: UpdateManageUserInput): Promise<UserResult<ManageUser>>; }

const mockUsers: ManageUser[] = [
  { id: "user-003", displayName: "Mei Tan", email: "mei@smartegy.example", phone: "+60 12-889 0042", role: "admin", accountStatus: "active", agentCode: null, lastActiveAt: "2026-08-18T04:25:00Z", createdAt: "2026-05-11T02:10:00Z" },
  { id: "user-002", displayName: "Farid Iskandar", email: "farid@smartegy.example", phone: "+60 13-210 7788", role: "staff", accountStatus: "active", agentCode: null, lastActiveAt: "2026-08-18T03:40:00Z", createdAt: "2026-05-14T07:30:00Z" },
  { id: "user-001", displayName: "Aisha Rahman", email: "aisha@smartegy.example", phone: "+60 12-345 6789", role: "agent", accountStatus: "active", agentCode: "AG-001", lastActiveAt: "2026-08-17T09:12:00Z", createdAt: "2026-05-18T01:00:00Z" },
  { id: "user-004", displayName: "Daniel Lim", email: "daniel@smartegy.example", phone: "+60 16-445 2301", role: "agent", accountStatus: "active", agentCode: "AG-002", lastActiveAt: "2026-08-16T08:05:00Z", createdAt: "2026-06-03T04:50:00Z" },
  { id: "user-005", displayName: "Nadia Yusuf", email: "nadia@smartegy.example", phone: "+60 11-5534 8821", role: "agent", accountStatus: "invited", agentCode: "AG-003", lastActiveAt: null, createdAt: "2026-08-14T06:20:00Z" },
  { id: "user-006", displayName: "Hafiz Roslan", email: "hafiz@smartegy.example", phone: "+60 17-929 1104", role: "agent", accountStatus: "active", agentCode: "AG-004", lastActiveAt: "2026-08-15T02:30:00Z", createdAt: "2026-06-21T03:45:00Z" },
  { id: "user-007", displayName: "Siti Noraini", email: "siti@smartegy.example", phone: "+60 14-876 5100", role: "staff", accountStatus: "inactive", agentCode: null, lastActiveAt: "2026-07-31T01:16:00Z", createdAt: "2026-06-28T08:05:00Z" },
];

let users = structuredClone(mockUsers);
const roles: UserRole[] = ["agent", "staff", "admin"];
const statuses: AccountStatus[] = ["invited", "active", "inactive"];
function admin(actor: CurrentUser) { return actor.role === "admin"; }
function fail<T>(code: UserErrorCode, message: string, fieldErrors?: Record<string, string[]>): UserResult<T> { return { ok: false, error: { code, message, fieldErrors } }; }
function validate(input: UpdateManageUserInput) {
  const fieldErrors: Record<string, string[]> = {};
  if (!input.displayName.trim()) fieldErrors.displayName = ["Enter the user’s display name."];
  if (!roles.includes(input.role)) fieldErrors.role = ["Choose a valid role."];
  if (!statuses.includes(input.accountStatus)) fieldErrors.accountStatus = ["Choose a valid account status."];
  return fieldErrors;
}

export const mockUserRepository: UserRepository = {
  async list(actor) { if (!admin(actor)) return fail("FORBIDDEN", "Only administrators can manage user accounts."); await new Promise((resolve) => setTimeout(resolve, 120)); return { ok: true, data: structuredClone(users) }; },
  async update(actor, userId, input) {
    if (!admin(actor)) return fail("FORBIDDEN", "Only administrators can update user accounts.");
    const fieldErrors = validate(input); if (Object.keys(fieldErrors).length) return fail("VALIDATION_ERROR", "Check the highlighted fields and try again.", fieldErrors);
    const user = users.find((item) => item.id === userId); if (!user) return fail("NOT_FOUND", "User not found.");
    if (user.id === actor.id && (input.role !== user.role || input.accountStatus !== (actor.accountStatus ?? "active"))) return fail("CONFLICT", "You cannot change your own role or account status from this screen.");
    user.displayName = input.displayName.trim(); user.phone = input.phone.trim() || null; user.role = input.role; user.accountStatus = input.accountStatus;
    return { ok: true, data: structuredClone(user) };
  },
};

function supabaseError<T>(error: unknown): UserResult<T> {
  const normalized = normalizeSupabaseError(error as { code?: string; message?: string });
  const code: UserErrorCode = normalized.code === "FORBIDDEN" ? "FORBIDDEN" : normalized.code === "NOT_FOUND" ? "NOT_FOUND" : normalized.code === "DUPLICATE" ? "CONFLICT" : normalized.code === "VALIDATION_ERROR" ? "VALIDATION_ERROR" : "INTERNAL_ERROR";
  return fail(code, normalized.message);
}

export const supabaseUserRepository: UserRepository = {
  async list(actor) {
    if (!admin(actor)) return fail("FORBIDDEN", "Only administrators can manage user accounts.");
    const supabase = getSupabaseBrowserClient(); if (!supabase) return fail("INTERNAL_ERROR", "Supabase is not configured.");
    const { data, error } = await supabase.rpc("admin_list_users");
    if (error) return supabaseError(error);
    return { ok: true, data: ((data ?? []) as Array<Record<string, unknown>>).map(mapSupabaseUser) };
  },
  async update(actor, userId, input) {
    if (!admin(actor)) return fail("FORBIDDEN", "Only administrators can update user accounts.");
    const fieldErrors = validate(input); if (Object.keys(fieldErrors).length) return fail("VALIDATION_ERROR", "Check the highlighted fields and try again.", fieldErrors);
    if (userId === actor.id && (input.role !== actor.role || input.accountStatus !== (actor.accountStatus ?? "active"))) return fail("CONFLICT", "You cannot change your own role or account status from this screen.");
    const supabase = getSupabaseBrowserClient(); if (!supabase) return fail("INTERNAL_ERROR", "Supabase is not configured.");
    const { data, error } = await supabase.rpc("admin_update_user", { p_profile_id: userId, p_display_name: input.displayName.trim(), p_phone: input.phone.trim() || null, p_role: input.role, p_account_status: input.accountStatus });
    if (error) return supabaseError(error);
    const rows = (data ?? []) as Array<Record<string, unknown>>;
    if (!rows[0]) return fail("NOT_FOUND", "User not found.");
    return { ok: true, data: mapSupabaseUser(rows[0]) };
  },
};

function mapSupabaseUser(row: Record<string, unknown>): ManageUser {
  return { id: String(row.id), displayName: String(row.display_name ?? ""), email: typeof row.email === "string" ? row.email : null, phone: typeof row.phone === "string" ? row.phone : null, role: row.role as UserRole, accountStatus: row.account_status as AccountStatus, agentCode: typeof row.agent_code === "string" ? row.agent_code : null, lastActiveAt: typeof row.last_active_at === "string" ? row.last_active_at : null, createdAt: String(row.created_at) };
}

export function resetMockUsers() { users = structuredClone(mockUsers); }

export const userRepository: UserRepository = isSupabaseConfigured() ? supabaseUserRepository : mockUserRepository;
