import { NextResponse } from "next/server";
import { getSupabaseAdminIfConfigured } from "../../../../../lib/server/supabaseAdmin";
import { isValidEmail, normalizeEmail } from "../../../../../lib/slots/validation";
import {
  consumeSlotRegistrationQuota,
  SLOT_REGISTRATION_BATCH_LIMIT,
} from "../../../../../lib/server/registrationRateLimit";
import { registerSlotWithInvitation, registrationMessageForCode } from "../../../../../lib/server/slotRegistration";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null) as { slotIds?: string[]; participantEmail?: string } | null;
    const slotIds = Array.from(new Set((body?.slotIds || []).filter(slotId => typeof slotId === "string" && slotId.trim())));
    const participantEmail = normalizeEmail(body?.participantEmail || "");
    const participantName = participantEmail;

    if (slotIds.length === 0) {
      return NextResponse.json({ ok: false, message: "Sélectionnez au moins un créneau." }, { status: 400 });
    }
    if (slotIds.length > SLOT_REGISTRATION_BATCH_LIMIT || !isValidEmail(participantEmail)) {
      return NextResponse.json({ ok: false, message: "Inscription impossible." }, { status: 400 });
    }

    const supabase = getSupabaseAdminIfConfigured();
    const allowed = await consumeSlotRegistrationQuota({
      supabase,
      participantEmail,
      requested: slotIds.length,
    });
    if (!allowed) {
      return NextResponse.json({ ok: false, message: "Inscription impossible." }, { status: 400 });
    }
    const results = [];

    for (const slotId of slotIds) {
      const { result, outlookInvitation } = await registerSlotWithInvitation({
        supabase,
        slotId,
        participantName,
        participantEmail,
      });

      if (!result.ok || !result.registration) {
        results.push({
          ok: false,
          slotId,
          code: result.code,
          message: registrationMessageForCode(result.code, result.domain),
          placesTaken: result.places_taken,
          capacity: result.capacity,
          participantName: result.participant_name,
        });
        continue;
      }

      results.push({
        ok: true,
        slotId,
        registration: {
          id: result.registration.id,
          participantName: result.registration.participant_name,
          registrationStatus: result.registration.registration_status || "confirmed",
        },
        placesTaken: result.places_taken,
        capacity: result.capacity,
        outlookInvitation: outlookInvitation ? { status: outlookInvitation.status } : null,
      });
    }

    const succeeded = results.filter(result => result.ok).length;
    const failed = results.length - succeeded;

    return NextResponse.json({
      ok: succeeded > 0 && failed === 0,
      partialOk: succeeded > 0 && failed > 0,
      succeeded,
      failed,
      results,
    }, { status: succeeded > 0 ? 200 : 400 });
  } catch (error) {
    console.error("Batch slot registration error:", error);
    return NextResponse.json({ ok: false, message: "Erreur lors de l'inscription." }, { status: 500 });
  }
}
