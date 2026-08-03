import { NextResponse } from "next/server";
import { authenticateRequest } from "../../../../lib/server/adminAuth";

export const runtime = "nodejs";

const handleSession = async (request: Request) => {
  const session = await authenticateRequest(request);
  if (!session) {
    return NextResponse.json({ error: "Session SSO invalide." }, { status: 401 });
  }
  return NextResponse.json(session, {
    headers: { "Cache-Control": "no-store" },
  });
};

export const GET = handleSession;
export const POST = handleSession;
