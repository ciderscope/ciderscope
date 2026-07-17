import { NextResponse } from "next/server";
import { getSupabaseAdminIfConfigured } from "../../../../../../lib/server/supabaseAdmin";
import { isValidEmail, normalizeEmail } from "../../../../../../lib/slots/validation";
import { consumeSlotRegistrationQuota } from "../../../../../../lib/server/registrationRateLimit";
import { registerSlotWithInvitation, registrationMessageForCode } from "../../../../../../lib/server/slotRegistration";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ slotId: string }> }
) {
  try {
    const { slotId } = await context.params;
    const body = await request.json().catch(() => null) as { participantName?: string; participantEmail?: string } | null;
    const participantEmail = normalizeEmail(body?.participantEmail || "");
    const participantName = body?.participantName || participantEmail;
    const supabase = getSupabaseAdminIfConfigured();
    if (!isValidEmail(participantEmail)) {
      return NextResponse.json({ ok: false, message: "Inscription impossible." }, { status: 400 });
    }
    const allowed = await consumeSlotRegistrationQuota({
      supabase,
      participantEmail,
      requested: 1,
    });
    if (!allowed) {
      return NextResponse.json({ ok: false, message: "Inscription impossible." }, { status: 400 });
    }

    const { result, outlookInvitation } = await registerSlotWithInvitation({
      supabase,
      slotId,
      participantName,
      participantEmail,
    });

    if (!result.ok || !result.registration) {
      return NextResponse.json({
        ok: false,
        code: result.code,
        message: registrationMessageForCode(result.code, result.domain),
        placesTaken: result.places_taken,
        capacity: result.capacity,
        participantName: result.participant_name,
      }, { status: result.code === "already_registered" ? 409 : 400 });
    }

    return NextResponse.json({
      ok: true,
      registration: {
        id: result.registration.id,
        participantName: result.registration.participant_name,
        registrationStatus: result.registration.registration_status || "confirmed",
      },
      placesTaken: result.places_taken,
      capacity: result.capacity,
      outlookInvitation: outlookInvitation ? { status: outlookInvitation.status } : null,
    });
  } catch (error) {
    console.error("Slot registration error:", error);
    return NextResponse.json({ ok: false, message: "Erreur lors de l'inscription." }, { status: 500 });
  }
}
