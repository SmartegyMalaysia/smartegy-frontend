import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      code: "NOT_CONFIGURED",
      message: "Authentication is not connected yet. Supabase Auth will be wired here.",
    },
    { status: 501 },
  );
}
