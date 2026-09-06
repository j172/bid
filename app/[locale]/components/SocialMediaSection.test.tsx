// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import zhTwMessages from "@/messages/zh-TW.json";
import SocialMediaSection from "./SocialMediaSection";
import type { SocialItem } from "@/lib/socialMedia";
import { SOCIAL_LINKS } from "@/lib/socialMedia";

const MOCK_ITEMS: SocialItem[] = [
  {
    id: "yt-1",
    platform: "youtube",
    title: "測試 YouTube 影片",
    url: "https://www.youtube.com/watch?v=mock1",
    thumbnailUrl: "https://example.com/yt.jpg",
    embedUrl: "https://www.youtube-nocookie.com/embed/mock1",
    authorName: "翔水賽鴿網",
  },
  {
    id: "fb-1",
    platform: "facebook",
    title: "測試 Facebook 貼文",
    url: "https://www.facebook.com/xiang.shui.ge.she/",
    thumbnailUrl: "https://example.com/fb.jpg",
    authorName: "翔水鴿舍",
  },
  {
    id: "tiktok-1",
    platform: "tiktok",
    title: "測試 TikTok 短影音",
    url: "https://www.tiktok.com/@user2151480077563",
    thumbnailUrl: "https://example.com/tiktok.jpg",
    authorName: "翔水賽鴿",
  },
];

afterEach(() => {
  cleanup();
});

function renderSection(items: SocialItem[] = MOCK_ITEMS) {
  return render(
    <NextIntlClientProvider locale="zh-TW" messages={zhTwMessages}>
      <SocialMediaSection items={items} />
    </NextIntlClientProvider>,
  );
}

describe("SocialMediaSection", () => {
  it("renders section title and official follow links", () => {
    renderSection();

    expect(screen.getByText("官方社群影音動態")).toBeTruthy();

    const ytLink = screen.getByRole("link", { name: /訂閱 YouTube/i });
    expect(ytLink.getAttribute("href")).toBe(SOCIAL_LINKS.youtube);

    const fbLink = screen.getByRole("link", { name: /追蹤 Facebook/i });
    expect(fbLink.getAttribute("href")).toBe(SOCIAL_LINKS.facebook);

    const tiktokLink = screen.getByRole("link", { name: /關注 TikTok/i });
    expect(tiktokLink.getAttribute("href")).toBe(SOCIAL_LINKS.tiktok);
  });

  it("filters items when clicking platform tabs", () => {
    renderSection();

    expect(screen.getByText("測試 YouTube 影片")).toBeTruthy();
    expect(screen.getByText("測試 Facebook 貼文")).toBeTruthy();
    expect(screen.getByText("測試 TikTok 短影音")).toBeTruthy();

    // Click YouTube tab
    fireEvent.click(screen.getByRole("button", { name: /YouTube 影音/i }));
    expect(screen.getByText("測試 YouTube 影片")).toBeTruthy();
    expect(screen.queryByText("測試 Facebook 貼文")).toBeNull();
    expect(screen.queryByText("測試 TikTok 短影音")).toBeNull();

    // Click Facebook tab
    fireEvent.click(screen.getByRole("button", { name: /Facebook 動態/i }));
    expect(screen.queryByText("測試 YouTube 影片")).toBeNull();
    expect(screen.getByText("測試 Facebook 貼文")).toBeTruthy();
    expect(screen.queryByText("測試 TikTok 短影音")).toBeNull();

    // Click All tab
    fireEvent.click(screen.getByRole("button", { name: /全部精選/i }));
    expect(screen.getByText("測試 YouTube 影片")).toBeTruthy();
    expect(screen.getByText("測試 Facebook 貼文")).toBeTruthy();
  });

  it("opens video modal when clicking play button on YouTube card", () => {
    renderSection();

    const playBtn = screen.getByRole("button", { name: /點擊播放影片: 測試 YouTube 影片/i });
    fireEvent.click(playBtn);

    const modal = screen.getByRole("dialog");
    expect(modal).toBeTruthy();

    const iframe = modal.querySelector("iframe");
    expect(iframe).toBeTruthy();
    expect(iframe?.getAttribute("src")).toContain("https://www.youtube-nocookie.com/embed/mock1");

    // Close modal
    const closeBtn = screen.getByRole("button", { name: /關閉播放器/i });
    fireEvent.click(closeBtn);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
