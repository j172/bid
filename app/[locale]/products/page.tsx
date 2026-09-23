import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { listProducts } from "@/lib/products";
import { productPhotoUrl } from "@/lib/uploads";
import { excerptHtml } from "@/lib/htmlText";
import { IMAGE_FALLBACK_SRC } from "@/lib/imageFallback";
import { canonicalUrl, hreflangAlternates } from "@/lib/seo";
import { buildQuery, firstParam, type SearchParams } from "@/lib/searchParams";
import { paginate } from "@/lib/pagination";
import ProductGridCard from "../components/ProductGridCard";
import PaginationFooter from "../components/PaginationFooter";

export const dynamic = "force-dynamic";

// Same excerpt length as the homepage carousel (issue #295) — keep the
// catalog grid's snippet consistent with the carousel card it's modeled on.
const EXCERPT_LENGTH = 30;

// listProducts({ activeOnly: true }) has no DB-level pagination/search of its
// own (it's a small admin-curated catalog, unlike listings/news), so this
// page fetches the full active set and paginates the array in memory with
// the same shared lib/pagination.ts's paginate() every DB-paginated public
// list (news/pigeon-showcase) uses for its LIMIT/OFFSET arithmetic — same
// clamping behavior, just applied to Array.slice instead of SQL. 12 divides
// evenly into every grid breakpoint below (1/2/3 columns).
const PRODUCT_PAGE_SIZES = [12, 24, 48] as const;
type ProductPageSize = (typeof PRODUCT_PAGE_SIZES)[number];
const DEFAULT_PRODUCT_PAGE_SIZE: ProductPageSize = 12;
function isProductPageSize(value: number): value is ProductPageSize {
  return (PRODUCT_PAGE_SIZES as readonly number[]).includes(value);
}
const QUERY_KEYS = ["pageSize", "page"] as const;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "productsList" });
  return {
    title: t("title"),
    description: t("subtitle"),
    alternates: {
      canonical: canonicalUrl(locale, "/products"),
      languages: hreflangAlternates("/products"),
    },
  };
}

// Public /products catalog grid (issue #300) — lists every is_active=1 row
// from the admin-managed `products` CMS (issue #277/#278), ordered
// sort_order ASC, id ASC (same as the homepage carousel). Filed after #297
// (nav) and #298 (purchase flow) both turned out to already link here even
// though this list page didn't exist yet — only /products/[id] did.
// Deliberately minimal per the issue: no filtering, search, or sort-order
// toggle, just the grid + required pagination.
export default async function ProductsListPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const locale = await getLocale();
  const t = await getTranslations("productsList");

  const pageSizeRaw = Number(firstParam(params.pageSize));
  const pageSize = isProductPageSize(pageSizeRaw) ? pageSizeRaw : DEFAULT_PRODUCT_PAGE_SIZE;
  const pageRaw = Math.max(1, Number(firstParam(params.page) ?? "1") || 1);

  const activeProducts = await listProducts({ activeOnly: true });
  const total = activeProducts.length;
  const { page, offset, limit } = paginate(pageRaw, pageSize);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pageItems = activeProducts.slice(offset, offset + limit);

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-black text-ink">{t("title")}</h1>
      <p className="mt-2 text-sm text-ink-light">{t("subtitle")}</p>

      {pageItems.length === 0 ? (
        <p className="mt-10 text-ink-light">{t("noItems")}</p>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {pageItems.map((product) => {
            const cover = product.photos.find((photo) => photo.isCover) ?? product.photos[0];
            return (
              <ProductGridCard
                key={product.id}
                locale={locale}
                ctaLabel={t("viewDetails")}
                item={{
                  id: product.id,
                  title: product.title,
                  priceText: product.priceText,
                  excerpt: excerptHtml(product.description, EXCERPT_LENGTH),
                  imageUrl: cover ? productPhotoUrl(product.id, cover.fileName) : IMAGE_FALLBACK_SRC,
                }}
              />
            );
          })}
        </div>
      )}

      <PaginationFooter
        pageSizes={PRODUCT_PAGE_SIZES}
        pageSize={pageSize}
        page={page}
        totalPages={totalPages}
        pageSizeHref={(size) => `/products?${buildQuery(params, QUERY_KEYS, { pageSize: String(size), page: "1" })}`}
        pageHref={(target) => `/products?${buildQuery(params, QUERY_KEYS, { page: String(target) })}`}
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
