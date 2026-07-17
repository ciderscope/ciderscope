import { NextResponse } from "next/server";
import type { PosteDay } from "../../../../../types";
import {
  hashParticipantToken,
  isValidJurorName,
  isValidParticipantToken,
  normalizeJurorName,
} from "../../../../../lib/server/sessionSecurity";
import { claimParticipantPoste, listOccupiedPostes } from "../../../../../lib/server/sessionStore";
import { isPosteDay, isValidPosteNumber } from "../../../../../lib/postes";

export const runtime = "nodejs";

type PostePayload = {
  sessionId?: string;
  jurorName?: string;
  token?: string;
  revision?: number;
  day?: PosteDay;
  num?: number;
};

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null) as PostePayload | null;
    const sessionId = body?.sessionId?.trim() || "";
    const jurorName = normalizeJurorName(body?.jurorName || "");
    const token = body?.token?.trim() || "";
    const revision = body?.revision;
    const validPoste = isPosteDay(body?.day) && isValidPosteNumber(body?.num);
    if (
      !sessionId || !isValidJurorName(jurorName) || !isValidParticipantToken(token)
      || !Number.isSafeInteger(revision) || Number(revision) < 0 || !validPoste
    ) {
      return NextResponse.json({ ok: false, message: "Poste invalide." }, { status: 400 });
    }

    const result = await claimParticipantPoste({
      sessionId,
      jurorName,
      tokenHash: hashParticipantToken(token),
      poste: { day: body!.day!, num: body!.num! },
      expectedRevision: Number(revision),
    });
    if (!result.ok) {
      return NextResponse.json({
        ...result,
        message: result.code === "poste_taken" ? "Ce poste vient d'être sélectionné." : "Sélection impossible.",
        takenPostes: await listOccupiedPostes(sessionId, jurorName),
      }, { status: 409 });
    }
    return NextResponse.json({
      ...result,
      takenPostes: await listOccupiedPostes(sessionId, jurorName),
    });
  } catch (error) {
    console.error("Participant poste claim error:", error);
    return NextResponse.json({ ok: false, message: "Sélection impossible." }, { status: 500 });
  }
}
