import Link from "next/link";
import { getDb } from "@/lib/db";

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

  return (
    <main>
      <section className="bg-header text-white">
        <div className="mx-auto max-w-6xl px-4 py-20 text-center sm:px-6">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">拍賣競標網站</h1>
          <p className="mt-4 text-lg text-gray-300">單一賣家英式拍賣 — 出價、代理出價、一鍵買斷，通通支援。</p>
          <Link
            href="/listings"
            className="mt-8 inline-block rounded-md bg-gold px-6 py-3 font-medium text-white hover:bg-gold-dark"
          >
            瀏覽競標中商品
          </Link>
        </div>
      </section>

      <p className="mx-auto max-w-6xl px-4 py-3 text-center text-xs text-gray-400 sm:px-6">
        App server 運作中 · MySQL {db.ok ? "已連線" : `連線失敗（${db.error}）`}
      </p>
    </main>
  );
}
