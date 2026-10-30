import { listNewsForSitemap } from "@/lib/news";
import { buildNewsSitemapXml } from "@/lib/news/newsSitemapXml";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const allPosts = await listNewsForSitemap();

  // Google News guidelines suggest articles from the last 48 hours;
  // if no articles were published in 48h, include the latest up to 20 articles
  // so search engines always find recent indexed news content.
  const twoDaysAgo = Date.now() - 48 * 60 * 60 * 1000;
  const recentPosts = allPosts.filter(
    (p) => new Date(p.updatedAt ?? p.createdAt).getTime() >= twoDaysAgo,
  );
  const targetPosts = recentPosts.length > 0 ? recentPosts : allPosts.slice(0, 20);

  const xml = buildNewsSitemapXml(targetPosts);

  return new Response(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
