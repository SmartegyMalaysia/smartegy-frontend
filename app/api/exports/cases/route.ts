import { NextRequest } from "next/server";
import { badRpc, csvResponse, serverSupabase } from "../_lib";

export async function GET(request: NextRequest) {
  const { supabase, cookiesToSet, error } = serverSupabase(request);
  if (error) return error;
  const params = request.nextUrl.searchParams;
  const { data, error: rpcError } = await supabase.rpc("list_case_directory", { p_search: params.get("search") || null, p_stage: params.get("stage") || null, p_payment_status: params.get("payment_status") || null, p_agent_id: params.get("agent_id") || null, p_page: 1, p_page_size: 10000, p_sort_by: params.get("sort_by") || "updated", p_sort_direction: params.get("sort_direction") || "desc" });
  if (rpcError) return badRpc(rpcError);
  const payload = (data ?? {}) as Record<string, any>;
  const rows = [["Case", "Customer", "Agent", "Amount", "Status", "Payment", "Updated"], ...(payload.items ?? []).map((item: any) => [item.case_number, item.customer_name, item.agent_name, item.sale_amount, item.status, item.payment_status, item.status_changed_at ?? item.created_at])];
  return csvResponse(rows, "smartegy-cases.csv", cookiesToSet);
}
