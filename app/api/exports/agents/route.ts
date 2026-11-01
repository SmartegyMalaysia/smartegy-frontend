import { NextRequest } from "next/server";
import { badRpc, csvResponse, serverSupabase } from "../_lib";

function reportYear(value: string | null) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 2000 && parsed <= 2100 ? parsed : new Date().getFullYear();
}

function levelLabel(value: string | null | undefined) {
  return value?.replace("level_", "Level ") ?? "";
}

function money(value: unknown) {
  return Number(value ?? 0).toFixed(2);
}

export async function GET(request: NextRequest) {
  const { supabase, cookiesToSet, error } = await serverSupabase(request);
  if (error) return error;
  const params = request.nextUrl.searchParams;
  const year = reportYear(params.get("year"));
  const { data, error: rpcError } = await supabase.rpc("list_agent_directory", {
    p_search: params.get("search") || null,
    p_level: params.get("level") ? `level_${params.get("level")}` : null,
    p_upline_agent_id: params.get("upline_agent_id") || null,
    p_status: params.get("status") || null,
    p_qualification: params.get("qualification") || null,
    p_page: 1,
    p_page_size: 10000,
    p_year: year,
  });
  if (rpcError) return badRpc(rpcError);
  const payload = (data ?? {}) as Record<string, any>;
  const rows = [
    ["Agent", "Agent Code", "Status", "Level", "Upline", "Successful Cases", "Direct Agents", "Personal Sales", "Referral Sales", "Lifetime Commission Earned", "Annual Commission Paid", "Eligibility"],
    ...(payload.items ?? []).map((item: any) => [
      item.display_name,
      item.agent_code,
      item.status,
      levelLabel(item.current_level),
      item.upline_name ?? "",
      item.successful_case_count ?? 0,
      item.direct_agent_count ?? 0,
      money(item.personal_sales),
      money(item.referral_sales),
      money(item.commission_earned),
      money(item.annual_commission_paid),
      item.qualification?.eligible_for_promotion ? "Eligible for promotion" : "In progress",
    ]),
  ];
  return csvResponse(rows, `smartegy-agents-${year}.csv`, cookiesToSet);
}
