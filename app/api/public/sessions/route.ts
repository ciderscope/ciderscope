import { NextResponse } from "next/server";
import { listSessionCatalog } from "../../../../lib/server/sessionStore";

export const runtime = "nodejs";

export async function GET() {
  try {
    const sessions = await listSessionCatalog({
      currentDayOnly: true,
      accessMode: "scheduled",
    });
    return NextResponse.json({ sessions: sessions.filter(session => session.active) });
  } catch (error) {
    console.error("Public session catalog error:", error);
    return NextResponse.json({ error: "Impossible de charger les séances." }, { status: 500 });
  }
}
