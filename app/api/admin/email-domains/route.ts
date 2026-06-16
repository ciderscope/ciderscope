import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../lib/server/adminAuth";
import { getSupabaseAdmin } from "../../../../lib/server/supabaseAdmin";
import { isValidDomain, normalizeDomain } from "../../../../lib/slots/validation";

export const runtime = "nodejs";

type DomainRow = {
  id: string;
  domain: string;
  created_at: string;
};

export async function GET() {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("email_domain_whitelist")
      .select("id, domain, created_at")
      .order("domain", { ascending: true });

    if (error) throw error;
    return NextResponse.json({
      domains: ((data || []) as DomainRow[]).map(row => ({
        id: row.id,
        domain: row.domain,
        createdAt: row.created_at,
      })),
    });
  } catch (error) {
    console.error("Domain list error:", error);
    return NextResponse.json({ error: "Impossible de charger les domaines." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  try {
    const body = await request.json().catch(() => null) as { domain?: string } | null;
    const domain = normalizeDomain(body?.domain || "");
    if (!isValidDomain(domain)) {
      return NextResponse.json({ error: "Domaine email invalide." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from("email_domain_whitelist")
      .insert({ domain, created_by: "admin" });

    if (error) {
      const code = (error as { code?: string }).code;
      if (code === "23505") {
        return NextResponse.json({ error: "Ce domaine est deja autorise." }, { status: 409 });
      }
      throw error;
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Domain create error:", error);
    return NextResponse.json({ error: "Impossible d'ajouter le domaine." }, { status: 500 });
  }
}
