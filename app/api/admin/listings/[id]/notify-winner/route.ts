import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getWinnerNotifiedAt, getWinnerProfileForListing } from "@/lib/listings";
import { sendWinnerEmail } from "@/lib/notifications";

// Powers WinnerExpand's "重新寄送得標信" resend button (issue #48). Unlike the
// lazy-triggered notifyWinner calls in lib/listings.ts, this awaits the
// actual send (via sendWinnerEmail) so the response can report success/
// failure and the refreshed winner_notified_at for the UI to reflect
// immediately, instead of firing and forgetting.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ ok: false, error: "僅限管理員" }, { status: 403 });
  }

  const { id } = await params;
  const listingId = Number(id);
  if (!Number.isFinite(listingId)) {
    return NextResponse.json({ ok: false, error: "找不到這個商品" }, { status: 404 });
  }

  const winner = await getWinnerProfileForListing(listingId);
  if (!winner) {
    return NextResponse.json({ ok: false, error: "這個商品沒有得標者" }, { status: 404 });
  }

  const sent = await sendWinnerEmail(listingId);
  if (!sent) {
    return NextResponse.json({ ok: false, error: "寄送失敗，請稍後再試" }, { status: 502 });
  }

  const winnerNotifiedAt = await getWinnerNotifiedAt(listingId);
  return NextResponse.json({ ok: true, winnerNotifiedAt });
}
