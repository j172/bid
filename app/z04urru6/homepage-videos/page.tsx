import AdminPageIntro from "../AdminPageIntro";
import { AdminTable, AdminTableCell, AdminTableRow } from "../components/AdminTable";
import DeleteConfirmButton from "../components/DeleteConfirmButton";
import HomepageVideoFormModal from "./HomepageVideoFormModal";
import { HOMEPAGE_VIDEOS_MAX, listHomepageVideos } from "@/lib/homepageVideos";

export const dynamic = "force-dynamic";

export default async function HomepageVideosAdminPage() {
  const videos = await listHomepageVideos();
  const activeVideoCount = videos.filter((video) => video.isActive).length;
  const isFull = activeVideoCount >= HOMEPAGE_VIDEOS_MAX;

  return (
    <main>
      <AdminPageIntro
        title="官方影音管理"
        description="管理首頁「官方社群影音動態」專區所要指定的 YouTube 影音（最多 6 則）。設定後前台將優先播放此處啟用的影片；若清空未設定，前台將自動退回頻道 RSS 抓取最新影片。"
      >
        <div className="flex items-center gap-3">
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              isFull
                ? "bg-amber-100 text-amber-800"
                : "bg-surface-muted text-ink-light"
            }`}
          >
            已啟用 {activeVideoCount} / {HOMEPAGE_VIDEOS_MAX} 則{isFull ? "（已達上限）" : ""}
          </span>
          <HomepageVideoFormModal
            mode="create"
            activeLimitReached={isFull}
          />
        </div>
      </AdminPageIntro>

      {videos.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-border bg-surface p-8 text-center">
          <p className="text-base font-semibold text-ink">目前未指定任何影音</p>
          <p className="mt-2 text-sm text-ink-light">
            前台「官方社群影音動態」目前正自動由官方 YouTube 頻道 RSS 抓取最新發布的影片播放。
          </p>
          <p className="mt-1 text-sm text-ink-light">
            若您希望在首頁固定播放指定影片（最多 6 則），請點選上方「＋ 新增指定影音」。
          </p>
        </div>
      ) : (
        <div className="mt-6">
          <AdminTable headers={["縮圖", "標題", "YouTube 影片", "排序", "狀態", ""]}>
            {videos.map((video) => {
              const thumbnailUrl = `https://i.ytimg.com/vi/${video.videoId}/hqdefault.jpg`;
              return (
                <AdminTableRow key={video.id}>
                  <AdminTableCell>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={thumbnailUrl}
                      alt={video.title}
                      className="h-14 w-24 rounded-lg border border-border object-cover"
                    />
                  </AdminTableCell>

                  <AdminTableCell className="font-medium">
                    <p className="max-w-md font-bold text-ink">{video.title}</p>
                    <p className="mt-0.5 text-xs text-ink-light">
                      建立於 {video.createdAt.toLocaleDateString()}
                    </p>
                  </AdminTableCell>

                  <AdminTableCell>
                    <a
                      href={video.youtubeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-mono text-xs text-interactive-primary hover:underline"
                    >
                      <span className="rounded bg-red-600 px-1 py-0.5 text-[10px] font-bold text-white">YT</span>
                      <span>{video.videoId}</span>
                    </a>
                  </AdminTableCell>

                  <AdminTableCell>{video.sortOrder}</AdminTableCell>

                  <AdminTableCell>
                    {video.isActive ? (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                        啟用中
                      </span>
                    ) : (
                      <span className="rounded-full bg-surface-muted px-2 py-0.5 text-xs font-medium text-ink-light">
                        已停用
                      </span>
                    )}
                  </AdminTableCell>

                  <AdminTableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <HomepageVideoFormModal mode="edit" video={video} />
                      <DeleteConfirmButton
                        endpoint={`/api/admin/homepage-videos/${video.id}`}
                        itemLabel={video.title}
                        itemNoun="這則指定影音"
                      />
                    </div>
                  </AdminTableCell>
                </AdminTableRow>
              );
            })}
          </AdminTable>
        </div>
      )}
    </main>
  );
}

