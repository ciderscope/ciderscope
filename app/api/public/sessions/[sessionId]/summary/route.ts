import { NextResponse } from "next/server";
import { getPublicSummary } from "../../../../../../lib/server/sessionStore";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await context.params;
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
