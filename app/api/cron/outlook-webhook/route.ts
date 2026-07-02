import { NextResponse } from "next/server";
import { ensureOutlookWebhookSubscription } from "../../../../lib/server/outlookWebhook";

export const runtime = "nodejs";

const unauthorized = () => NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });

const assertCronRequest = (request: Request) => {
  const secret = process.env.CRON_SECRET || "";
  if (!secret) {
    return NextResponse.json({ ok: false, error: "CRON_SECRET is required." }, { status: 500 });
  }

  const authorization = request.headers.get("authorization") || "";
  return authorization === `Bearer ${secret}` ? null : unauthorized();
};

export async function GET(request: Request) {
  const authError = assertCronRequest(request);
  if (authError) return authError;

  try {
    const result = await ensureOutlookWebhookSubscription();
    const status = result.status === "not_configured" ? 500 : 200;
    return NextResponse.json({ ok: result.status !== "not_configured", ...result }, { status });
  } catch (error) {
    console.error("Outlook webhook subscription error:", error);
    return NextResponse.json({ ok: false, error: "Outlook webhook subscription failed." }, { status: 500 });
  }
}
