export const SOCIAL_LINKS = {
  facebook: "https://www.facebook.com/xiang.shui.ge.she/",
  youtube: "https://www.youtube.com/@tara-789-l5z",
  tiktok: "https://www.tiktok.com/@user2151480077563",
} as const;

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

