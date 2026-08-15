import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

type LoginBody = {
  email?: unknown;
  password?: unknown;
};

function jsonError(
  code: "NOT_CONFIGURED" | "INVALID_INPUT" | "AUTHENTICATION_FAILED" | "NETWORK_ERROR",
  message: string,
  status: number,
) {
  return NextResponse.json({ ok: false, code, message }, { status });
}

function authenticationMessage(message: string) {
  if (/invalid login credentials/i.test(message)) return "Invalid email or password.";
  if (/email not confirmed/i.test(message)) return "Confirm your email address before signing in.";
  return message || "Sign-in could not be completed.";
}

export async function POST(request: NextRequest) {
  let body: LoginBody;
  try {
    body = (await request.json()) as LoginBody;
  } catch {
    return jsonError("INVALID_INPUT", "Enter your email and password to continue.", 400);
  }

  const email = typeof body.email === "string" ? body.email.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!email || !password) {
    return jsonError("INVALID_INPUT", "Enter your email and password to continue.", 400);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return jsonError("NOT_CONFIGURED", "Supabase authentication is not configured.", 503);
  }

  // The response is created before sign-in so the Supabase SSR client can
  // attach its access/refresh-token cookies to the response.
  const response = NextResponse.json({ ok: true, message: "Signed in successfully." });
  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  try {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      return jsonError("AUTHENTICATION_FAILED", authenticationMessage(error.message), 401);
    }
    return response;
  } catch {
    return jsonError("NETWORK_ERROR", "We couldn’t reach the authentication service. Try again shortly.", 503);
  }
}
