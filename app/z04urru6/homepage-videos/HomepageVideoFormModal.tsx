"use client";

import { useId, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AdminModal from "../components/AdminModal";
import ModalFormActions from "../components/ModalFormActions";
import { extractYouTubeId } from "@/lib/youtubeEmbed";

const inputClass =
  "w-full rounded-md border border-border px-3 py-2 text-sm focus:border-interactive-primary focus:outline-none";
const TITLE_MAX = 255;

export type EditHomepageVideo = {
  id: number;
  title: string;
  youtubeUrl: string;
  videoId: string;
  sortOrder: number;
  isActive: boolean;
};

type Props =
  | { mode: "create"; disabled?: boolean; disabledReason?: string }
  | { mode: "edit"; video: EditHomepageVideo };

export default function HomepageVideoFormModal(props: Props) {
  const router = useRouter();
  const isEdit = props.mode === "edit";
  const titleInputId = useId();
  const urlInputId = useId();
  const sortOrderInputId = useId();
  const isActiveInputId = useId();

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(isEdit ? props.video.title : "");
  const [youtubeUrl, setYoutubeUrl] = useState(isEdit ? props.video.youtubeUrl : "");
  const [sortOrder, setSortOrder] = useState(isEdit ? String(props.video.sortOrder) : "");
  const [isActive, setIsActive] = useState(isEdit ? props.video.isActive : true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // 即時預覽解析出的 YouTube ID
  const detectedVideoId = useMemo(() => {
    return extractYouTubeId(youtubeUrl);
  }, [youtubeUrl]);

  function resetForm() {
    setTitle(isEdit ? props.video.title : "");
    setYoutubeUrl(isEdit ? props.video.youtubeUrl : "");
    setSortOrder(isEdit ? String(props.video.sortOrder) : "");
    setIsActive(isEdit ? props.video.isActive : true);
    setError(null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError("請輸入影片標題");
      return;
    }

    const trimmedUrl = youtubeUrl.trim();
    if (!trimmedUrl) {
      setError("請輸入 YouTube 影片網址");
      return;
    }

    if (!detectedVideoId) {
      setError("無法識別此 YouTube 網址，請確認網址格式是否正確");
      return;
    }

    setSubmitting(true);

    const payload = {
      title: trimmedTitle,
      youtubeUrl: trimmedUrl,
      sortOrder: sortOrder.trim() === "" ? undefined : Number(sortOrder.trim()),
      isActive,
    };

    try {
      const endpoint = isEdit ? `/api/admin/homepage-videos/${props.video.id}` : "/api/admin/homepage-videos";
      const response = await fetch(endpoint, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      setSubmitting(false);

      if (!data.ok) {
        setError(data.error ?? "儲存失敗");
        return;
      }

      setOpen(false);
      if (!isEdit) resetForm();
      router.refresh();
    } catch {
      setSubmitting(false);
      setError("連線失敗，請稍後再試");
    }
  }

  return (
    <>
      {isEdit ? (
        <button
          type="button"
          onClick={() => {
            resetForm();
            setOpen(true);
          }}
          className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface-muted"
        >
          編輯
        </button>
      ) : (
        <button
          type="button"
          disabled={props.disabled}
          onClick={() => {
            resetForm();
            setOpen(true);
          }}
          title={props.disabled ? props.disabledReason : undefined}
          className="inline-flex items-center gap-1.5 rounded-md bg-interactive-primary px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:opacity-95 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          ＋ 新增指定影音
        </button>
      )}

      {open && (
        <AdminModal
          title={isEdit ? "編輯指定影音" : "新增指定影音"}
          onOverlayClick={() => {
            if (!submitting) setOpen(false);
          }}
        >
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div>
              <label htmlFor={urlInputId} className="block text-xs font-semibold text-ink-light">
                YouTube 影片網址 <span className="text-ended">*</span>
              </label>
              <input
                id={urlInputId}
                type="text"
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                placeholder="例如：https://www.youtube.com/watch?v=... 或 https://youtu.be/..."
                className={`mt-1 ${inputClass}`}
                required
              />
              <p className="mt-1 text-xs text-ink-light">
                支援完整網址、短網址（youtu.be）或 Shorts 格式。
              </p>
            </div>

            {/* 即時預覽卡片 */}
            {detectedVideoId ? (
              <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50/50 p-2.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`https://i.ytimg.com/vi/${detectedVideoId}/hqdefault.jpg`}
                  alt="縮圖預覽"
                  className="h-14 w-24 rounded-lg border border-border object-cover"
                />
                <div className="min-w-0 flex-1">
                  <span className="inline-flex items-center rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                    YouTube
                  </span>
                  <p className="mt-0.5 truncate text-xs text-ink-light">
                    影片 ID：<span className="font-mono font-medium text-ink">{detectedVideoId}</span>
                  </p>
                  <p className="text-[11px] text-emerald-700">✓ 已成功識別，前台將自動載入此縮圖</p>
                </div>
              </div>
            ) : youtubeUrl.trim() !== "" ? (
              <p className="text-xs text-ended">⚠️ 尚未能識別 YouTube 影片 ID，請檢查網址</p>
            ) : null}

            <div>
              <label htmlFor={titleInputId} className="block text-xs font-semibold text-ink-light">
                影片標題 <span className="text-ended">*</span>
              </label>
              <input
                id={titleInputId}
                type="text"
                value={title}
                maxLength={TITLE_MAX}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="輸入前台卡片顯示的標題"
                className={`mt-1 ${inputClass}`}
                required
              />
              <div className="mt-1 flex justify-between text-xs text-ink-light">
                <span>簡潔有力的標題有助於提高點閱</span>
                <span>
                  {title.length} / {TITLE_MAX}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor={sortOrderInputId} className="block text-xs font-semibold text-ink-light">
                  排序序號
                </label>
                <input
                  id={sortOrderInputId}
                  type="number"
                  min="0"
                  step="1"
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value)}
                  placeholder="留空自動排在最後"
                  className={`mt-1 ${inputClass}`}
                />
                <p className="mt-1 text-[11px] text-ink-light">數字愈小愈靠前（例如 0 最前面）</p>
              </div>

              <div className="flex items-center pt-6">
                <label htmlFor={isActiveInputId} className="inline-flex cursor-pointer items-center gap-2">
                  <input
                    id={isActiveInputId}
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="h-4 w-4 rounded border-border text-interactive-primary focus:ring-interactive-primary"
                  />
                  <span className="text-sm font-medium text-ink">在前台啟用播放</span>
                </label>
              </div>
            </div>

            {error && <p className="text-sm text-ended">{error}</p>}

            <ModalFormActions
              onCancel={() => {
                resetForm();
                setOpen(false);
              }}
              submitting={submitting}
              submitLabel={isEdit ? "儲存變更" : "新增影片"}
              pendingLabel="儲存中..."
            />

          </form>
        </AdminModal>
      )}
    </>
  );
}
