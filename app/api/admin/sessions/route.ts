import { NextResponse } from "next/server";
import { canAccessOwner, requireAdmin } from "../../../../lib/server/adminAuth";
import { getSupabaseAdminIfConfigured } from "../../../../lib/server/supabaseAdmin";
import { findDuplicateSessionFromSql, hasSessionSqlConfig, upsertSessionFromSql } from "../../../../lib/server/sessionSql";
import { parseIsoDate } from "../../../../lib/slots/dates";
import { validateSession } from "../../../../lib/validation";
import type { SessionConfig, SessionListItem } from "../../../../types";
import { getSessionDetails, listSessionCatalog } from "../../../../lib/server/sessionStore";

export const runtime = "nodejs";

type SessionSavePayload = {
  id?: string;
  cfg?: SessionConfig;
  meta?: Partial<SessionListItem>;
  expectedRevision?: number;
};

const getAdminErrorDetail = (error: unknown) => {
  const typed = error as { code?: string; message?: string; details?: string; hint?: string };
  return [typed.code, typed.message, typed.details, typed.hint].filter(Boolean).join(" - ");
};

const isValidSessionId = (value: string) => /^s[0-9A-Za-z_-]+$/.test(value) || /^[0-9A-Fa-f-]{36}$/.test(value);
const normalizeSessionName = (value: string) => value.trim().toLowerCase();

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;
  try {
    return NextResponse.json({
      sessions: await listSessionCatalog({
        ownerId: auth.user.role === "superadmin" ? undefined : auth.user.entityId,
        includeShareTokens: true,
      }),
    });
  } catch (error) {
    console.error("Admin session catalog error:", error);
    return NextResponse.json({ error: "Impossible de charger les séances." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > 2_000_000) {
      return NextResponse.json({ error: "Configuration trop volumineuse." }, { status: 413 });
    }
    const body = await request.json().catch(() => null) as SessionSavePayload | null;
    const id = body?.id?.trim() || "";
    const cfg = body?.cfg;
    const meta = body?.meta || {};
    const expectedRevision = body?.expectedRevision;

    if (!id || !isValidSessionId(id)) {
      return NextResponse.json({ error: "Identifiant de seance invalide." }, { status: 400 });
    }
    if (!cfg || typeof cfg !== "object") {
      return NextResponse.json({ error: "Configuration de seance invalide." }, { status: 400 });
    }
    if (expectedRevision !== undefined && (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0)) {
      return NextResponse.json({ error: "Version de séance invalide." }, { status: 400 });
    }
    if (!parseIsoDate(cfg.date)) {
      return NextResponse.json({ error: "Date interne de seance invalide." }, { status: 400 });
    }

    const validationErrors = validateSession(cfg);
    if (validationErrors.length > 0) {
      return NextResponse.json({ error: "Configuration incomplete.", details: validationErrors }, { status: 400 });
    }

    const name = (meta.name ?? cfg.name).trim();
    const date = meta.date ?? cfg.date;
    const existingSession = await getSessionDetails(id);
    if (existingSession && !canAccessOwner(auth.user, existingSession.owner_id)) {
      return NextResponse.json({ error: "Seance introuvable." }, { status: 404 });
    }
    const ownerId = existingSession?.owner_id || auth.user.entityId;
    const ownerName = existingSession?.owner_name || auth.user.name;
    const accessMode = existingSession?.access_mode || (
      auth.user.role === "superadmin" ? "scheduled" : "link"
    );

    if (hasSessionSqlConfig()) {
      const duplicate = await findDuplicateSessionFromSql({ id, ownerId, name, date });
      if (duplicate) {
        return NextResponse.json({
          error: "Une seance existe deja avec ce nom a cette date.",
          code: "duplicate_session_name_date",
        }, { status: 409 });
      }

      const saved = await upsertSessionFromSql({
        id,
        ownerId,
        ownerName,
        accessMode,
        cfg,
        meta,
        expectedRevision,
      });
      return NextResponse.json({ ok: true, id: saved.id, revision: saved.revision });
    }

    const supabase = getSupabaseAdminIfConfigured();
    if (!supabase) {
      return NextResponse.json({
        error: "Configuration serveur Supabase manquante.",
        detail: "Ajoutez SUPABASE_SERVICE_ROLE_KEY ou DIRECT_URL/DATABASE_URL cote serveur.",
      }, { status: 500 });
    }

    const { data: sameDateSessions, error: duplicateError } = await supabase
      .from("sessions")
      .select("id, name")
      .eq("owner_id", ownerId)
      .eq("date", date);

    if (duplicateError) throw duplicateError;

    const duplicate = (sameDateSessions || []).find(session => (
      session.id !== id && normalizeSessionName(session.name || "") === normalizeSessionName(name)
    ));

    if (duplicate) {
      return NextResponse.json({
        error: "Une seance existe deja avec ce nom a cette date.",
        code: "duplicate_session_name_date",
      }, { status: 409 });
    }

    if (typeof expectedRevision === "number") {
      const { data, error } = await supabase.from("sessions")
        .update({ name, date, config: cfg })
        .eq("id", id)
        .eq("owner_id", ownerId)
        .eq("revision", expectedRevision)
        .select("revision")
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        return NextResponse.json({
          error: "Cette séance a été modifiée ailleurs.",
          code: "revision_conflict",
        }, { status: 409 });
      }
      return NextResponse.json({ ok: true, id, revision: Number(data.revision) });
    }

    const { data, error } = await supabase.from("sessions").upsert({
      id,
      owner_id: ownerId,
      owner_name: ownerName,
      access_mode: accessMode,
      name,
      date,
      active: meta.active ?? false,
      juror_count: meta.jurorCount ?? 0,
      config: cfg,
      results_visible: meta.resultsVisible ?? false,
    }).select("revision").single();
    if (error) throw error;

    return NextResponse.json({ ok: true, id, revision: Number(data.revision) });
  } catch (error) {
    console.error("Admin session save error:", error);
    const code = (error as { code?: string }).code;
    if (code === "42501") {
      return NextResponse.json({
        error: "Impossible d'enregistrer la seance.",
        detail: "RLS bloque l'ecriture dans sessions. Verifiez SUPABASE_SERVICE_ROLE_KEY ou ajoutez DIRECT_URL/DATABASE_URL cote serveur.",
      }, { status: 500 });
    }
    if (code === "23505") {
      return NextResponse.json({
        error: "Une seance existe deja avec ce nom a cette date.",
        code: "duplicate_session_name_date",
      }, { status: 409 });
    }
    if (code === "revision_conflict") {
      return NextResponse.json({
        error: "Cette séance a été modifiée ailleurs.",
        code,
      }, { status: 409 });
    }
    return NextResponse.json({
      error: "Impossible d'enregistrer la seance.",
      detail: getAdminErrorDetail(error),
    }, { status: 500 });
  }
}
