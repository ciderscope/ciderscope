import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../../lib/server/adminAuth";
import { getCalendarSlot } from "../../../../../lib/server/slotData";
import { getSupabaseAdminIfConfigured } from "../../../../../lib/server/supabaseAdmin";
import { deleteSlotFromSql, getCalendarSlotFromSql } from "../../../../../lib/server/slotSql";
import { cancelWholeOutlookSlotEvent, getSlotOutlookEventId } from "../../../../../lib/server/outlookInvitations";

export const runtime = "nodejs";

type DeleteSlotRpcResult = {
  ok: boolean;
  code?: string;
  slot?: {
    id: string;
    slot_date: string;
    session_id: string | null;
    session_name: string;
  };
  registrations?: Array<{
    id: string;
    slot_id: string;
    participant_name: string;
    participant_email: string;
    cancelled_at: string;
  }>;
};

const tryCancelOutlookEvent = async (eventId: string | null, slotDate?: string | null) => {
  if (!eventId || !slotDate) return;
  try {
    await cancelWholeOutlookSlotEvent(eventId, slotDate);
  } catch (error) {
    console.error("Outlook slot event cancellation error:", error);
  }
};

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ slotId: string }> }
) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  try {
    const { slotId } = await context.params;
    const supabase = getSupabaseAdminIfConfigured();
    const slotForOutlook = supabase ? await getCalendarSlot(supabase, slotId) : await getCalendarSlotFromSql(slotId);
    const outlookEventId = await getSlotOutlookEventId(slotId, supabase);

    if (!supabase) {
      const result = await deleteSlotFromSql(slotId);
      if (!result.ok) {
        return NextResponse.json({ ok: false, code: result.code }, { status: 404 });
      }
      await tryCancelOutlookEvent(result.outlookEventId || outlookEventId, slotForOutlook?.slotDate);
      return NextResponse.json({ ok: true, cancelledCount: result.cancelledCount });
    }

    const { data, error } = await supabase.rpc("delete_session_slot", {
      p_slot_id: slotId,
      p_deleted_by: "admin",
    });

    if (error) throw error;
    const result = data as DeleteSlotRpcResult;
    if (!result.ok) {
      return NextResponse.json({ ok: false, code: result.code }, { status: 404 });
    }
    await tryCancelOutlookEvent(outlookEventId, result.slot?.slot_date || slotForOutlook?.slotDate);
    return NextResponse.json({
      ok: true,
      cancelledCount: result.registrations?.length || 0,
    });
  } catch (error) {
    console.error("Admin slot delete error:", error);
    return NextResponse.json({ ok: false, error: "Impossible de supprimer le créneau." }, { status: 500 });
  }
}
