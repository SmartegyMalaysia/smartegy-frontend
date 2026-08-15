import { createBrowserClient } from "@supabase/ssr";
// The generated backend type lives in the BE project; the frontend keeps the
// client schema-agnostic so it can run against a deployed Supabase project
// while still sharing the same RPC/table names.
let browserClient: any = null;

export function isSupabaseConfigured() {
  return process.env.NEXT_PUBLIC_USE_MOCKS !== "true" && Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function getSupabaseBrowserClient() {
  if (!isSupabaseConfigured()) return null;
  if (!browserClient) {
    browserClient = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
  }
  return browserClient;
}

export function normalizeSupabaseError(error: { code?: string | null; message?: string | null } | null | undefined) {
  const message = error?.message ?? "The request could not be completed.";
  const code = error?.code === "42501" || /permission|forbidden|row-level security/i.test(message)
    ? "FORBIDDEN"
    : /not found|no rows/i.test(message)
      ? "NOT_FOUND"
      : /duplicate|already exists|unique/i.test(message)
        ? "DUPLICATE"
        : /required|invalid|unsupported|must be|cannot/i.test(message)
          ? "VALIDATION_ERROR"
          : "INTERNAL_ERROR";
  return { code, message } as const;
}

export type SupabaseErrorCode = ReturnType<typeof normalizeSupabaseError>["code"];
