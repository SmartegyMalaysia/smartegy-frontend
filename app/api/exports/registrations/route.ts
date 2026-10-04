import { NextRequest } from "next/server";
import { badRpc, csvResponse, serverSupabase } from "../_lib";
import { formatDateTime } from "@/lib/format";

export async function GET(request: NextRequest) {
  const { supabase, cookiesToSet, error } = await serverSupabase(request);
  if (error) return error;
  const params = request.nextUrl.searchParams;
  const { data, error: rpcError } = await supabase.rpc("list_registration_directory", { p_search: params.get("search") || null, p_registration_status: params.get("registration_status") || null, p_fee_status: params.get("fee_status") || null, p_profile_complete: params.get("profile_complete") || null, p_email_verified: params.get("email_verified") || null, p_submitted_from: params.get("submitted_from") || null, p_submitted_to: params.get("submitted_to") || null, p_page: 1, p_page_size: 10000, p_sort_by: params.get("sort_by") || "priority", p_sort_direction: params.get("sort_direction") || "asc" });
  if (rpcError) return badRpc(rpcError);
  const payload = (data ?? {}) as Record<string, any>;
  const items = [...(payload.items ?? [])];
  if (params.get("sort_by") === "fee_status") {
    const direction = params.get("sort_direction") === "asc" ? 1 : -1;
    items.sort((a: any, b: any) => direction * String(a.fee_status ?? "").localeCompare(String(b.fee_status ?? "")) || String(b.updated_at ?? "").localeCompare(String(a.updated_at ?? "")) || String(a.application_number ?? "").localeCompare(String(b.application_number ?? "")));
  }
  const rows = [["Application", "Name", "Mobile", "Email", "Upline agent", "Registration", "Fee", "Profile", "Submitted"], ...items.map((item: any) => [item.application_number, item.full_name, item.mobile_number, item.email, item.referring_agent_name, item.registration_status, item.fee_status, item.profile_complete ? "Complete" : "Incomplete", item.submitted_at ? formatDateTime(item.submitted_at) : ""])];
  return csvResponse(rows, "smartegy-registrations.csv", cookiesToSet);
}
