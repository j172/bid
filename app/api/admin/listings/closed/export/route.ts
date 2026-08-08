import { getCurrentUser } from "@/lib/auth";
import { csvEscape } from "@/lib/csv";
import { CLOSE_REASON_LABELS, listClosedListings, type ListClosedListingsOptions } from "@/lib/listings";

function formatDate(date: Date): string {
  return new Date(date).toLocaleString("zh-TW", { hour12: false });
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return new Response("僅限管理員", { status: 403 });
  }

  const url = new URL(request.url);
  const options: ListClosedListingsOptions = {
    search: url.searchParams.get("search") ?? undefined,
    winnerEmail: url.searchParams.get("winnerEmail") ?? undefined,
    status: (url.searchParams.get("status") as ListClosedListingsOptions["status"]) ?? undefined,
    sort: (url.searchParams.get("sort") as ListClosedListingsOptions["sort"]) ?? undefined,
    all: true,
  };

  const { listings } = await listClosedListings(options);

  const header = ["商品標題", "成交價", "結標時間", "得標方式", "出價次數", "得標者", "交易狀態"];
  const lines = [header.map(csvEscape).join(",")];
  for (const listing of listings) {
    const closeReasonLabel = listing.closeReason ? CLOSE_REASON_LABELS[listing.closeReason] : "未知";
    const tradeStatus = listing.winnerEmail === null ? "無人得標" : listing.settled ? "已完成交易" : "尚未完成";
    lines.push(
      [
        listing.title,
        listing.finalPrice,
        formatDate(listing.endsAt),
        closeReasonLabel,
        listing.bidCount,
        listing.winnerEmail ?? "無人得標",
        tradeStatus,
      ]
        .map(csvEscape)
        .join(","),
    );
  }

  const csv = `﻿${lines.join("\r\n")}`;
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="closed-listings.csv"`,
    },
  });
}
