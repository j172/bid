import { describe, it, expect, vi } from "vitest";
import { buildNewsSitemapXml, GET } from "./route";

vi.mock("@/lib/news", () => ({
  listNewsForSitemap: vi.fn().mockResolvedValue([
    {
      id: 1,
      title: "春季名鴿拍賣會 & 特別企劃",
      createdAt: new Date("2026-03-01T10:00:00.000Z"),
      updatedAt: new Date("2026-03-01T12:00:00.000Z"),
    },
  ]),
}));

describe("news-sitemap.xml", () => {
  it("builds valid Google News sitemap XML with publication metadata and escapes", () => {
    const xml = buildNewsSitemapXml([
      {
        id: 42,
        title: "測試標題 <特別企劃> & \"拍賣\" '快報'",
        createdAt: new Date("2026-03-01T08:00:00.000Z"),
        updatedAt: new Date("2026-03-01T09:00:00.000Z"),
      },
    ]);

    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"');
    expect(xml).toContain("<news:news>");
    expect(xml).toContain("<news:publication>");
    expect(xml).toContain("<news:name>翔水名鴿信鴿拍賣平臺</news:name>");
    expect(xml).toContain("<news:language>zh-tw</news:language>");
    expect(xml).toContain("<news:name>翔水名鸽信鸽拍卖平台</news:name>");
    expect(xml).toContain("<news:language>zh-cn</news:language>");
    expect(xml).toContain("<news:name>Xiangshui Racing Pigeon Network</news:name>");
    expect(xml).toContain("<news:language>en</news:language>");
    expect(xml).toContain("<news:publication_date>2026-03-01T09:00:00.000Z</news:publication_date>");
    // Escaped title
    expect(xml).toContain(
      "<news:title>測試標題 &lt;特別企劃&gt; &amp; &quot;拍賣&quot; &apos;快報&apos;</news:title>",
    );
    // Localized URLs
    expect(xml).toContain("/news/42");
    expect(xml).toContain("/zh-CN/news/42");
    expect(xml).toContain("/en/news/42");
  });

  it("GET handler returns 200 with XML content-type and cache headers", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/xml; charset=utf-8");
    expect(response.headers.get("Cache-Control")).toContain("public");

    const text = await response.text();
    expect(text).toContain('xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"');
    expect(text).toContain("/news/1");
  });
});
