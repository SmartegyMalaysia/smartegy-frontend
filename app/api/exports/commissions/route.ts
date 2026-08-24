import { NextRequest } from "next/server";
import { badRpc, csvResponse, serverSupabase } from "../_lib";

export async function GET(request: NextRequest) {
  const { supabase, cookiesToSet, error } = await serverSupabase(request);
  if (error) return error;
  const params = request.nextUrl.searchParams;
  const { data, error: rpcError } = await supabase.rpc("list_commission_directory", { p_search: params.get("search") || null, p_status: params.get("status") || null, p_month: params.get("month") || null, p_page: 1, p_page_size: 10000, p_sort_by: params.get("sort_by") || "updated", p_sort_direction: params.get("sort_direction") || "desc" });
  if (rpcError) return badRpc(rpcError);
  const payload = (data ?? {}) as Record<string, any>;
  const rows = [["Case", "Customer", "Entitlement", "Paid", "Remaining", "Status", "Next payout", "Updated"], ...(payload.items ?? []).map((item: any) => [item.case_number, item.customer_name, item.amount, item.status === "paid" ? item.amount : 0, item.status === "paid" ? 0 : item.amount, item.status, item.due_date, item.paid_at ?? item.due_date])];
  return csvResponse(rows, "smartegy-commissions.csv", cookiesToSet);
}
