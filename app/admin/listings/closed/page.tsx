import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getClosedListings } from "@/lib/listings";

export const dynamic = "force-dynamic";

export default async function ClosedListingsPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    redirect("/");
  }

  const listings = await getClosedListings();

  return (
    <main style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: 720, margin: "0 auto" }}>
      <h1>已結標商品結算</h1>
      {listings.length === 0 && <p>目前沒有已結標的商品。</p>}
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: "0.5rem" }}>商品</th>
            <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: "0.5rem" }}>得標者</th>
            <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: "0.5rem" }}>成交價</th>
          </tr>
        </thead>
        <tbody>
          {listings.map((listing) => (
            <tr key={listing.id}>
              <td style={{ padding: "0.5rem", borderBottom: "1px solid #eee" }}>
                <a href={`/listings/${listing.id}`}>{listing.title}</a>
              </td>
              <td style={{ padding: "0.5rem", borderBottom: "1px solid #eee" }}>
                {listing.winnerEmail ?? "無人得標"}
              </td>
              <td style={{ padding: "0.5rem", borderBottom: "1px solid #eee" }}>{listing.finalPrice}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
