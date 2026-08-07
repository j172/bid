import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { getNewsById, listLatestNews } from "@/lib/news";
import { Link } from "@/i18n/navigation";

export const dynamic = "force-dynamic";

const SIDEBAR_LATEST_LIMIT = 5;

// Layout reference: NextMerce's "blog-details-with-sidebar" (issue #56) —
// main column carries the title/published time/full content, sidebar
// carries a "最新訊息" list, same structure as
// app/[locale]/pigeon-showcase/[id]/page.tsx. notFound() on a bad/missing id
// mirrors that page's own pattern (no custom not-found.tsx exists anywhere
// in this app — Next's default 404 applies).
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
          <h1 className="text-3xl font-black text-ink">{item.title}</h1>
          <p className="mt-2 text-sm font-semibold text-ink-light">{t("publishedLine", { date: item.createdAt.toLocaleString() })}</p>

          {/* content is stored pre-sanitized (lib/sanitizeDescriptionHtml.ts, applied
              by both the create and edit API routes) before ever reaching here. No
              @tailwindcss/typography plugin in this project, so rich-text tags are styled
              via explicit child selectors — same convention as
              app/[locale]/pigeon-showcase/[id]/page.tsx. */}
          <div
            className="mt-6 max-w-none border-t border-border pt-6 leading-7 text-ink-light [&_a]:text-interactive-primary [&_a]:underline [&_h2]:mt-4 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-ink [&_h3]:mt-3 [&_h3]:text-base [&_h3]:font-bold [&_h3]:text-ink [&_img]:my-2 [&_img]:max-w-full [&_img]:rounded-md [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-2 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-border [&_td]:p-2 [&_th]:border [&_th]:border-border [&_th]:p-2 [&_ul]:list-disc [&_ul]:pl-5"
            dangerouslySetInnerHTML={{ __html: item.content }}
          />
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
