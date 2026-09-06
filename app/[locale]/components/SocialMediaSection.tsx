"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { SocialItem, SocialPlatform } from "@/lib/socialMedia";
import { SOCIAL_LINKS } from "@/lib/socialMedia";

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

export default function SocialMediaSection({ items }: { items: SocialItem[] }) {
  const t = useTranslations("socialMedia");
  const [activeTab, setActiveTab] = useState<"all" | SocialPlatform>("all");
  const [selectedVideo, setSelectedVideo] = useState<SocialItem | null>(null);

  const filteredItems = items.filter((item) => {
    if (activeTab === "all") return true;
    return item.platform === activeTab;
  });

  return (
    <section className="mx-auto mt-12 max-w-6xl px-4 sm:px-6">
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
            onClick={() => setActiveTab("all")}
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
            onClick={() => setActiveTab("youtube")}
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
            onClick={() => setActiveTab("facebook")}
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
            onClick={() => setActiveTab("tiktok")}
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

        {/* Content Cards Grid */}
        <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filteredItems.map((item) => {
            const isVideo = item.platform === "youtube" && item.embedUrl;
            return (
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
                  {/* Platform Badge */}
                  <div className="absolute left-3 top-3">
                    {item.platform === "youtube" && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-red-600/90 px-2 py-0.5 text-[11px] font-bold text-white shadow backdrop-blur-sm">
                        <PlatformIcon platform="youtube" className="h-3 w-3" />
                        YouTube
                      </span>
                    )}
                    {item.platform === "facebook" && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-[#1877F2]/90 px-2 py-0.5 text-[11px] font-bold text-white shadow backdrop-blur-sm">
                        <PlatformIcon platform="facebook" className="h-3 w-3" />
                        Facebook
                      </span>
                    )}
                    {item.platform === "tiktok" && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-black/90 px-2 py-0.5 text-[11px] font-bold text-white shadow backdrop-blur-sm">
                        <PlatformIcon platform="tiktok" className="h-3 w-3" />
                        TikTok
                      </span>
                    )}
                  </div>

                  {/* Play overlay button */}
                  {isVideo ? (
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
                <div className="flex flex-1 flex-col justify-between p-4">
                  <div>
                    <h3 className="line-clamp-2 text-sm font-bold leading-snug text-ink transition group-hover:text-interactive-primary">
                      {item.title}
                    </h3>
                  </div>

                  <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-3 text-xs text-ink-light">
                    <span>{item.authorName || "翔水賽鴿"}</span>
                    {isVideo ? (
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
            );
          })}
        </div>
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
