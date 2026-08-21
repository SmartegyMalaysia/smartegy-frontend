import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

type ForgotPasswordBody = { email?: unknown };
const neutralMessage = "If an account exists for this email address, we have sent password reset instructions.";

export async function POST(request: NextRequest) {
  let body: ForgotPasswordBody;
  try { body = (await request.json()) as ForgotPasswordBody; } catch { return NextResponse.json({ ok: false, code: "INVALID_INPUT", message: "Enter a valid email address." }, { status: 400 }); }
  const email = typeof body.email === "string" ? body.email.trim() : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ ok: false, code: "INVALID_INPUT", message: "Enter a valid email address." }, { status: 400 });
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return NextResponse.json({ ok: false, code: "NETWORK_ERROR", message: "Password reset is not configured." }, { status: 503 });

  const response = NextResponse.json({ ok: true, message: neutralMessage, resetPath: "/reset-password", cooldownSeconds: 30 });
  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options)),
    },
  });
  try {
    const siteOrigin = process.env.NEXT_PUBLIC_SITE_URL ?? request.nextUrl.origin;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: new URL("/reset-password", siteOrigin).toString() });
    if (error) return NextResponse.json({ ok: false, code: "NETWORK_ERROR", message: "We could not send the password reset email. Try again shortly." }, { status: 503 });
    return response;
  } catch {
    return NextResponse.json({ ok: false, code: "NETWORK_ERROR", message: "We could not reach the authentication service. Try again shortly." }, { status: 503 });
  }
}
