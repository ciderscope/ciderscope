import { NextResponse } from "next/server";
import {
  processDueOutlookCancellations,
  processDueOutlookInvitations,
} from "../../../../lib/server/outlookInvitations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const isAuthorized = (request: Request) => {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";

  const auth = request.headers.get("authorization") || "";
  const url = new URL(request.url);
  return auth === `Bearer ${secret}` || url.searchParams.get("secret") === secret;
};

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized cron request." }, { status: 401 });
  }

  try {
    const invitations = await processDueOutlookInvitations();
    const cancellations = await processDueOutlookCancellations();
    return NextResponse.json({ ok: true, invitations, cancellations });
  } catch (error) {
    console.error("Outlook invitation cron error:", error);
    return NextResponse.json({ ok: false, error: "Outlook invitation cron failed." }, { status: 500 });
  }
}

export const POST = GET;
