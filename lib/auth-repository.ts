export interface LoginInput {
  email: string;
  password: string;
  remember: boolean;
}

export type AuthResult =
  | { ok: true; message: string }
  | { ok: false; code: "NOT_CONFIGURED" | "INVALID_INPUT" | "NETWORK_ERROR"; message: string };

/** Replace this implementation with the Supabase Auth adapter when the backend is ready. */
export async function login(input: LoginInput): Promise<AuthResult> {
  if (!input.email || !input.password) {
    return { ok: false, code: "INVALID_INPUT", message: "Enter your email and password to continue." };
  }

  try {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const result = (await response.json()) as AuthResult;
    return result;
  } catch {
    return { ok: false, code: "NETWORK_ERROR", message: "We couldn’t reach the sign-in service. Try again shortly." };
  }
}
