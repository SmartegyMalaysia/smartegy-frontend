import { createBrowserClient } from "@supabase/ssr";
// The generated backend type lives in the BE project; the frontend keeps the
// client schema-agnostic so it can run against a deployed Supabase project
// while still sharing the same RPC/table names.
let browserClient: any = null;

const developerViewStorageKey = "smartegy-developer-view";

export function isDeveloperPreviewEnabled() {
  return process.env.NODE_ENV !== "production"
    && process.env.NEXT_PUBLIC_ENABLE_DEVELOPER_PREVIEW === "true";
}

export function isDeveloperView() {
  if (typeof window === "undefined" || !isDeveloperPreviewEnabled()) return false;
  try {
    return window.sessionStorage.getItem(developerViewStorageKey) === "true";
  } catch {
    return false;
  }
}

export function enableDeveloperView() {
  if (typeof window === "undefined" || !isDeveloperPreviewEnabled()) return;
  try {
    window.sessionStorage.setItem(developerViewStorageKey, "true");
  } catch {
    // Preview mode is optional; continue if browser storage is unavailable.
  }
}

export function clearDeveloperView() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(developerViewStorageKey);
  } catch {
    // Nothing to clear when browser storage is unavailable.
  }
}

export function isSupabaseConfigured() {
  return !isDeveloperView() && process.env.NEXT_PUBLIC_USE_MOCKS !== "true" && Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
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
    : /duplicate|already exists|already registered|unique/i.test(message)
        ? "DUPLICATE"
        : /required|invalid|unsupported|must be|cannot/i.test(message)
          ? "VALIDATION_ERROR"
          : "INTERNAL_ERROR";
  return { code, message } as const;
}

export type SupabaseErrorCode = ReturnType<typeof normalizeSupabaseError>["code"];
