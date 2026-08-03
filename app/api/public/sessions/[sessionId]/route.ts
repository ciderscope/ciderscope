import { NextResponse } from "next/server";
import { sanitizeParticipantConfig } from "../../../../../lib/server/sessionSecurity";
import {
  getSessionDetails,
  isParticipantSessionAccessible,
  listOccupiedPostes,
} from "../../../../../lib/server/sessionStore";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await context.params;
    const shareToken = new URL(request.url).searchParams.get("share") || undefined;
    const [session, joinable] = await Promise.all([
      getSessionDetails(sessionId),
      isParticipantSessionAccessible(sessionId, shareToken),
    ]);
    if (!session || !joinable) {
      return NextResponse.json({ error: "Séance indisponible." }, { status: 404 });
    }
    return NextResponse.json({
      config: sanitizeParticipantConfig(session.config),
      takenPostes: await listOccupiedPostes(sessionId),
    });
  } catch (error) {
    console.error("Public session detail error:", error);
    return NextResponse.json({ error: "Impossible de charger la séance." }, { status: 500 });
  }
}
