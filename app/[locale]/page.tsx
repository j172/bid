import { getTranslations } from "next-intl/server";
import { getDb } from "@/lib/db";
import { Link } from "@/i18n/navigation";

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
  const t = await getTranslations("home");
  const status = db.ok ? t("dbConnected") : t("dbFailed", { error: db.error ?? "" });

  return (
    <main>
      <section className="bg-header text-white">
        <div className="mx-auto max-w-6xl px-4 py-20 text-center sm:px-6">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">{t("title")}</h1>
          <p className="mt-4 text-lg text-gray-300">{t("subtitle")}</p>
          <Link
            href="/listings"
            className="mt-8 inline-block rounded-md bg-gold px-6 py-3 font-medium text-white hover:bg-gold-dark"
          >
            {t("browseButton")}
          </Link>
        </div>
      </section>

      <p className="mx-auto max-w-6xl px-4 py-3 text-center text-xs text-gray-400 sm:px-6">
        {t("serverStatus", { status })}
      </p>
    </main>
  );
}
