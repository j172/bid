import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/apiAuth";
import { submitToIndexNow } from "@/lib/indexnow";
import { listOpenListings } from "@/lib/listings";
import { listNewsForSitemap } from "@/lib/news";
import { localizedUrls } from "@/lib/seo";

export const dynamic = "force-dynamic";

export async function POST() {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  // Key landing and category routes across all locales
  const keyRoutes = [
    "/",
    "/listings",
    "/news",
    "/contact",
    "/pigeon-showcase",
    "/faq",
  ];
  const urls: string[] = [];

  for (const route of keyRoutes) {
    urls.push(...Object.values(localizedUrls(route)));
  }

  // Include recent open listings (up to 30)
  const listings = await listOpenListings();
  for (const listing of listings.slice(0, 30)) {
    urls.push(...Object.values(localizedUrls(`/listings/${listing.id}`)));
  }

  // Include recent news posts (up to 30)
  const news = await listNewsForSitemap();
  for (const post of news.slice(0, 30)) {
    urls.push(...Object.values(localizedUrls(`/news/${post.id}`)));
  }

  const result = await submitToIndexNow(urls);

  return NextResponse.json({
    ok: result.ok,
    count: result.count,
    status: result.status,
    error: result.error,
  });
}
