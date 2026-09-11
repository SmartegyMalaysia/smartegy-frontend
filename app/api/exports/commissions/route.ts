import { NextRequest } from "next/server";
import { badRpc, csvResponse, serverSupabase } from "../_lib";
import { aggregateCommissionRows, filterAndSortCommissionRecords, type CommissionRow } from "@/lib/commission-aggregation";

export async function GET(request: NextRequest) {
  const { supabase, cookiesToSet, error } = await serverSupabase(request);
  if (error) return error;
  const params = request.nextUrl.searchParams;
  const { data, error: queryError } = await supabase.from("agent_commission_statement").select("*").order("due_date", { ascending: true });
  if (queryError) return badRpc(queryError);
  const records = filterAndSortCommissionRecords(aggregateCommissionRows((data ?? []) as CommissionRow[]), { search: params.get("search") || undefined, status: (params.get("status") || undefined) as any, month: params.get("month") || undefined, sortBy: (params.get("sort_by") || "updated") as any, sortDirection: (params.get("sort_direction") || "desc") as any });
  const rows = [["Case", "Customer", "Entitlement", "Paid", "Remaining", "Status", "Next payout", "Updated"], ...records.map((item) => [item.caseNumber, item.customerDisplayName, item.entitlementSen / 100, item.paidToDateSen / 100, item.deferredBalanceSen / 100, item.status, item.nextPaymentDate ?? "", item.lastUpdatedAt])];
  return csvResponse(rows, "smartegy-commissions.csv", cookiesToSet);
}
