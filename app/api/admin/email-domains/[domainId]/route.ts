import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../../lib/server/adminAuth";
import { getSupabaseAdmin } from "../../../../../lib/server/supabaseAdmin";

export const runtime = "nodejs";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ domainId: string }> }
) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  try {
    const { domainId } = await context.params;
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from("email_domain_whitelist")
      .delete()
      .eq("id", domainId);

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Domain delete error:", error);
    return NextResponse.json({ error: "Impossible de supprimer le domaine." }, { status: 500 });
  }
}
