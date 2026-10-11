import { NextRequest } from "next/server";
import { badRpc, csvResponse, serverSupabase } from "../_lib";
import { formatDateTime } from "@/lib/format";

export async function GET(request: NextRequest) {
  const { supabase, cookiesToSet, error } = await serverSupabase(request);
  if (error) return error;
  const params = request.nextUrl.searchParams;
  const sortBy = params.get("sort_by") === "created_at" ? "created_at" : "display_name";
  const sortDirection = params.get("sort_direction") === "desc" ? "desc" : "asc";
  const { data, error: rpcError } = await supabase.rpc("admin_list_users", { p_search: params.get("search") || null, p_role: params.get("role") || null, p_account_status: params.get("account_status") || null, p_page: 1, p_page_size: 10000, p_sort_by: sortBy, p_sort_direction: sortDirection });
  if (rpcError) return badRpc(rpcError);
  const payload = (data ?? {}) as Record<string, any>;
  const direction = sortDirection === "desc" ? -1 : 1;
  const items = [...(payload.items ?? [])].sort((left: any, right: any) => {
    const comparison = sortBy === "created_at" ? String(left.created_at).localeCompare(String(right.created_at)) : String(left.display_name).localeCompare(String(right.display_name));
    return comparison ? comparison * direction : String(left.id).localeCompare(String(right.id));
  });
  const rows = [["User", "Email", "Phone", "Role", "Account status", "Agent code", "Last active", "Created"], ...items.map((item: any) => [item.display_name, item.email, item.phone, item.role, item.account_status, item.agent_code, item.last_active_at ? formatDateTime(item.last_active_at) : "Never", formatDateTime(item.created_at)])];
  return csvResponse(rows, "smartegy-users.csv", cookiesToSet);
}
