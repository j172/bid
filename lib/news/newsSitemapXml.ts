import { routing } from "@/i18n/routing";
import { localizedUrls } from "@/lib/shared/seo/seo";

const PUBLICATION_INFO: Record<string, { name: string; lang: string }> = {
  "zh-TW": { name: "翔水名鴿信鴿拍賣平臺", lang: "zh-tw" },
  "zh-CN": { name: "翔水名鸽信鸽拍卖平台", lang: "zh-cn" },
  en: { name: "Xiangshui Racing Pigeon Network", lang: "en" },
};

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function buildNewsSitemapXml(
  posts: Array<{ id: number; title: string; createdAt: Date; updatedAt: Date }>,
): string {
  const urlBlocks: string[] = [];

  for (const post of posts) {
    const urls = localizedUrls(`/news/${post.id}`);
    const pubDate = (post.updatedAt ?? post.createdAt).toISOString();
    const title = escapeXml(post.title);

    for (const locale of routing.locales) {
      const url = urls[locale];
      const pub = PUBLICATION_INFO[locale] ?? PUBLICATION_INFO["zh-TW"];

      urlBlocks.push(`  <url>
    <loc>${url}</loc>
    <news:news>
      <news:publication>
        <news:name>${pub.name}</news:name>
        <news:language>${pub.lang}</news:language>
      </news:publication>
      <news:publication_date>${pubDate}</news:publication_date>
      <news:title>${title}</news:title>
    </news:news>
  </url>`);
    }
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${urlBlocks.join("\n")}
</urlset>`;
}
