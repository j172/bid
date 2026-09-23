// issue #344: fetchYouTubeFeed() moved from the global fetch() to
// httpsRequest() (see lib/httpsRequest.ts for why), so the network layer
// under test here is @/lib/httpsRequest — mocked the same way
// lib/translate.test.ts mocks it, rather than spying on globalThis.fetch.
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  parseYouTubeRss,
  fetchYouTubeFeed,
  getSocialMediaFeed,
  SOCIAL_LINKS,
} from "./socialMedia";
import { clearMemoryCache } from "./cache";

const { httpsRequestMock } = vi.hoisted(() => ({ httpsRequestMock: vi.fn() }));

vi.mock("@/lib/httpsRequest", () => ({
  httpsRequest: httpsRequestMock,
}));

vi.mock("./homepageVideos", () => ({
  listHomepageVideos: vi.fn().mockResolvedValue([]),
}));


const SAMPLE_RSS = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns:media="http://search.yahoo.com/mrss/" xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <id>yt:video:sample12345</id>
    <yt:videoId>sample12345</yt:videoId>
    <title>測試影片標題 &quot;特選銘鴿&quot; &amp; 翔水</title>
    <published>2026-03-01T12:00:00+00:00</published>
    <media:group>
      <media:thumbnail url="https://i.ytimg.com/vi/sample12345/hqdefault.jpg" width="480" height="360"/>
    </media:group>
  </entry>
</feed>`;

describe("socialMedia", () => {
  beforeEach(() => {
    clearMemoryCache();
    vi.restoreAllMocks();
    httpsRequestMock.mockReset();
  });

  it("contains correct official social links", () => {
    expect(SOCIAL_LINKS.facebook).toBe("https://www.facebook.com/xiang.shui.ge.she/");
    expect(SOCIAL_LINKS.youtube).toBe("https://www.youtube.com/@tara-789-l5z");
    expect(SOCIAL_LINKS.tiktok).toBe("https://www.tiktok.com/@user2151480077563");
  });

  it("parses YouTube RSS XML entries into SocialItem format with entity unescaping", () => {
    const items = parseYouTubeRss(SAMPLE_RSS);
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe("yt-sample12345");
    expect(items[0].platform).toBe("youtube");
    expect(items[0].title).toBe('測試影片標題 "特選銘鴿" & 翔水');
    expect(items[0].url).toBe("https://www.youtube.com/watch?v=sample12345");
    expect(items[0].embedUrl).toBe("https://www.youtube-nocookie.com/embed/sample12345");
    expect(items[0].thumbnailUrl).toBe("https://i.ytimg.com/vi/sample12345/hqdefault.jpg");
  });

  it("deduplicates repeated RSS video IDs and caps the result at four", async () => {
    const entries = Array.from({ length: 7 }, (_, index) => `
      <entry><yt:videoId>video${index}12345</yt:videoId><title>影片 ${index}</title></entry>
    `).join("");
    const duplicate = `<entry><yt:videoId>video012345</yt:videoId><title>重複</title></entry>`;
    httpsRequestMock.mockResolvedValue({ status: 200, body: `<feed>${entries}${duplicate}</feed>` });

    const items = await fetchYouTubeFeed();

    expect(items).toHaveLength(4);
    expect(new Set(items.map((item) => item.id)).size).toBe(4);
  });

  it("falls back to fallback items if the request fails, using a 5s timeout", async () => {
    httpsRequestMock.mockRejectedValueOnce(new Error("Network offline"));
    const items = await fetchYouTubeFeed();
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((i) => i.platform === "youtube")).toBe(true);
    expect(httpsRequestMock.mock.calls[0][1]).toEqual(expect.objectContaining({ timeoutMs: 5000 }));
  });

  it("falls back to fallback items on a non-2xx response", async () => {
    httpsRequestMock.mockResolvedValueOnce({ status: 500, body: "" });
    const items = await fetchYouTubeFeed();
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((i) => i.platform === "youtube")).toBe(true);
  });

  it("getSocialMediaFeed returns combined items including YouTube, Facebook, and TikTok", async () => {
    httpsRequestMock.mockResolvedValue({ status: 200, body: SAMPLE_RSS });

    const feed = await getSocialMediaFeed();
    expect(feed.length).toBeGreaterThanOrEqual(3);
    const platforms = new Set(feed.map((i) => i.platform));
    expect(platforms.has("youtube")).toBe(true);
    expect(platforms.has("facebook")).toBe(true);
    expect(platforms.has("tiktok")).toBe(true);
  });

  it("getSocialMediaFeed prioritizes custom homepage_videos over RSS", async () => {
    httpsRequestMock.mockResolvedValue({ status: 200, body: SAMPLE_RSS });
    const { listHomepageVideos } = await import("./homepageVideos");
    vi.mocked(listHomepageVideos).mockResolvedValueOnce([
      {
        id: 10,
        title: "後台指定的第一部影片",
        youtubeUrl: "https://www.youtube.com/watch?v=customVid123",
        videoId: "customVid123",
        sortOrder: 0,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    const feed = await getSocialMediaFeed();
    const ytItem = feed.find((i) => i.platform === "youtube");
    expect(ytItem?.id).toBe("yt-customVid123");
    expect(ytItem?.title).toBe("後台指定的第一部影片");
    expect(ytItem?.thumbnailUrl).toBe("https://i.ytimg.com/vi/customVid123/hqdefault.jpg");
    expect(httpsRequestMock).toHaveBeenCalledTimes(1);
    expect(feed.find((i) => i.id === "yt-sample12345")?.platform).toBe("youtube");
    expect(feed.findIndex((i) => i.id === "yt-customVid123")).toBeLessThan(
      feed.findIndex((i) => i.id === "yt-sample12345"),
    );
  });

  it("does not use fallback videos to pad a successful but short RSS response", async () => {
    httpsRequestMock.mockResolvedValue({ status: 200, body: SAMPLE_RSS });

    const feed = await getSocialMediaFeed();
    const youtubeIds = feed.filter((item) => item.platform === "youtube").map((item) => item.id);
    expect(youtubeIds).toEqual(["yt-sample12345"]);
  });
});
