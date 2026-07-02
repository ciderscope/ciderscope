import { NextResponse } from "next/server";
import { getSupabaseAdminIfConfigured } from "../../../../lib/server/supabaseAdmin";
import {
  isValidOutlookWebhookClientState,
  processOutlookWebhookPayload,
} from "../../../../lib/server/outlookWebhook";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const url = new URL(request.url);
  const validationToken = url.searchParams.get("validationToken");
  if (validationToken) {
    return new Response(validationToken, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  const payload = await request.json().catch(() => null) as { value?: Array<{ clientState?: string }> } | null;
  const notifications = payload?.value || [];
  if (notifications.length === 0) {
    return NextResponse.json({ ok: true, received: 0 });
  }

  const hasInvalidClientState = notifications.some(notification => (
    !isValidOutlookWebhookClientState(notification.clientState)
  ));
  if (hasInvalidClientState) {
    return NextResponse.json({ ok: false, error: "Invalid clientState." }, { status: 403 });
  }

  try {
    const supabase = getSupabaseAdminIfConfigured();
    const result = await processOutlookWebhookPayload(supabase, payload || {});
    return NextResponse.json({ ok: true, ...result }, { status: 202 });
  } catch (error) {
    console.error("Outlook webhook processing error:", error);
    return NextResponse.json({ ok: false, error: "Outlook webhook processing failed." }, { status: 500 });
  }
}
