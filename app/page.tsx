import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

async function checkDb(): Promise<{ ok: boolean; error?: string }> {
  try {
    await getDb().query("SELECT 1");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export default async function HomePage() {
  const db = await checkDb();

  return (
    <main style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: 640, margin: "0 auto" }}>
      <h1>拍賣競標網站</h1>
      <p>單一賣家英式拍賣競標網站 — 專案骨架已部署。</p>
      <ul>
        <li>App server: 運作中</li>
        <li>MySQL: {db.ok ? "已連線" : `連線失敗（${db.error}）`}</li>
      </ul>
    </main>
  );
}
