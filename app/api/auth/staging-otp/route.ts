import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const stagingOtp = "123456";

type StagingOtpBody = {
  email?: unknown;
  password?: unknown;
  otp?: unknown;
};

function enabled() {
  return process.env.APP_ENV === "staging" && process.env.STAGING_OTP_BYPASS === "true";
}

function errorResponse(message: string, status: number) {
  return NextResponse.json({ ok: false, message }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  if (!enabled()) return errorResponse("The staging OTP bypass is disabled.", 404);

  let body: StagingOtpBody;
  try {
    body = await request.json() as StagingOtpBody;
  } catch {
    return errorResponse("Invalid request.", 400);
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const otp = typeof body.otp === "string" ? body.otp.trim() : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return errorResponse("Enter a valid email address.", 400);
  if (password.length < 8) return errorResponse("Use at least 8 characters for the password.", 400);
  if (otp !== stagingOtp) return errorResponse("That OTP is invalid or has expired.", 400);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return errorResponse("The staging OTP bypass is not configured.", 503);

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (!created.error) return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });

  const users = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const existing = users.data.users.find((user) => user.email?.toLowerCase() === email);
  if (users.error || !existing) return errorResponse("We could not prepare the staging account. Try again.", 503);

  const updated = await admin.auth.admin.updateUserById(existing.id, { password, email_confirm: true });
  if (updated.error) return errorResponse("We could not prepare the staging account. Try again.", 503);
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
