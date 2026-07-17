import { NextResponse } from "next/server";
import { createAdminSessionToken, isValidAdminCredentials, setAdminCookie } from "../../../../lib/server/adminAuth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { login?: string; password?: string } | null;
  const login = body?.login || "";
  const password = body?.password || "";

  if (!isValidAdminCredentials(login, password)) {
    return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  setAdminCookie(response, createAdminSessionToken(login));
  return response;
}
