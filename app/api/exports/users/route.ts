import { NextRequest } from "next/server";
import { badRpc, csvResponse, serverSupabase } from "../_lib";

export async function GET(request: NextRequest) {
  const { supabase, cookiesToSet, error } = await serverSupabase(request);
  if (error) return error;
  const params = request.nextUrl.searchParams;
  const { data, error: rpcError } = await supabase.rpc("admin_list_users", { p_search: params.get("search") || null, p_role: params.get("role") || null, p_account_status: params.get("account_status") || null, p_page: 1, p_page_size: 10000, p_sort_by: params.get("sort_by") || "display_name", p_sort_direction: params.get("sort_direction") || "asc" });
  if (rpcError) return badRpc(rpcError);
  const payload = (data ?? {}) as Record<string, any>;
  const rows = [["User", "Email", "Phone", "Role", "Account status", "Agent code", "Last active", "Created"], ...(payload.items ?? []).map((item: any) => [item.display_name, item.email, item.phone, item.role, item.account_status, item.agent_code, item.last_active_at ?? "Never", item.created_at])];
  return csvResponse(rows, "smartegy-users.csv", cookiesToSet);
}
