import { describe, it, expect, vi } from "vitest";
import sitemap from "./sitemap";

vi.mock("@/lib/listings", () => ({
  listOpenListings: vi.fn().mockResolvedValue([
    {
      id: 10,
      title: "冠軍直子",
      created_at: new Date("2026-03-01T00:00:00.000Z"),
    },
  ]),
}));

vi.mock("@/lib/news", () => ({
  listNewsForSitemap: vi.fn().mockResolvedValue([
    {
      id: 99,
      title: "特別公告",
      createdAt: new Date("2026-03-02T00:00:00.000Z"),
      updatedAt: new Date("2026-03-02T12:00:00.000Z"),
    },
  ]),
}));

vi.mock("@/lib/homepageSections", () => ({
  listHomepageSections: vi.fn().mockResolvedValue([
    {
      id: 7,
      sectionType: "featured_loft",
      title: "翔順名家鴿舍介紹",
      imageFileName: "featured-7.jpg",
      bio: "介紹內容",
      linkedLoftId: 3,
      sortOrder: 0,
      isActive: true,
      createdAt: new Date("2026-03-03T00:00:00.000Z"),
      updatedAt: new Date("2026-03-03T12:00:00.000Z"),
    },
  ]),
}));

describe("sitemap.ts", () => {
  it("includes homepage, key pages, open listings, and published news posts across locales", async () => {
    const entries = await sitemap();

    // Key pages exist
    expect(entries.some((e) => e.url === "https://xiangshuicn.cc/")).toBe(true);
    expect(entries.some((e) => e.url === "https://xiangshuicn.cc/news")).toBe(true);

    // Listing entries exist
    expect(entries.some((e) => e.url === "https://xiangshuicn.cc/listings/10")).toBe(true);
    expect(entries.some((e) => e.url === "https://xiangshuicn.cc/zh-CN/listings/10")).toBe(true);
    expect(entries.some((e) => e.url === "https://xiangshuicn.cc/en/listings/10")).toBe(true);

    // News entries exist
    expect(entries.some((e) => e.url === "https://xiangshuicn.cc/news/99")).toBe(true);
    expect(entries.some((e) => e.url === "https://xiangshuicn.cc/zh-CN/news/99")).toBe(true);
    expect(entries.some((e) => e.url === "https://xiangshuicn.cc/en/news/99")).toBe(true);

    // News item carries lastModified from updatedAt
    const newsEntry = entries.find((e) => e.url === "https://xiangshuicn.cc/news/99");
    expect(newsEntry?.lastModified).toEqual(new Date("2026-03-02T12:00:00.000Z"));

    // Featured-loft article entries exist (issue #314)
    expect(entries.some((e) => e.url === "https://xiangshuicn.cc/featured-lofts/7")).toBe(true);
    expect(entries.some((e) => e.url === "https://xiangshuicn.cc/zh-CN/featured-lofts/7")).toBe(true);
    expect(entries.some((e) => e.url === "https://xiangshuicn.cc/en/featured-lofts/7")).toBe(true);
    const featuredLoftEntry = entries.find((e) => e.url === "https://xiangshuicn.cc/featured-lofts/7");
    expect(featuredLoftEntry?.lastModified).toEqual(new Date("2026-03-03T12:00:00.000Z"));
  });
});
