import { NextResponse } from "next/server";
import {
  analyzeSessionMergeCompatibility,
  guessSessionProductMappings,
  transformJurorAnswersForSessionMerge,
  type SessionProductMapping,
} from "../../../../../../lib/sessionMerge";
import { requireAdmin } from "../../../../../../lib/server/adminAuth";
import {
  executeSessionMerge,
  listSessionMergeAnswerRows,
} from "../../../../../../lib/server/sessionMergeStore";
import {
  getSessionDetails,
  sessionRevision,
} from "../../../../../../lib/server/sessionStore";

export const runtime = "nodejs";

type MergePayload = {
  sourceSessionId?: string;
  mappings?: Array<{ sourceCode?: string; targetCode?: string }>;
};

const loadMergeSessions = async (
  targetSessionId: string,
  sourceSessionId: string
) => {
  const authError = await requireAdmin();
  if (authError) return authError;
  if (!sourceSessionId || sourceSessionId === targetSessionId) {
    return NextResponse.json({ error: "Séance source invalide." }, { status: 400 });
  }

  const [target, source] = await Promise.all([
    getSessionDetails(targetSessionId),
    getSessionDetails(sourceSessionId),
  ]);
  if (!target || !source) {
    return NextResponse.json({ error: "Séance introuvable." }, { status: 404 });
  }
  return { target, source };
};

const duplicateJurors = (targetNames: string[], sourceNames: string[]) => {
  const targetSet = new Set(targetNames);
  return sourceNames.filter(name => targetSet.has(name));
};

export async function GET(
  request: Request,
  context: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await context.params;
    const sourceSessionId = new URL(request.url).searchParams.get("sourceSessionId")?.trim() || "";
    const sessions = await loadMergeSessions(sessionId, sourceSessionId);
    if (sessions instanceof NextResponse) return sessions;

    const [targetAnswers, sourceAnswers] = await Promise.all([
      listSessionMergeAnswerRows(sessionId),
      listSessionMergeAnswerRows(sourceSessionId),
    ]);
    const mappings = guessSessionProductMappings(sessions.target.config, sessions.source.config);
    const compatibility = analyzeSessionMergeCompatibility(
      sessions.target.config,
      sessions.source.config,
      mappings
    );

    return NextResponse.json({
      targetConfig: sessions.target.config,
      sourceConfig: sessions.source.config,
      mappings,
      compatibility,
      targetJurorCount: targetAnswers.length,
      sourceJurorCount: sourceAnswers.length,
      duplicateJurors: duplicateJurors(
        targetAnswers.map(answer => answer.jurorName),
        sourceAnswers.map(answer => answer.jurorName)
      ),
    });
  } catch (error) {
    console.error("Admin session merge preview error:", error);
    return NextResponse.json({ error: "Impossible de préparer la fusion." }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await context.params;
    const body = await request.json().catch(() => null) as MergePayload | null;
    const sourceSessionId = body?.sourceSessionId?.trim() || "";
    if (!body || !Array.isArray(body.mappings) || body.mappings.length > 200) {
      return NextResponse.json({ error: "Correspondance des produits invalide." }, { status: 400 });
    }

    const sessions = await loadMergeSessions(sessionId, sourceSessionId);
    if (sessions instanceof NextResponse) return sessions;
    const mappings: SessionProductMapping[] = body.mappings.map(mapping => ({
      sourceCode: typeof mapping.sourceCode === "string" ? mapping.sourceCode : "",
      targetCode: typeof mapping.targetCode === "string" ? mapping.targetCode : null,
      reason: "manual",
    }));
    const compatibility = analyzeSessionMergeCompatibility(
      sessions.target.config,
      sessions.source.config,
      mappings
    );
    if (!compatibility.compatible) {
      return NextResponse.json({
        error: "La structure des deux séances n'est pas strictement identique.",
        code: "incompatible_structure",
        details: compatibility.errors,
      }, { status: 409 });
    }

    const [targetAnswers, sourceAnswers] = await Promise.all([
      listSessionMergeAnswerRows(sessionId),
      listSessionMergeAnswerRows(sourceSessionId),
    ]);
    const duplicates = duplicateJurors(
      targetAnswers.map(answer => answer.jurorName),
      sourceAnswers.map(answer => answer.jurorName)
    );
    if (duplicates.length > 0) {
      return NextResponse.json({
        error: "Des noms de jurys existent dans les deux séances.",
        code: "duplicate_jurors",
        duplicateJurors: duplicates,
      }, { status: 409 });
    }

    const transformedAnswers = sourceAnswers.map(answer => ({
      ...answer,
      data: transformJurorAnswersForSessionMerge(
        answer.data,
        sessions.source.config,
        mappings,
        compatibility.questionMappings
      ),
    }));
    const result = await executeSessionMerge({
      targetSessionId: sessionId,
      sourceSessionId,
      expectedTargetRevision: sessionRevision(sessions.target),
      expectedSourceRevision: sessionRevision(sessions.source),
      transformedAnswers,
    });
    if (!result.ok) {
      const messages: Record<string, string> = {
        session_not_found: "Une des séances n'existe plus.",
        revision_conflict: "Une séance a été modifiée pendant la préparation de la fusion.",
        source_answers_changed: "Les réponses de la séance source ont changé pendant la préparation.",
        duplicate_jurors: "Des noms de jurys existent désormais dans les deux séances.",
        invalid_answers_payload: "Les réponses transformées sont invalides.",
      };
      return NextResponse.json({
        error: messages[result.code || ""] || "La fusion n'a pas pu être terminée.",
        code: result.code || "merge_failed",
      }, { status: result.code === "session_not_found" ? 404 : 409 });
    }

    return NextResponse.json({
      ok: true,
      movedAnswers: result.movedAnswers || 0,
      movedSlots: result.movedSlots || 0,
    });
  } catch (error) {
    console.error("Admin session merge error:", error);
    return NextResponse.json({ error: "Impossible de fusionner les séances." }, { status: 500 });
  }
}
