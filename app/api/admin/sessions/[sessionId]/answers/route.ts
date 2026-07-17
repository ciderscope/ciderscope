import { NextResponse } from "next/server";
import type { JurorAnswers } from "../../../../../../types";
import { requireAdmin } from "../../../../../../lib/server/adminAuth";
import {
  isAnswerPayloadSizeValid,
  isValidJurorName,
  normalizeJurorName,
} from "../../../../../../lib/server/sessionSecurity";
import {
  deleteAdminAnswer,
  getAdminAnswers,
  acknowledgeAdminHelpRequest,
  upsertAdminAnswer,
} from "../../../../../../lib/server/sessionStore";

export const runtime = "nodejs";

type AnswerPayload = { jurorName?: string; data?: JurorAnswers; helpRequestId?: string };

const parsePayload = async (request: Request) => {
  const body = await request.json().catch(() => null) as AnswerPayload | null;
  return {
    jurorName: normalizeJurorName(body?.jurorName || ""),
    data: body?.data,
    helpRequestId: body?.helpRequestId?.trim() || "",
  };
};

export async function GET(
  _request: Request,
  context: { params: Promise<{ sessionId: string }> }
) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;
  try {
    const { sessionId } = await context.params;
    return NextResponse.json({ answers: await getAdminAnswers(sessionId) });
  } catch (error) {
    console.error("Admin answer list error:", error);
    return NextResponse.json({ error: "Impossible de charger les participants." }, { status: 500 });
  }
}

const saveAnswer = async (
  request: Request,
  context: { params: Promise<{ sessionId: string }> }
) => {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;
  try {
    const { sessionId } = await context.params;
    const { jurorName, data } = await parsePayload(request);
    if (!isValidJurorName(jurorName) || !data || !isAnswerPayloadSizeValid(data)) {
      return NextResponse.json({ error: "Réponses invalides." }, { status: 400 });
    }
    await upsertAdminAnswer(sessionId, jurorName, data);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Admin answer save error:", error);
    return NextResponse.json({ error: "Impossible d'enregistrer les réponses." }, { status: 500 });
  }
};

export const POST = saveAnswer;

export async function PATCH(
  request: Request,
  context: { params: Promise<{ sessionId: string }> }
) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;
  try {
    const { sessionId } = await context.params;
    const { jurorName, helpRequestId, data } = await parsePayload(request);
    if (helpRequestId) {
      if (!isValidJurorName(jurorName) || helpRequestId.length > 120) {
        return NextResponse.json({ error: "Demande invalide." }, { status: 400 });
      }
      const saved = await acknowledgeAdminHelpRequest(sessionId, jurorName, helpRequestId);
      return saved
        ? NextResponse.json({ ok: true })
        : NextResponse.json({ error: "Demande introuvable." }, { status: 404 });
    }
    if (!isValidJurorName(jurorName) || !data || !isAnswerPayloadSizeValid(data)) {
      return NextResponse.json({ error: "Réponses invalides." }, { status: 400 });
    }
    await upsertAdminAnswer(sessionId, jurorName, data);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Admin answer patch error:", error);
    return NextResponse.json({ error: "Impossible de modifier les réponses." }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ sessionId: string }> }
) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;
  try {
    const { sessionId } = await context.params;
    const { jurorName } = await parsePayload(request);
    if (!isValidJurorName(jurorName)) {
      return NextResponse.json({ error: "Participant invalide." }, { status: 400 });
    }
    await deleteAdminAnswer(sessionId, jurorName);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Admin answer delete error:", error);
    return NextResponse.json({ error: "Impossible de supprimer le participant." }, { status: 500 });
  }
}
