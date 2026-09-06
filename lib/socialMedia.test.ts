import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  parseYouTubeRss,
  fetchYouTubeFeed,
  getSocialMediaFeed,
  SOCIAL_LINKS,
} from "./socialMedia";
import { clearMemoryCache } from "./cache";

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

  it("falls back to fallback items if fetch fails", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network offline"));
    const items = await fetchYouTubeFeed();
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((i) => i.platform === "youtube")).toBe(true);
  });

  it("getSocialMediaFeed returns combined items including YouTube, Facebook, and TikTok", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      text: async () => SAMPLE_RSS,
    } as Response);

    const feed = await getSocialMediaFeed();
    expect(feed.length).toBeGreaterThanOrEqual(3);
    const platforms = new Set(feed.map((i) => i.platform));
    expect(platforms.has("youtube")).toBe(true);
    expect(platforms.has("facebook")).toBe(true);
    expect(platforms.has("tiktok")).toBe(true);
  });
});
