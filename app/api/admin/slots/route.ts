import { NextResponse } from "next/server";
import { listSlots } from "../../../../lib/server/slotData";
import { getSupabaseAdminIfConfigured } from "../../../../lib/server/supabaseAdmin";
import { createSlotFromSql, listSlotsFromSql } from "../../../../lib/server/slotSql";
import { requireAdmin } from "../../../../lib/server/adminAuth";
import { parseIsoDate } from "../../../../lib/slots/dates";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  try {
    const url = new URL(request.url);
    const start = url.searchParams.get("start");
    const end = url.searchParams.get("end");
    const supabase = getSupabaseAdminIfConfigured();
    const slots = supabase
      ? await listSlots(supabase, { start, end, admin: true })
      : await listSlotsFromSql({ start, end, admin: true });
    return NextResponse.json({ slots });
  } catch (error) {
    console.error("Admin slot list error:", error);
    return NextResponse.json({ error: "Impossible de charger les créneaux." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  try {
    const body = await request.json().catch(() => null) as {
      slotDate?: string;
      sessionId?: string | null;
      sessionName?: string;
    } | null;

    const slotDate = body?.slotDate || "";
    if (!parseIsoDate(slotDate)) {
      return NextResponse.json({ error: "Date de créneau invalide." }, { status: 400 });
    }

    const supabase = getSupabaseAdminIfConfigured();
    const sessionId = body?.sessionId || null;
    let sessionName = (body?.sessionName || "").trim();

    if (supabase && sessionId) {
      const { data: session, error: sessionError } = await supabase
        .from("sessions")
        .select("id, name")
        .eq("id", sessionId)
        .maybeSingle();

      if (sessionError) throw sessionError;
      if (!session) {
        return NextResponse.json({ error: "Séance introuvable." }, { status: 400 });
      }
      if (!sessionName) sessionName = (session as { name: string }).name;
    }

    if (!sessionName && !sessionId) {
      return NextResponse.json({ error: "Le nom de séance est obligatoire." }, { status: 400 });
    }

    if (!supabase) {
      const data = await createSlotFromSql({ slotDate, sessionId, sessionName });
      return NextResponse.json({ ok: true, id: data.id });
    }

    const { data, error } = await supabase
      .from("session_slots")
      .insert({
        slot_date: slotDate,
        session_id: sessionId,
        session_name: sessionName,
        created_by: "admin",
      })
      .select("id")
      .single();

    if (error) {
      const code = (error as { code?: string }).code;
      if (code === "23505") {
        return NextResponse.json({ error: "Un créneau existe déjà pour cette date." }, { status: 409 });
      }
      throw error;
    }

    return NextResponse.json({ ok: true, id: (data as { id: string }).id });
  } catch (error) {
    console.error("Admin slot create error:", error);
    const code = (error as { code?: string }).code;
    if (code === "23505") {
      return NextResponse.json({ error: "Un créneau existe déjà pour cette date." }, { status: 409 });
    }
    if (code === "slot_session_not_found") {
      return NextResponse.json({ error: "Séance introuvable." }, { status: 400 });
    }
    return NextResponse.json({ error: "Impossible de créer le créneau." }, { status: 500 });
  }
}
