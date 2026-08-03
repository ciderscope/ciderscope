import { NextResponse } from "next/server";
import {
  getPublicSummary,
  getSessionByShareToken,
  getSessionDetails,
} from "../../../../../../lib/server/sessionStore";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await context.params;
    const session = await getSessionDetails(sessionId);
    if (!session) {
      return NextResponse.json({ error: "Résultats indisponibles." }, { status: 404 });
    }
    if (session.access_mode === "link") {
      const shareToken = new URL(request.url).searchParams.get("share") || "";
      const sharedSession = shareToken ? await getSessionByShareToken(shareToken) : null;
      if (!sharedSession || sharedSession.id !== sessionId) {
        return NextResponse.json({ error: "Résultats indisponibles." }, { status: 404 });
      }
    }
    const summary = await getPublicSummary(sessionId);
    if (!summary) {
      return NextResponse.json({ error: "Résultats indisponibles." }, { status: 404 });
    }
    return NextResponse.json({
      config: summary.config,
      answers: summary.answers,
    });
  } catch (error) {
    console.error("Public session summary error:", error);
    return NextResponse.json({ error: "Impossible de charger les résultats." }, { status: 500 });
  }
}
