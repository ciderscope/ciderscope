import { NextResponse } from "next/server";
import { getSupabaseAdminIfConfigured } from "../../../../lib/server/supabaseAdmin";
import { listSlots } from "../../../../lib/server/slotData";
import { listSlotsFromSql } from "../../../../lib/server/slotSql";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const start = url.searchParams.get("start");
    const end = url.searchParams.get("end");
    const supabase = getSupabaseAdminIfConfigured();
    const slots = supabase
      ? await listSlots(supabase, { start, end, admin: false })
      : await listSlotsFromSql({ start, end, admin: false });
    const publicSlots = slots.map(slot => ({
      ...slot,
      sessionId: null,
      sessionName: "",
    }));
    return NextResponse.json({ slots: publicSlots });
  } catch (error) {
    console.error("Public slot list error:", error);
    return NextResponse.json({ error: "Impossible de charger les créneaux." }, { status: 500 });
  }
}
