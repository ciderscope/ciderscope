import { NextResponse } from "next/server";
import { canAccessOwner, requireAdmin } from "../../../../../lib/server/adminAuth";
import {
  deleteSessionAdmin,
  getSessionDetails,
  patchSessionAdminData,
  sessionRevision,
} from "../../../../../lib/server/sessionStore";

export const runtime = "nodejs";

type PatchPayload = {
  resultsVisible?: boolean;
  analysisSettings?: Record<string, unknown>;
};

export async function GET(
  request: Request,
  context: { params: Promise<{ sessionId: string }> }
) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;
  try {
    const { sessionId } = await context.params;
    const session = await getSessionDetails(sessionId);
    if (session && !canAccessOwner(auth.user, session.owner_id)) {
      return NextResponse.json({ error: "Séance introuvable." }, { status: 404 });
    }
    if (!session) return NextResponse.json({ error: "Séance introuvable." }, { status: 404 });
    return NextResponse.json({
      config: session.config,
      analysisSettings: session.analysis_settings || {},
      resultsVisible: Boolean(session.results_visible),
      revision: sessionRevision(session),
    });
  } catch (error) {
    console.error("Admin session detail error:", error);
    return NextResponse.json({ error: "Impossible de charger la séance." }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ sessionId: string }> }
) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;
  try {
    const { sessionId } = await context.params;
    const session = await getSessionDetails(sessionId);
    if (!session || !canAccessOwner(auth.user, session.owner_id)) {
      return NextResponse.json({ error: "Séance introuvable." }, { status: 404 });
    }
    const body = await request.json().catch(() => null) as PatchPayload | null;
    if (!body || (typeof body.resultsVisible !== "boolean" && !body.analysisSettings)) {
      return NextResponse.json({ error: "Modification invalide." }, { status: 400 });
    }
    if (body.analysisSettings && Buffer.byteLength(JSON.stringify(body.analysisSettings), "utf8") > 512_000) {
      return NextResponse.json({ error: "Paramètres d'analyse trop volumineux." }, { status: 413 });
    }
    await patchSessionAdminData(sessionId, body);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Admin session patch error:", error);
    return NextResponse.json({ error: "Impossible de modifier la séance." }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ sessionId: string }> }
) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;
  try {
    const { sessionId } = await context.params;
    const session = await getSessionDetails(sessionId);
    if (!session || !canAccessOwner(auth.user, session.owner_id)) {
      return NextResponse.json({ error: "Séance introuvable." }, { status: 404 });
    }
    await deleteSessionAdmin(sessionId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Admin session delete error:", error);
    return NextResponse.json({ error: "Impossible de supprimer la séance." }, { status: 500 });
  }
}
