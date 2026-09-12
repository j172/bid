// issue #240: lets an admin trigger the herbots.be news sync on demand from
// app/z04urru6/news/ and see the outcome immediately, same "don't make them
// SSH in and read pm2 logs" motivation as
// app/api/admin/exchange-rates/sync/route.ts.
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/apiAuth";
import { syncHerbotsNews } from "@/lib/newsSync";

export async function POST() {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  try {
    const result = await syncHerbotsNews();
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    console.error("[newsSync] manual sync failed", error);
    const message = error instanceof Error ? error.message : "同步失敗，原因不明";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
