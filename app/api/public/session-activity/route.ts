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

    slots.forEach(slot => {
      if (!slot.sessionId) return;
      slottedSessionIds.add(slot.sessionId);
      if (slot.slotDate === today) activeSessionIds.add(slot.sessionId);
    });

    return NextResponse.json({
      today,
      slottedSessionIds: Array.from(slottedSessionIds),
      activeSessionIds: Array.from(activeSessionIds),
    });
  } catch (error) {
    console.error("Public session activity error:", error);
    return NextResponse.json({ error: "Impossible de calculer l'activite des seances." }, { status: 500 });
  }
}
