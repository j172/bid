// issue #55: lets an admin trigger syncExchangeRates() on demand from the
// admin overview page and see the outcome immediately (success/failure +
// error text), instead of only finding out via SSH + pm2 logs after the
// scheduled 08:10 Asia/Taipei tick has already failed silently.
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/apiAuth";
import { getAllLatestStoredRates, SyncExchangeRatesError, syncExchangeRates } from "@/lib/exchangeRates";

export async function POST() {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  try {
    const result = await syncExchangeRates();
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    console.error("[exchangeRates] manual sync failed", error);

    if (error instanceof SyncExchangeRatesError) {
      return NextResponse.json(
        { ok: false, error: error.message, result: error.result },
        { status: 502 },
      );
    }

    const message = error instanceof Error ? error.message : "同步失敗，原因不明";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

// So the admin page can show current stored rates right after a sync
// without a full page reload.
export async function GET() {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const rates = await getAllLatestStoredRates();
  return NextResponse.json({ ok: true, rates });
}
