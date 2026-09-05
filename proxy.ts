import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

const publicPaths = new Set([
  "/",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/accept-invitation",
  "/join",
  "/api/auth/login",
  "/api/auth/forgot-password",
]);

function isPublicPath(pathname: string) {
  return publicPaths.has(pathname) || pathname.startsWith("/join/");
}

function unauthorized(request: NextRequest, response: NextResponse) {
  const nextResponse = request.nextUrl.pathname.startsWith("/api/")
    ? NextResponse.json({ message: "Authentication is required." }, { status: 401 })
    : NextResponse.redirect(new URL("/", request.url));
  response.cookies.getAll().forEach((cookie) => nextResponse.cookies.set(cookie));
  nextResponse.headers.set("Cache-Control", "private, no-store");
  return nextResponse;
}

function onboardingRequired(request: NextRequest, response: NextResponse) {
  const nextResponse = NextResponse.redirect(new URL("/onboarding/status", request.url));
  response.cookies.getAll().forEach((cookie) => nextResponse.cookies.set(cookie));
  nextResponse.headers.set("Cache-Control", "private, no-store");
  return nextResponse;
}

export async function proxy(request: NextRequest) {
  if (isPublicPath(request.nextUrl.pathname)) return NextResponse.next();

  const developerPreview = process.env.NODE_ENV !== "production"
    && process.env.NEXT_PUBLIC_ENABLE_DEVELOPER_PREVIEW === "true";
  if (developerPreview) return NextResponse.next();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  let response = NextResponse.next({ request });
  response.headers.set("Cache-Control", "private, no-store");
  if (!url || !key) return unauthorized(request, response);

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        response.headers.set("Cache-Control", "private, no-store");
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  const { data, error } = await supabase.auth.getClaims();
  if (error || typeof data?.claims?.sub !== "string") return unauthorized(request, response);

  if (request.nextUrl.pathname === "/onboarding/status") return response;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, account_status")
    .eq("id", data.claims.sub)
    .maybeSingle();

  if (profileError || !profile) return unauthorized(request, response);
  if (profile.role === "agent" && profile.account_status !== "active") {
    return onboardingRequired(request, response);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
