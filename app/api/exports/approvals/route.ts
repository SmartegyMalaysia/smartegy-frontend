import { NextRequest } from "next/server";
import { badRpc, csvResponse, serverSupabase } from "../_lib";

export async function GET(request: NextRequest) {
  const { supabase, cookiesToSet, error } = serverSupabase(request);
  if (error) return error;
  const params = request.nextUrl.searchParams;
  let query = supabase.from("promotion_requests").select("id,agent_id,requested_level,status,requested_by,requested_at,review_reason,agent:agents!promotion_requests_agent_id_fkey(agent_code,legal_name,current_level)").order("requested_at", { ascending: false });
  if (params.get("status")) query = query.eq("status", params.get("status")!);
  const { data, error: queryError } = await query;
  if (queryError) return badRpc(queryError);
  const term = (params.get("search") ?? "").trim().toLowerCase();
  const type = params.get("type");
  const levelNumber = (value: unknown) => value === "level_3" ? 3 : value === "level_2" ? 2 : 1;
  const filtered = (data ?? []).filter((row: any) => {
    const current = levelNumber(row.agent?.current_level); const requested = levelNumber(row.requested_level);
    return (!term || `${row.id} ${row.agent?.legal_name ?? ""} ${row.agent?.agent_code ?? ""} ${row.requested_by}`.toLowerCase().includes(term)) && (!type || type === (requested > current ? "promotion" : "demotion"));
  });
  const rows = [["Type", "Agent", "Level Change", "Qualification", "Requested By", "Requested", "Status"], ...filtered.map((row: any) => { const current = levelNumber(row.agent?.current_level); const requested = levelNumber(row.requested_level); return [requested > current ? "Promotion" : "Demotion", row.agent?.legal_name ?? row.agent_id, `Level ${current} to Level ${requested}`, row.review_reason ?? "", row.requested_by, row.requested_at, row.status]; })];
  return csvResponse(rows, "smartegy-level-change-approvals.csv", cookiesToSet);
}
