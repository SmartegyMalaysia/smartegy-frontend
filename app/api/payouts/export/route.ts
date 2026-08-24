import { NextRequest, NextResponse } from "next/server";
import { serializeCsv } from "@/lib/csv";
import { serverSupabase } from "../../exports/_lib";

function money(value: unknown) { return Number(value ?? 0).toFixed(2); }

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const month = params.get("month") ?? "";
  const view = params.get("view") === "transactions" ? "transactions" : "agents";
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return NextResponse.json({ message: "Use a payout month in YYYY-MM format." }, { status: 400 });
  const { supabase, cookiesToSet, error: authError } = await serverSupabase(request);
  if (authError) return authError;
  const query = {
    p_payment_period: `${month}-01`,
    p_search: params.get("search")?.trim() || null,
    p_agent_id: params.get("agentId") || null,
    p_settlement_status: params.get("settlementStatus") || null,
  };
  const { data, error } = view === "transactions"
    ? await supabase.rpc("get_monthly_payout_transaction_export", query)
    : await supabase.rpc("get_monthly_payout_export", { p_payment_period: `${month}-01` });
  if (error) return NextResponse.json({ message: error.code === "42501" ? "You do not have permission to export payouts." : "Unable to export payout data." }, { status: error.code === "42501" ? 403 : 500 });

  const rows = view === "transactions"
    ? [
      ["Agent", "Agent ID", "Agent Code", "Bank", "Account Holder", "Account Number", "Payout Month", "Case", "Customer", "Amount", "Settlement", "Paid At", "Bank Reference"],
      ...(data ?? []).map((row: any) => [row.agent_name, row.agent_id, row.agent_code, row.bank_name, row.account_holder_name, row.account_number_masked, row.payout_month, row.case_number, row.customer_name, money(row.amount), row.status === "paid" ? "settled" : "pending", row.paid_at, row.bank_reference]),
    ]
    : [
      ["Agent", "Agent ID", "Agent Code", "Bank", "Account Holder", "Account Number", "Payout Month", "Total Payout", "Pending Amount", "Settled Amount", "Transaction Count", "Settlement Status"],
      ...(data ?? []).map((row: any) => [row.agent_name, row.agent_id, row.agent_code, row.bank_name, row.account_holder_name, row.account_number, row.payout_month, money(row.total_amount), money(row.pending_amount), money(row.settled_amount), row.transaction_count, row.settlement_status]),
    ];
  const csv = serializeCsv(rows);
  const response = new NextResponse(csv);
  cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
  response.headers.set("Content-Type", "text/csv; charset=utf-8");
  response.headers.set("Content-Disposition", `attachment; filename="smartegy-${view === "transactions" ? "payout-transactions" : "payouts"}-${month}.csv"`);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
