"use client";

import { useState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import type { SocialItem, SocialPlatform } from "@/lib/socialMediaConstants";
import { SOCIAL_LINKS } from "@/lib/socialMediaConstants";

function PlatformIcon({ platform, className = "h-4 w-4" }: { platform: SocialPlatform; className?: string }) {
  if (platform === "youtube") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
      </svg>
    );
  }
  if (platform === "facebook") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
      </svg>
    );
  }
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.24 1.07-.14 1.61.24 1.64 1.82 2.89 3.5 2.77 1.81-.03 3.33-1.47 3.48-3.27.08-1.02.05-2.04.05-3.07V.02h-.7z" />
    </svg>
  );
}

function FacebookPageEmbed({ item }: { item?: SocialItem; isVisible?: boolean }) {
  const fbUrl = item?.url || SOCIAL_LINKS.facebook;
  const title = item?.title || "翔水鴿舍官方粉絲專頁 - 最新舍內賽鴿競翔動態與血統解析";
  const author = item?.authorName || "翔水鴿舍";

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-white shadow-sm transition hover:shadow-md">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-border/60 bg-slate-50/80 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-md bg-[#1877F2] px-2 py-0.5 text-[11px] font-bold text-white shadow-sm">
            <PlatformIcon platform="facebook" className="h-3 w-3" />
            Facebook
          </span>
          <span className="text-xs font-bold text-ink">{author}</span>
        </div>
        <a
          href={fbUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-bold text-interactive-primary hover:underline"
          aria-label={`前往查看動態: ${title}`}
        >
          前往粉絲專頁 →
        </a>
      </div>

      {/* Hero Cover Banner with Avatar */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[#1877F2] via-[#0d65d9] to-slate-900 p-5 text-white">
        <div className="flex items-center gap-3.5">
          <div className="relative flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl border-2 border-white/80 bg-white shadow-md overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/logo.png" alt={author} className="h-full w-full object-cover" />
            <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#1877F2] text-white ring-2 ring-white">
              <svg className="h-2.5 w-2.5 fill-current" viewBox="0 0 20 20">
                <path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" />
              </svg>
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h4 className="truncate text-base font-black text-white">{author}</h4>
              <span className="rounded bg-white/20 px-1.5 py-0.5 text-[10px] font-bold text-white backdrop-blur-xs">
                官方交流
              </span>
            </div>
            <p className="truncate text-xs text-blue-100">@xiang.shui.ge.she</p>
          </div>
        </div>
      </div>

      {/* Main Content Body */}
      <div className="flex flex-1 flex-col justify-between p-5">
        <div>
          <h3 className="text-base font-bold leading-snug text-ink transition group-hover:text-interactive-primary">
            {title}
          </h3>

          <div className="mt-2.5 flex flex-wrap gap-1.5">
            <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-[#1877F2]">
              #海翔實戰
            </span>
            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
              #舍內名鴿培育
            </span>
            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
              #即時競拍交流
            </span>
          </div>

          <p className="mt-3 text-xs leading-relaxed text-ink-light">
            專注海翔頂級名血引進、舍內名鴿培育與賽績成果分享。歡迎賽鴿同好交流探討最新競翔動態！
          </p>

          <div className="mt-4 space-y-2 rounded-xl bg-slate-50 p-3 text-xs text-ink">
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-[#1877F2] text-[11px] font-bold">
                ✓
              </span>
              <span>舍內代表名鴿與入賞配對第一手實況紀錄</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-[#1877F2] text-[11px] font-bold">
                ✓
              </span>
              <span>頂尖速度與長距離耐翔血統深入解析</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-[#1877F2] text-[11px] font-bold">
                ✓
              </span>
              <span>勝利方程式及各大聯合拍賣即時資訊發布</span>
            </div>
          </div>
        </div>

        {/* CTA Button */}
        <div className="mt-5 pt-3 border-t border-border/60">
          <a
            href={fbUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1877F2] px-4 py-3 text-sm font-bold text-white shadow-md transition hover:bg-blue-600 hover:shadow-lg active:scale-98"
          >
            <PlatformIcon platform="facebook" className="h-4 w-4" />
            <span>前往 Facebook 查看最新舍內貼文動態 →</span>
          </a>
          <p className="mt-2 text-center text-[11px] text-ink-light">
            點擊開啟 Facebook 官方頁面瀏覽完整舍內圖文與留言互動
          </p>
        </div>
      </div>
    </article>
  );
}

function TikTokProfileEmbed({ item, isVisible }: { item?: SocialItem; isVisible: boolean }) {
  const tiktokUrl = item?.url || SOCIAL_LINKS.tiktok;
  const title = item?.title || "翔水賽鴿 TikTok 官方精選短影音 - 名家鴿舍實況與近距離賞鴿";
  const author = item?.authorName || "翔水賽鴿";
  const uniqueId = tiktokUrl.match(/@([^/?#]+)/)?.[1] || "user2151480077563";

  useEffect(() => {
    if (!isVisible) return;
    const scriptSrc = "https://www.tiktok.com/embed.js";
    let script = document.querySelector<HTMLScriptElement>(`script[src="${scriptSrc}"]`);
    if (!script) {
      script = document.createElement("script");
      script.src = scriptSrc;
      script.async = true;
      document.body.appendChild(script);
    } else {
      try {
        (window as unknown as { tiktokEmbed?: () => void }).tiktokEmbed?.();
      } catch {
        // ignore
      }
    }
  }, [isVisible]);

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-white shadow-sm transition hover:shadow-md">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-border/60 bg-slate-50/80 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-md bg-black px-2 py-0.5 text-[11px] font-bold text-white shadow-sm">
            <PlatformIcon platform="tiktok" className="h-3 w-3" />
            TikTok
          </span>
          <span className="text-xs font-bold text-ink">{author}</span>
        </div>
        <a
          href={tiktokUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-bold text-interactive-primary hover:underline"
          aria-label={`前往查看動態: ${title}`}
        >
          前往 TikTok 主頁 →
        </a>
      </div>

      {/* Title */}
      <div className="p-4 pb-2">
        <h3 className="line-clamp-2 text-sm font-bold leading-snug text-ink transition group-hover:text-interactive-primary">
          {title}
        </h3>
      </div>

      {/* Embed frame */}
      <div className="flex flex-1 items-start justify-center p-3 pt-0 sm:p-4 sm:pt-0">
        <div className="relative min-h-[500px] w-full max-w-[500px] overflow-hidden rounded-xl border border-border/80 bg-slate-50 p-2 shadow-inner">
          {isVisible ? (
            <blockquote
              className="tiktok-embed"
              cite={tiktokUrl}
              data-unique-id={uniqueId}
              data-embed-type="creator"
              style={{ maxWidth: "100%", minWidth: "288px" }}
            >
              <section className="p-4 text-center">
                <a
                  target="_blank"
                  rel="noopener noreferrer"
                  href={`${tiktokUrl}?refer=creator_embed`}
                  className="font-bold text-interactive-primary hover:underline"
                >
                  @{uniqueId}
                </a>
              </section>
            </blockquote>
          ) : (
            <div className="flex h-[500px] w-full items-center justify-center text-xs text-ink-light">
              載入 TikTok 動態中...
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

export default function SocialMediaSection({ items }: { items: SocialItem[] }) {
  const t = useTranslations("socialMedia");
  const [activeTab, setActiveTab] = useState<"all" | SocialPlatform>("all");
  const [selectedVideo, setSelectedVideo] = useState<SocialItem | null>(null);
  const [isLazyLoaded, setIsLazyLoaded] = useState(false);
  const sectionRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (typeof IntersectionObserver === "undefined") {
      setIsLazyLoaded(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setIsLazyLoaded(true);
          observer.disconnect();
        }
      },
      { rootMargin: "250px" }
    );
    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }
    return () => observer.disconnect();
  }, []);

  const handleTabChange = (tab: "all" | SocialPlatform) => {
    setActiveTab(tab);
    if (tab === "facebook" || tab === "tiktok") {
      setIsLazyLoaded(true);
    }
  };

  const youtubeItems = items.filter((item) => item.platform === "youtube");
  const fbItem = items.find((item) => item.platform === "facebook");
  const tiktokItem = items.find((item) => item.platform === "tiktok");

  const showYoutube = activeTab === "all" || activeTab === "youtube";
  const showFacebookOnly = activeTab === "facebook";
  const showTikTokOnly = activeTab === "tiktok";
  const showDualFeeds = activeTab === "all" && (fbItem || tiktokItem);

  return (
    <section ref={sectionRef} className="mx-auto mt-12 max-w-7xl px-4 sm:px-6">
      <div className="rounded-3xl border border-border bg-white p-6 shadow-sm sm:p-8">
        {/* Header and Quick Follow buttons */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-interactive-primary/10 px-3 py-1 text-xs font-bold text-interactive-primary">
              <span>ONLINE COMMUNITY</span>
            </div>
            <h2 className="mt-2 text-2xl font-black text-ink sm:text-3xl">{t("sectionTitle")}</h2>
            <p className="mt-1 text-sm text-ink-light">{t("sectionSubtitle")}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <a
              href={SOCIAL_LINKS.youtube}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full bg-red-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-red-700 active:scale-95"
            >
              <PlatformIcon platform="youtube" className="h-3.5 w-3.5" />
              <span>{t("followYoutube")}</span>
            </a>
            <a
              href={SOCIAL_LINKS.facebook}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full bg-[#1877F2] px-3.5 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-blue-700 active:scale-95"
            >
              <PlatformIcon platform="facebook" className="h-3.5 w-3.5" />
              <span>{t("followFacebook")}</span>
            </a>
            <a
              href={SOCIAL_LINKS.tiktok}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full bg-black px-3.5 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-neutral-800 active:scale-95"
            >
              <PlatformIcon platform="tiktok" className="h-3.5 w-3.5" />
              <span>{t("followTiktok")}</span>
            </a>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="mt-6 flex flex-wrap gap-2 border-b border-border pb-4">
          <button
            type="button"
            onClick={() => handleTabChange("all")}
            className={`rounded-full px-4 py-1.5 text-xs font-bold transition ${
              activeTab === "all"
                ? "bg-interactive-primary text-white shadow"
                : "bg-surface text-ink-light hover:bg-surface-subtle hover:text-ink"
            }`}
          >
            {t("tabAll")}
          </button>
          <button
            type="button"
            onClick={() => handleTabChange("youtube")}
            className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-bold transition ${
              activeTab === "youtube"
                ? "bg-red-600 text-white shadow"
                : "bg-surface text-ink-light hover:bg-surface-subtle hover:text-ink"
            }`}
          >
            <PlatformIcon platform="youtube" className="h-3 w-3" />
            <span>{t("tabYoutube")}</span>
          </button>
          <button
            type="button"
            onClick={() => handleTabChange("facebook")}
            className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-bold transition ${
              activeTab === "facebook"
                ? "bg-[#1877F2] text-white shadow"
                : "bg-surface text-ink-light hover:bg-surface-subtle hover:text-ink"
            }`}
          >
            <PlatformIcon platform="facebook" className="h-3 w-3" />
            <span>{t("tabFacebook")}</span>
          </button>
          <button
            type="button"
            onClick={() => handleTabChange("tiktok")}
            className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-bold transition ${
              activeTab === "tiktok"
                ? "bg-black text-white shadow"
                : "bg-surface text-ink-light hover:bg-surface-subtle hover:text-ink"
            }`}
          >
            <PlatformIcon platform="tiktok" className="h-3 w-3" />
            <span>{t("tabTiktok")}</span>
          </button>
        </div>

        {/* YouTube Video Grid */}
        {showYoutube && youtubeItems.length > 0 && (
          <div className="mt-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {youtubeItems.map((item) => (
                <article
                  key={item.id}
                  className="group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-md"
                >
                  {/* Thumbnail facade */}
                  <div className="relative aspect-video w-full overflow-hidden bg-slate-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.thumbnailUrl}
                      alt={item.title}
                      loading="lazy"
                      className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                    />
                    <div className="absolute left-3 top-3">
                      <span className="inline-flex items-center gap-1 rounded-md bg-red-600/90 px-2 py-0.5 text-[11px] font-bold text-white shadow backdrop-blur-sm">
                        <PlatformIcon platform="youtube" className="h-3 w-3" />
                        YouTube
                      </span>
                    </div>

                    {/* Play overlay button */}
                    {item.embedUrl ? (
                      <button
                        type="button"
                        onClick={() => setSelectedVideo(item)}
                        aria-label={`${t("watchVideo")}: ${item.title}`}
                        className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-90 transition group-hover:bg-black/40 group-hover:opacity-100"
                      >
                        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-red-600 text-white shadow-lg transition duration-200 group-hover:scale-110">
                          <svg className="h-6 w-6 fill-current pl-0.5" viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M8 5v14l11-7z" />
                          </svg>
                        </span>
                      </button>
                    ) : (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="absolute inset-0"
                        aria-label={`${t("viewPost")}: ${item.title}`}
                      />
                    )}
                  </div>

                  {/* Content body */}
                  <div className="flex flex-1 flex-col justify-between p-3.5 sm:p-4">
                    <div>
                      <h3 className="line-clamp-2 text-xs sm:text-sm font-bold leading-snug text-ink transition group-hover:text-interactive-primary">
                        {item.title}
                      </h3>
                    </div>

                    <div className="mt-2.5 flex items-center justify-between border-t border-border/60 pt-2.5 text-[11px] sm:text-xs text-ink-light">
                      <span>{item.authorName || "翔水賽鴿"}</span>
                      {item.embedUrl ? (
                        <button
                          type="button"
                          onClick={() => setSelectedVideo(item)}
                          className="font-bold text-red-600 hover:underline"
                        >
                          {t("watchVideo")} →
                        </button>
                      ) : (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-bold text-interactive-primary hover:underline"
                        >
                          {t("viewPost")} →
                        </a>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}

        {/* Dual Feeds when activeTab is "all" */}
        {showDualFeeds && (
          <div className="mt-10 border-t border-border/80 pt-8">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-ink">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>LIVE FEEDS</span>
                </div>
                <h3 className="mt-1.5 text-xl font-black text-ink">{t("liveFeedsTitle")}</h3>
                <p className="text-xs text-ink-light">{t("liveFeedsSubtitle")}</p>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
              {fbItem && <FacebookPageEmbed item={fbItem} isVisible={isLazyLoaded} />}
              {tiktokItem && <TikTokProfileEmbed item={tiktokItem} isVisible={isLazyLoaded} />}
            </div>
          </div>
        )}

        {/* Dedicated Single Platform Feed when Facebook Tab is selected */}
        {showFacebookOnly && fbItem && (
          <div className="mx-auto mt-6 max-w-2xl">
            <FacebookPageEmbed item={fbItem} isVisible={true} />
          </div>
        )}

        {/* Dedicated Single Platform Feed when TikTok Tab is selected */}
        {showTikTokOnly && tiktokItem && (
          <div className="mx-auto mt-6 max-w-2xl">
            <TikTokProfileEmbed item={tiktokItem} isVisible={true} />
          </div>
        )}
      </div>

      {/* Video Player Modal */}
      {selectedVideo && selectedVideo.embedUrl && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-fade-in"
          onClick={() => setSelectedVideo(null)}
        >
          <div
            className="relative w-full max-w-4xl overflow-hidden rounded-2xl bg-black shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-neutral-800 bg-neutral-900 px-4 py-3 text-white">
              <p className="truncate pr-4 text-sm font-bold">{selectedVideo.title}</p>
              <button
                type="button"
                onClick={() => setSelectedVideo(null)}
                className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-800 hover:text-white"
                aria-label={t("closePlayer")}
              >
                ✕
              </button>
            </div>
            <div className="relative aspect-video w-full bg-black">
              <iframe
                src={`${selectedVideo.embedUrl}?autoplay=1`}
                title={selectedVideo.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="h-full w-full border-0"
              />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
