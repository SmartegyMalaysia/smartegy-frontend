import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

export function serverSupabase(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return { error: NextResponse.json({ message: "Supabase is not configured." }, { status: 503 }) };
  const cookiesToSet: Array<{ name: string; value: string; options?: any }> = [];
  const supabase = createServerClient(url, key, { cookies: { getAll: () => request.cookies.getAll(), setAll: (cookies) => cookies.forEach((cookie) => cookiesToSet.push(cookie)) } });
  return { supabase, cookiesToSet };
}

export function csvResponse(rows: unknown[][], fileName: string, cookiesToSet: Array<{ name: string; value: string; options?: any }>) {
  const csv = rows.map((row) => row.map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`).join(",")).join("\r\n") + "\r\n";
  const response = new NextResponse(csv);
  cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
  response.headers.set("Content-Type", "text/csv; charset=utf-8");
  response.headers.set("Content-Disposition", `attachment; filename="${fileName}"`);
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export function badRpc(error: { code?: string; message?: string }) {
  return NextResponse.json({ message: error.code === "42501" ? "You do not have permission to export this data." : error.message ?? "Unable to export data." }, { status: error.code === "42501" ? 403 : 500 });
}
