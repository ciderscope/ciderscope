import { NextResponse } from "next/server";
import {
  createParticipantToken,
  hashParticipantToken,
  isValidJurorName,
  isValidParticipantToken,
  normalizeJurorName,
} from "../../../../../lib/server/sessionSecurity";
import {
  claimJurorIdentity,
  isParticipantSessionAccessible,
  listOccupiedPostes,
} from "../../../../../lib/server/sessionStore";

export const runtime = "nodejs";

type AccessPayload = {
  sessionId?: string;
  jurorName?: string;
  token?: string;
  shareToken?: string;
};

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null) as AccessPayload | null;
    const sessionId = body?.sessionId?.trim() || "";
    const jurorName = normalizeJurorName(body?.jurorName || "");
    const providedToken = body?.token?.trim() || "";
    const shareToken = body?.shareToken?.trim() || "";
    if (!sessionId || !isValidJurorName(jurorName) || (providedToken && !isValidParticipantToken(providedToken))) {
      return NextResponse.json({ ok: false, message: "Identification invalide." }, { status: 400 });
    }
    const accessible = await isParticipantSessionAccessible(sessionId, shareToken || undefined);
    if (!accessible) {
      return NextResponse.json({ ok: false, message: "Cette séance n'est plus disponible." }, { status: 404 });
    }

    const token = providedToken || createParticipantToken();
    const result = await claimJurorIdentity({
      sessionId,
      jurorName,
      tokenHash: hashParticipantToken(token),
      allowLinkAccess: Boolean(shareToken),
    });
    if (!result.ok) {
      const message = result.code === "identity_in_use"
        ? "Ce prénom est déjà utilisé sur un autre appareil."
        : "Cette séance n'est plus disponible.";
      return NextResponse.json({ ok: false, code: result.code, message }, { status: 409 });
    }

    return NextResponse.json({
      ok: true,
      token,
      data: result.data || {},
      revision: result.revision || 0,
      takenPostes: await listOccupiedPostes(sessionId, jurorName),
    });
  } catch (error) {
    console.error("Participant access error:", error);
    return NextResponse.json({ ok: false, message: "Identification impossible." }, { status: 500 });
  }
}
