import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import {
  CLUB_AWARD_PAGE_SIZES,
  DEFAULT_CLUB_AWARD_PAGE_SIZE,
  isClubAwardPageSize,
  listAllClubAwardAlbums,
  listClubAwardAlbums,
  listClubAwardPigeons,
} from "@/lib/pigeons/clubAwardPigeons";
import { clubAwardPigeonImageUrl } from "@/lib/shared/content/uploads";
import { excerptHtml } from "@/lib/shared/content/htmlText";
import { IMAGE_FALLBACK_SRC } from "@/lib/shared/content/imageFallback";
import { canonicalUrl, hreflangAlternates } from "@/lib/shared/seo/seo";
import { buildQuery, firstParam, type SearchParams } from "@/lib/shared/api/searchParams";
import { Link } from "@/i18n/navigation";
import ContentCardGrid from "../components/ContentCardGrid";
import PaginationFooter from "../components/PaginationFooter";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "clubAwardPigeons" });
  return {
    title: t("title"),
    description: t("subtitle"),
    alternates: {
      canonical: canonicalUrl(locale, "/club-award-pigeons"),
      languages: hreflangAlternates("/club-award-pigeons"),
    },
  };
}

const LIST_EXCERPT_LENGTH = 100;
const QUERY_KEYS = ["albumId", "pageSize", "page"] as const;

export default async function ClubAwardPigeonsListPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const t = await getTranslations("clubAwardPigeons");

  const albumIdRaw = Number(firstParam(params.albumId));
  const albumId = Number.isInteger(albumIdRaw) && albumIdRaw > 0 ? albumIdRaw : undefined;
  const pageSizeRaw = Number(firstParam(params.pageSize));
  const pageSize = isClubAwardPageSize(pageSizeRaw) ? pageSizeRaw : DEFAULT_CLUB_AWARD_PAGE_SIZE;
  const page = Math.max(1, Number(firstParam(params.page) ?? "1") || 1);

  const allAlbums = await listAllClubAwardAlbums();
  const selectedAlbum = albumId !== undefined ? allAlbums.find((a) => a.id === albumId) : undefined;

  const tabClass = (active: boolean) =>
    `rounded-full px-4 py-2 text-sm font-semibold transition ${
      active ? "bg-header text-white" : "bg-surface-muted text-ink-light hover:bg-surface"
    }`;

  if (albumId === undefined) {
    const { items: albums, total } = await listClubAwardAlbums({ page, pageSize });
    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    return (
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <h1 className="text-3xl font-black text-ink">{t("title")}</h1>
        <p className="mt-2 text-sm text-ink-light">{t("subtitle")}</p>

        {allAlbums.length > 0 && (
          <div className="mt-6 flex flex-wrap gap-2">
            <Link href="/club-award-pigeons" className={tabClass(true)}>
              {t("allAlbums")}
            </Link>
            {allAlbums.map((album) => (
              <Link
                key={album.id}
                href={`/club-award-pigeons?albumId=${album.id}`}
                className={tabClass(false)}
              >
                {album.name}
              </Link>
            ))}
          </div>
        )}

        {albums.length === 0 ? (
          <p className="mt-8 text-sm text-ink-light">{t("noAlbums")}</p>
        ) : (
          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {albums.map((album) => (
              <Link
                key={album.id}
                href={`/club-award-pigeons?albumId=${album.id}`}
                className="group flex flex-col overflow-hidden rounded-xl border border-border bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={album.coverImageFileName ? clubAwardPigeonImageUrl(album.coverImageFileName) : IMAGE_FALLBACK_SRC}
                  alt={album.name}
                  className="h-44 w-full bg-slate-100 object-contain"
                />
                <div className="flex flex-1 flex-col p-5">
                  <h2 className="truncate text-lg font-bold text-ink">{album.name}</h2>
                  <p className="mt-2 text-sm text-ink-light">{t("albumCount", { count: album.pigeonCount })}</p>
                  <span className="mt-4 inline-flex items-center gap-1 pt-2 text-xs font-semibold text-interactive-primary group-hover:translate-x-0.5">
                    {t("viewAlbum")} →
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}

        <PaginationFooter
          pageSizes={CLUB_AWARD_PAGE_SIZES}
          pageSize={pageSize}
          page={page}
          totalPages={totalPages}
          pageSizeHref={(size) =>
            `/club-award-pigeons?${buildQuery(params, QUERY_KEYS, { pageSize: String(size), page: "1" })}`
          }
          pageHref={(target) => `/club-award-pigeons?${buildQuery(params, QUERY_KEYS, { page: String(target) })}`}
          labels={{
            pageSizeLabel: t("pageSizeLabel"),
            prevPage: t("prevPage"),
            nextPage: t("nextPage"),
            pageInfo: t("pageInfo", { page, totalPages, total }),
          }}
        />
      </main>
    );
  }

  const { items, total } = await listClubAwardPigeons({ albumId, page, pageSize });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pageTitle = selectedAlbum?.name ?? items[0]?.albumTitle ?? t("title");

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-black text-ink">{pageTitle}</h1>
      <p className="mt-2 text-sm text-ink-light">{t("subtitle")}</p>

      <div className="mt-6 flex flex-wrap gap-2">
        <Link href="/club-award-pigeons" className={tabClass(false)}>
          {t("allAlbums")}
        </Link>
        {allAlbums.map((album) => (
          <Link
            key={album.id}
            href={`/club-award-pigeons?albumId=${album.id}`}
            className={tabClass(album.id === albumId)}
          >
            {album.name}
          </Link>
        ))}
      </div>

      <ContentCardGrid
        items={items.map((item) => ({
          id: item.id,
          href: `/club-award-pigeons/${item.id}`,
          imageUrl: item.imageFileName ? clubAwardPigeonImageUrl(item.imageFileName) : IMAGE_FALLBACK_SRC,
          title: item.name,
          badgeLabel: item.loftTitle ?? undefined,
          excerpt: excerptHtml(item.description, LIST_EXCERPT_LENGTH),
        }))}
        emptyLabel={t("noItems")}
        viewDetailsLabel={t("viewDetails")}
      />

      <PaginationFooter
        pageSizes={CLUB_AWARD_PAGE_SIZES}
        pageSize={pageSize}
        page={page}
        totalPages={totalPages}
        pageSizeHref={(size) =>
          `/club-award-pigeons?${buildQuery(params, QUERY_KEYS, { pageSize: String(size), page: "1" })}`
        }
        pageHref={(target) => `/club-award-pigeons?${buildQuery(params, QUERY_KEYS, { page: String(target) })}`}
        labels={{
          pageSizeLabel: t("pageSizeLabel"),
          prevPage: t("prevPage"),
          nextPage: t("nextPage"),
          pageInfo: t("pageInfo", { page, totalPages, total }),
        }}
      />
    </main>
  );
}
