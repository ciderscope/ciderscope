import { NextResponse } from "next/server";
import type { JurorAnswers } from "../../../../types";
import {
  hashParticipantToken,
  isAnswerPayloadSizeValid,
  isValidJurorName,
  isValidParticipantToken,
  normalizeJurorName,
} from "../../../../lib/server/sessionSecurity";
import { saveParticipantAnswers } from "../../../../lib/server/sessionStore";

export const runtime = "nodejs";

type SavePayload = {
  sessionId?: string;
  jurorName?: string;
  token?: string;
  revision?: number;
  data?: JurorAnswers;
};

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null) as SavePayload | null;
    const sessionId = body?.sessionId?.trim() || "";
    const jurorName = normalizeJurorName(body?.jurorName || "");
    const token = body?.token?.trim() || "";
    const revision = body?.revision;
    const data = body?.data;
    if (
      !sessionId || !isValidJurorName(jurorName) || !isValidParticipantToken(token)
      || !Number.isSafeInteger(revision) || Number(revision) < 0
      || !data || typeof data !== "object" || Array.isArray(data)
      || !isAnswerPayloadSizeValid(data)
    ) {
      return NextResponse.json({ ok: false, message: "Réponses invalides." }, { status: 400 });
    }

    const result = await saveParticipantAnswers({
      sessionId,
      jurorName,
      tokenHash: hashParticipantToken(token),
      data,
      expectedRevision: Number(revision),
    });
    if (!result.ok) {
      const status = result.code === "revision_conflict" ? 409 : 401;
      return NextResponse.json(result, { status });
    }
    return NextResponse.json(result);
  } catch (error) {
    console.error("Participant answer save error:", error);
    return NextResponse.json({ ok: false, message: "Enregistrement impossible." }, { status: 500 });
  }
}
