import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { getFeaturedLoftPostById, listLatestFeaturedLoftPosts } from "@/lib/featuredLoftPosts";
import { featuredLoftPostImageUrl } from "@/lib/uploads";
import { IMAGE_FALLBACK_SRC } from "@/lib/imageFallback";
import { Link } from "@/i18n/navigation";
import DetailWithSidebar from "../../../components/DetailWithSidebar";
import RichTextContent from "../../../components/RichTextContent";

export const dynamic = "force-dynamic";

const SIDEBAR_LATEST_LIMIT = 5;

// Layout reference: same as app/[locale]/(no-loading)/news/[id]/page.tsx
// (issue #176 models this feature on 最新訊息) — main column carries the
// title/published time/full rich-text content, sidebar carries a "名家專區"
// list. The layout itself is shared via DetailWithSidebar (issue #139 item
// 8). notFound() on a bad/missing id mirrors news/pigeon-showcase's own
// pattern (no custom not-found.tsx exists anywhere in this app — Next's
// default 404 applies).
//
// The one thing this page has that news doesn't: an optional "查看商品"
// button, shown only when the post has a loftId (see lib/featuredLoftPosts.ts
// — loft_id is nullable, unlike pigeon_showcase.loft_id), linking to that
// loft's listings the same way the old #168 homepage cards did
// (/listings?loft=<id>) — just one hop later, from the article instead of
// straight from the homepage/listings card.
export default async function FeaturedLoftPostDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const postId = Number(id);
  if (!Number.isFinite(postId)) {
    notFound();
  }

  const item = await getFeaturedLoftPostById(postId);
  if (!item) {
    notFound();
  }

  const t = await getTranslations("featuredLofts");
  const sidebarItems = (await listLatestFeaturedLoftPosts(SIDEBAR_LATEST_LIMIT + 1))
    .filter((candidate) => candidate.id !== item.id)
    .slice(0, SIDEBAR_LATEST_LIMIT);

  return (
    <DetailWithSidebar
      breadcrumb={
        <>
          <Link href="/" className="hover:text-interactive-primary">
            {t("breadcrumbHome")}
          </Link>{" "}
          /{" "}
          <Link href="/featured-lofts" className="hover:text-interactive-primary">
            {t("title")}
          </Link>{" "}
          / {item.title}
        </>
      }
      sidebarTitle={t("sidebarLatest")}
      sidebarItems={sidebarItems.map((sidebarItem) => ({
        id: sidebarItem.id,
        href: `/featured-lofts/${sidebarItem.id}`,
        primary: sidebarItem.title,
        secondary: sidebarItem.createdAt.toLocaleDateString(),
      }))}
      sidebarEmptyLabel={t("noItems")}
      backHref="/featured-lofts"
      backLabel={t("backToList")}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={item.imageFileName ? featuredLoftPostImageUrl(item.imageFileName) : IMAGE_FALLBACK_SRC}
        alt={item.title}
        className="max-h-96 w-full rounded-xl object-cover"
      />
      <h1 className="mt-6 text-3xl font-black text-ink">{item.title}</h1>
      <p className="mt-2 text-sm font-semibold text-ink-light">
        {t("publishedLine", { date: item.createdAt.toLocaleString() })}
      </p>
      <RichTextContent html={item.content} className="mt-6 border-t border-border pt-6 leading-7 text-ink-light" />
      {item.loftId !== null && (
        <Link
          href={`/listings?loft=${item.loftId}`}
          className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-header px-5 py-2 text-sm font-bold text-white transition-colors hover:bg-twilight-indigo-600"
        >
          {t("viewListingsCta")}
        </Link>
      )}
    </DetailWithSidebar>
  );
}
