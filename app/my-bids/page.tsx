import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getBidHistoryForUser } from "@/lib/listings";

export const dynamic = "force-dynamic";

export default async function MyBidsPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const bids = await getBidHistoryForUser(user.id);

  return (
    <main style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: 720, margin: "0 auto" }}>
      <h1>我的出價紀錄</h1>
      {bids.length === 0 && <p>你還沒有出過價。</p>}
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: "0.5rem" }}>商品</th>
            <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: "0.5rem" }}>我的出價</th>
            <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: "0.5rem" }}>目前價格</th>
            <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: "0.5rem" }}>狀態</th>
          </tr>
        </thead>
        <tbody>
          {bids.map((bid, index) => (
            <tr key={index}>
              <td style={{ padding: "0.5rem", borderBottom: "1px solid #eee" }}>
                <a href={`/listings/${bid.listingId}`}>{bid.listingTitle}</a>
              </td>
              <td style={{ padding: "0.5rem", borderBottom: "1px solid #eee" }}>{bid.bidAmount}</td>
              <td style={{ padding: "0.5rem", borderBottom: "1px solid #eee" }}>{bid.listingCurrentPrice}</td>
              <td style={{ padding: "0.5rem", borderBottom: "1px solid #eee" }}>
                {bid.listingStatus === "open"
                  ? bid.isLeading
                    ? "競標中 — 目前領先"
                    : "競標中 — 已被超越"
                  : bid.isLeading
                    ? "已結標 — 得標"
                    : "已結標 — 未得標"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
