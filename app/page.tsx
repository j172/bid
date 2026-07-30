import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import LogoutButton from "./LogoutButton";

export const dynamic = "force-dynamic";

async function checkDb(): Promise<{ ok: boolean; error?: string }> {
  try {
    const db = await getDb();
    await db.query("SELECT 1");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export default async function HomePage() {
  const db = await checkDb();
  const user = await getCurrentUser();

  return (
    <main style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: 640, margin: "0 auto" }}>
      <h1>拍賣競標網站</h1>
      <p>單一賣家英式拍賣競標網站 — 專案骨架已部署。</p>
      <ul>
        <li>App server: 運作中</li>
        <li>MySQL: {db.ok ? "已連線" : `連線失敗（${db.error}）`}</li>
      </ul>
      <hr />
      {user ? (
        <p>
          已登入：{user.email}（{user.role}） <LogoutButton />
        </p>
      ) : (
        <p>
          尚未登入 — <a href="/login">登入</a> / <a href="/register">註冊</a>
        </p>
      )}
      <p>
        <a href="/listings">瀏覽競標中商品</a>
        {user && (
          <>
            {" "}
            / <a href="/my-bids">我的出價紀錄</a>
          </>
        )}
        {user?.role === "admin" && (
          <>
            {" "}
            / <a href="/admin/listings/new">建立商品</a> / <a href="/admin/listings/closed">已結標結算</a>
          </>
        )}
      </p>
    </main>
  );
}
