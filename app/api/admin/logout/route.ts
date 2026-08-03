import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "La déconnexion est gérée par l'application principale." },
    { status: 410 }
  );
}
