import { NextResponse } from "next/server";
import { getSupabaseAdminIfConfigured } from "../../../../lib/server/supabaseAdmin";
import { listSlots } from "../../../../lib/server/slotData";
import { listSlotsFromSql } from "../../../../lib/server/slotSql";
import { getTodayInSlotTimezone } from "../../../../lib/slots/dates";

export const runtime = "nodejs";

export async function GET() {
  try {
    const today = getTodayInSlotTimezone();
    const supabase = getSupabaseAdminIfConfigured();
    const slots = supabase
      ? await listSlots(supabase, { admin: false })
      : await listSlotsFromSql({ admin: false });

    const slottedSessionIds = new Set<string>();
    const activeSessionIds = new Set<string>();
    const slotDatesBySessionId: Record<string, string[]> = {};
    const activeSlotDateBySessionId: Record<string, string> = {};

    slots.forEach(slot => {
      if (!slot.sessionId) return;
      slottedSessionIds.add(slot.sessionId);
      slotDatesBySessionId[slot.sessionId] = [
        ...(slotDatesBySessionId[slot.sessionId] || []),
        slot.slotDate,
      ];
      if (slot.slotDate === today) {
        activeSessionIds.add(slot.sessionId);
        activeSlotDateBySessionId[slot.sessionId] = slot.slotDate;
      }
    });

    Object.values(slotDatesBySessionId).forEach(dates => dates.sort());

    return NextResponse.json({
      today,
      slottedSessionIds: Array.from(slottedSessionIds),
      activeSessionIds: Array.from(activeSessionIds),
      slotDatesBySessionId,
      activeSlotDateBySessionId,
    });
  } catch (error) {
    console.error("Public session activity error:", error);
    return NextResponse.json({ error: "Impossible de calculer l'activite des seances." }, { status: 500 });
  }
}
