import { cachedQuery } from "./cache";
import { listHomepageVideos } from "./homepageVideos";


export const SOCIAL_LINKS = {
  facebook: "https://www.facebook.com/xiang.shui.ge.she/",
  youtube: "https://www.youtube.com/@tara-789-l5z",
  tiktok: "https://www.tiktok.com/@user2151480077563",
} as const;

export const YOUTUBE_CHANNEL_ID = "UCfgN6N-8LVPfYJqXBZ_4M_g";
export const YOUTUBE_RSS_URL = `https://www.youtube.com/feeds/videos.xml?channel_id=${YOUTUBE_CHANNEL_ID}`;

export type SocialPlatform = "youtube" | "facebook" | "tiktok";

export type SocialItem = {
  id: string;
  platform: SocialPlatform;
  title: string;
  url: string;
  thumbnailUrl: string;
  publishedAt?: string;
  embedUrl?: string;
  authorName?: string;
};

export const FALLBACK_SOCIAL_ITEMS: SocialItem[] = [
  {
    id: "yt-vy4lQXW-TLM",
    platform: "youtube",
    title: '翔水賽鴿-石君鴿舍-黃石君"石君之冠多重回血956"',
    url: "https://www.youtube.com/watch?v=vy4lQXW-TLM",
    thumbnailUrl: "https://i.ytimg.com/vi/vy4lQXW-TLM/hqdefault.jpg",
    embedUrl: "https://www.youtube-nocookie.com/embed/vy4lQXW-TLM",
    publishedAt: "2026-03-01T00:00:00Z",
    authorName: "翔水賽鴿網",
  },
  {
    id: "yt-uZujgOcOICs",
    platform: "youtube",
    title: '翔水賽鴿網 - 鑫業鴿舍-葉小金 "神斑號"("中野號")多重回血"880"',
    url: "https://www.youtube.com/watch?v=uZujgOcOICs",
    thumbnailUrl: "https://i.ytimg.com/vi/uZujgOcOICs/hqdefault.jpg",
    embedUrl: "https://www.youtube-nocookie.com/embed/uZujgOcOICs",
    publishedAt: "2026-02-20T00:00:00Z",
    authorName: "翔水賽鴿網",
  },
  {
    id: "yt-kJ0_gK3zCsM",
    platform: "youtube",
    title: "翔水賽鴿網-魔星號多重回血868 超級強豪實戰種鴿",
    url: "https://www.youtube.com/watch?v=kJ0_gK3zCsM",
    thumbnailUrl: "https://i.ytimg.com/vi/kJ0_gK3zCsM/hqdefault.jpg",
    embedUrl: "https://www.youtube-nocookie.com/embed/kJ0_gK3zCsM",
    publishedAt: "2026-02-15T00:00:00Z",
    authorName: "翔水賽鴿網",
  },
  {
    id: "fb-1",
    platform: "facebook",
    title: "翔水鴿舍官方粉絲專頁 - 最新舍內賽鴿競翔動態與血統解析",
    url: "https://www.facebook.com/xiang.shui.ge.she/",
    thumbnailUrl: "/images/logo.png",
    publishedAt: "2026-03-05T00:00:00Z",
    authorName: "翔水鴿舍",
  },
  {
    id: "tiktok-1",
    platform: "tiktok",
    title: "翔水賽鴿 TikTok 官方精選短影音 - 名家鴿舍實況與近距離賞鴿",
    url: "https://www.tiktok.com/@user2151480077563",
    thumbnailUrl: "/images/logo.png",
    publishedAt: "2026-03-04T00:00:00Z",
    authorName: "翔水賽鴿",
  },
];

export function parseYouTubeRss(xml: string): SocialItem[] {
  const entries = xml.match(/<entry>[\s\S]*?<\/entry>/g) || [];
  const items: SocialItem[] = [];

  for (const entry of entries) {
    const videoIdMatch = entry.match(/<yt:videoId>(.*?)<\/yt:videoId>/);
    const titleMatch = entry.match(/<title>(.*?)<\/title>/);
    const publishedMatch = entry.match(/<published>(.*?)<\/published>/);
    const thumbMatch = entry.match(/<media:thumbnail[^>]+url="([^"]+)"/);

    if (videoIdMatch && videoIdMatch[1]) {
      const vid = videoIdMatch[1];
      const rawTitle = titleMatch ? titleMatch[1] : `翔水賽鴿影音 ${vid}`;
      const title = rawTitle
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&#39;/g, "'");

      items.push({
        id: `yt-${vid}`,
        platform: "youtube",
        title,
        url: `https://www.youtube.com/watch?v=${vid}`,
        thumbnailUrl: thumbMatch ? thumbMatch[1] : `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`,
        embedUrl: `https://www.youtube-nocookie.com/embed/${vid}`,
        publishedAt: publishedMatch ? publishedMatch[1] : undefined,
        authorName: "翔水賽鴿網",
      });
    }
  }

  return items;
}

export async function fetchYouTubeFeed(): Promise<SocialItem[]> {
  try {
    const res = await fetch(YOUTUBE_RSS_URL, {
      next: { revalidate: 600 },
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });
    if (!res.ok) {
      console.warn(`[socialMedia] YouTube RSS returned status ${res.status}`);
      return FALLBACK_SOCIAL_ITEMS.filter((item) => item.platform === "youtube");
    }
    const xml = await res.text();
    const items = parseYouTubeRss(xml);
    return items.length > 0 ? items : FALLBACK_SOCIAL_ITEMS.filter((item) => item.platform === "youtube");
  } catch (err) {
    console.warn("[socialMedia] Failed to fetch YouTube RSS, using fallback:", err);
    return FALLBACK_SOCIAL_ITEMS.filter((item) => item.platform === "youtube");
  }
}

export async function getSocialMediaFeed(): Promise<SocialItem[]> {
  try {
    const youtubeItems = await cachedQuery("socialMedia:youtubeFeed", 600, async () => {
      try {
        const specifiedVideos = await listHomepageVideos({ activeOnly: true });
        if (specifiedVideos.length > 0) {
          return specifiedVideos.slice(0, 6).map((v) => ({
            id: `yt-${v.videoId}`,
            platform: "youtube" as const,
            title: v.title,
            url: `https://www.youtube.com/watch?v=${v.videoId}`,
            thumbnailUrl: `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`,
            embedUrl: `https://www.youtube-nocookie.com/embed/${v.videoId}`,
            authorName: "翔水賽鴿網",
          }));
        }
      } catch (err) {
        console.warn("[socialMedia] Failed to load homepage_videos, falling back to RSS:", err);
      }
      return fetchYouTubeFeed();
    });
    const nonYoutube = FALLBACK_SOCIAL_ITEMS.filter((item) => item.platform !== "youtube");
    return [...youtubeItems.slice(0, 6), ...nonYoutube];
  } catch {
    return FALLBACK_SOCIAL_ITEMS;
  }
}

