import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { getNewsById, listLatestNews } from "@/lib/news";
import { newsImageUrl } from "@/lib/uploads";
import { Link } from "@/i18n/navigation";
import RichTextContent from "../../../components/RichTextContent";

export const dynamic = "force-dynamic";

const SIDEBAR_LATEST_LIMIT = 5;

// Layout reference: NextMerce's "blog-details-with-sidebar" (issue #56) —
// main column carries the title/published time/full content, sidebar
// carries a "最新訊息" list, same structure as
// app/[locale]/(no-loading)/pigeon-showcase/[id]/page.tsx. notFound() on a
// bad/missing id mirrors that page's own pattern (no custom not-found.tsx
// exists anywhere in this app — Next's default 404 applies).
export default async function NewsDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const newsId = Number(id);
  if (!Number.isFinite(newsId)) {
    notFound();
  }

  const item = await getNewsById(newsId);
  if (!item) {
    notFound();
  }

  const t = await getTranslations("news");
  const sidebarItems = (await listLatestNews(SIDEBAR_LATEST_LIMIT + 1)).filter((candidate) => candidate.id !== item.id).slice(0, SIDEBAR_LATEST_LIMIT);

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-light">
        <Link href="/" className="hover:text-interactive-primary">
          {t("breadcrumbHome")}
        </Link>{" "}
        /{" "}
        <Link href="/news" className="hover:text-interactive-primary">
          {t("title")}
        </Link>{" "}
        / {item.title}
      </p>

      <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-[2fr_1fr]">
        <article className="min-w-0 rounded-2xl border border-border bg-white p-6 shadow-sm sm:p-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.imageFileName ? newsImageUrl(item.imageFileName) : "/images/hero-placeholder.png"}
            alt={item.title}
            className="max-h-96 w-full rounded-xl object-cover"
          />
          <h1 className="mt-6 text-3xl font-black text-ink">{item.title}</h1>
          <p className="mt-2 text-sm font-semibold text-ink-light">{t("publishedLine", { date: item.createdAt.toLocaleString() })}</p>

          <RichTextContent html={item.content} className="mt-6 border-t border-border pt-6 leading-7 text-ink-light" />
        </article>

        <aside className="flex flex-col gap-4">
          <div className="rounded-2xl border border-border bg-white p-5 shadow-sm">
            <h2 className="text-sm font-bold uppercase tracking-wide text-ink-light">{t("sidebarLatest")}</h2>
            {sidebarItems.length === 0 ? (
              <p className="mt-3 text-sm text-ink-light">{t("noItems")}</p>
            ) : (
              <ul className="mt-3 flex flex-col gap-3">
                {sidebarItems.map((sidebarItem) => (
                  <li key={sidebarItem.id}>
                    <Link href={`/news/${sidebarItem.id}`} className="block rounded-lg p-2 transition hover:bg-surface-muted">
                      <p className="truncate text-sm font-semibold text-ink">{sidebarItem.title}</p>
                      <p className="truncate text-xs text-ink-light">{sidebarItem.createdAt.toLocaleDateString()}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <Link href="/news" className="rounded-2xl border border-border bg-white p-5 text-center text-sm font-bold text-interactive-primary shadow-sm hover:bg-surface-muted">
            {t("backToList")}
          </Link>
        </aside>
      </div>
    </main>
  );
}
