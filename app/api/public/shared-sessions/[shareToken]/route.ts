import { NextResponse } from "next/server";
import { sanitizeParticipantConfig } from "../../../../../lib/server/sessionSecurity";
import {
  getSessionByShareToken,
  listOccupiedPostes,
} from "../../../../../lib/server/sessionStore";

export const runtime = "nodejs";

const SHARE_TOKEN_PATTERN = /^[0-9a-f]{48}$/i;

export async function GET(
  _request: Request,
  context: { params: Promise<{ shareToken: string }> }
) {
  try {
    const { shareToken } = await context.params;
    if (!SHARE_TOKEN_PATTERN.test(shareToken)) {
      return NextResponse.json({ error: "Lien de séance invalide." }, { status: 404 });
    }
    const session = await getSessionByShareToken(shareToken);
    if (!session) {
      return NextResponse.json({ error: "Séance indisponible." }, { status: 404 });
    }
    return NextResponse.json({
      session: {
        id: session.id,
        name: session.name,
        date: session.date,
        active: true,
        hasSlotSchedule: false,
        jurorCount: session.juror_count || 0,
        productCount: session.config.products?.length || 0,
        questionCount: session.config.questions?.length || 0,
        resultsVisible: Boolean(session.results_visible),
        accessMode: "link",
      },
      config: sanitizeParticipantConfig(session.config),
      takenPostes: await listOccupiedPostes(session.id),
    });
  } catch (error) {
    console.error("Shared session access error:", error);
    return NextResponse.json({ error: "Impossible de charger la séance." }, { status: 500 });
  }
}
