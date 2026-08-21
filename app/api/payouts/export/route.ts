import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

function csvCell(value: unknown) { return `"${String(value ?? "").replaceAll('"', '""')}"`; }
function money(value: unknown) { return Number(value ?? 0).toFixed(2); }

export async function GET(request: NextRequest) {
  const month = request.nextUrl.searchParams.get("month") ?? "";
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return NextResponse.json({ message: "Use a payout month in YYYY-MM format." }, { status: 400 });
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return NextResponse.json({ message: "Supabase is not configured." }, { status: 503 });

  const cookiesToSet: Array<{ name: string; value: string; options?: any }> = [];
  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookies) => cookies.forEach((cookie) => cookiesToSet.push(cookie)),
    },
  });
  const { data, error } = await supabase.rpc("get_monthly_payout_export", { p_payment_period: `${month}-01` });
  if (error) return NextResponse.json({ message: error.code === "42501" ? "You do not have permission to export payouts." : "Unable to export payout data." }, { status: error.code === "42501" ? 403 : 500 });

  const rows = [
    ["Agent", "Agent ID", "Agent Code", "Bank", "Account Holder", "Account Number", "Payout Month", "Total Payout", "Pending Amount", "Settled Amount", "Transaction Count", "Settlement Status"],
    ...(data ?? []).map((row: any) => [row.agent_name, row.agent_id, row.agent_code, row.bank_name, row.account_holder_name, row.account_number, row.payout_month, money(row.total_amount), money(row.pending_amount), money(row.settled_amount), row.transaction_count, row.settlement_status]),
  ];
  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
  const response = new NextResponse(csv);
  cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
  response.headers.set("Content-Type", "text/csv; charset=utf-8");
  response.headers.set("Content-Disposition", `attachment; filename="smartegy-payouts-${month}.csv"`);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
