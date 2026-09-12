// issue #255: lets an admin trigger the loing-ma.com/herbots.be races sync
// (issue #241) on demand from app/z04urru6/races/, mirroring
// app/api/admin/news/sync/route.ts (issue #240) — same "don't make them SSH
// in and read pm2 logs" motivation, and syncRaces() already never throws for
// a "normal" per-source failure (see lib/racesSync.ts's header comment), so
// the try/catch here only guards against a truly unexpected crash.
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/apiAuth";
import { syncRaces } from "@/lib/racesSync";

export async function POST() {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  try {
    const result = await syncRaces();
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    console.error("[racesSync] manual sync failed", error);
    const message = error instanceof Error ? error.message : "同步失敗，原因不明";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
